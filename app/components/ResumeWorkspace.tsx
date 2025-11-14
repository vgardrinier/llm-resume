'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { StructuredResumeResponse } from '@/types/api'
import { TheBrain } from './TheBrain'
import { ResumeEditor } from './ResumeEditorV2'

interface ResumeWorkspaceProps {
  data: StructuredResumeResponse
  onStartOver: () => void
}

export function ResumeWorkspace({ data, onStartOver }: ResumeWorkspaceProps) {
  // Track which changes have been accepted/rejected
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set())
  const [rejectedChanges, setRejectedChanges] = useState<Set<string>>(new Set())

  // Helper: Check if section has content
  const hasSectionContent = (section: any): boolean => {
    if (typeof section.content === 'string') {
      return section.content.trim().length > 0
    }
    if (Array.isArray(section.content)) {
      if (section.type === 'experience' || section.type === 'projects') {
        return section.content.length > 0 && section.content.some((entry: any) => 
          entry.bullets && entry.bullets.length > 0
        )
      }
      return section.content.length > 0
    }
    return false
  }

  // Filter changes to only include visible/actionable ones
  // This ensures consistent counting across the UI
  // NOTE: Education changes are ALWAYS filtered out - education should never be modified
  const visibleChanges = data.changes.filter(c => {
    // Always exclude education changes - education should never be modified
    if (c.section === 'Education' || c.section === 'education') {
      return false
    }
    
    // Only count changes that are actually visible/actionable
    // Filter out changes for sections that don't exist or are empty
    const section = data.optimizedResume.sections.find(s => s.title === c.section)
    if (!section) return false
    
    // For positioned changes, verify the position exists
    if (c.position?.sectionIndex !== undefined) {
      // For experience/projects with bullet points
      if (c.position?.bulletIndex !== undefined) {
        if (section.type === 'experience' || section.type === 'projects') {
          if (Array.isArray(section.content)) {
            const entry = section.content[c.position.sectionIndex]
            if (entry && typeof entry === 'object' && 'bullets' in entry) {
              return Array.isArray(entry.bullets) && entry.bullets[c.position.bulletIndex]
            }
          }
          return false
        }
      }
    }
    
    return hasSectionContent(section)
  })

  const handleAcceptChange = (changeId: string) => {
    setAcceptedChanges(prev => new Set(prev).add(changeId))
    setRejectedChanges(prev => {
      const next = new Set(prev)
      next.delete(changeId)
      return next
    })
  }

  const handleRejectChange = (changeId: string) => {
    setRejectedChanges(prev => new Set(prev).add(changeId))
    setAcceptedChanges(prev => {
      const next = new Set(prev)
      next.delete(changeId)
      return next
    })
  }

  const handleAcceptAll = () => {
    setAcceptedChanges(new Set(visibleChanges.map(c => c.id)))
    setRejectedChanges(new Set())
  }

  // Animation timing constants (must match TheBrain.tsx)
  const ANIMATION_DURATION = 0.8
  const ANIMATION_EASING = [0.22, 1, 0.36, 1] as const
  const LEFT_PANEL_INITIAL_DELAY = 0.2
  const LEFT_PANEL_CARD_DELAY_INCREMENT = 0.3
  const LEFT_PANEL_CARD_COUNT = 7 // Number of cards in TheBrain
  // Start right panel when left panel is ~40% through (after 2-3 cards) for smooth overlap
  const RIGHT_PANEL_DELAY = LEFT_PANEL_INITIAL_DELAY + (LEFT_PANEL_CARD_DELAY_INCREMENT * 2.5)

  // Animation variants for smooth reveal
  const rightPanelVariants = {
    hidden: {
      opacity: 0,
      x: 40,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: ANIMATION_DURATION,
        ease: ANIMATION_EASING,
        delay: RIGHT_PANEL_DELAY,
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full flex gap-8 py-8"
      style={{ scrollbarGutter: 'stable' }}
    >
      {/* Two-column desk layout */}
      {/* Left Pane: Glass Dashboard - Fixed width (sections animate individually) */}
      <div className="w-[360px] shrink-0 h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-2xl p-6">
          <TheBrain
            analysis={data.analysis}
            salary={data.salary}
            changesCount={visibleChanges.length}
            acceptedCount={visibleChanges.filter(c => acceptedChanges.has(c.id)).length}
            rejectedCount={visibleChanges.filter(c => rejectedChanges.has(c.id)).length}
            onStartOver={onStartOver}
          />
        </div>
      </div>

      {/* Right Pane: Glass Resume Editor - Appears all at once after left panel sections */}
      <motion.div
        variants={rightPanelVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 min-w-[700px] h-[calc(100vh-8rem)] overflow-y-auto"
      >
        <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-2xl p-6 h-full">
          <ResumeEditor
            optimizedResume={data.optimizedResume}
            changes={data.changes}
            acceptedChanges={acceptedChanges}
            rejectedChanges={rejectedChanges}
            onAcceptChange={handleAcceptChange}
            onRejectChange={handleRejectChange}
            onAcceptAll={handleAcceptAll}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
