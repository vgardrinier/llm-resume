'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { StructuredResumeResponse } from '@/types/api'
import { TheBrain } from './TheBrain'
import { ResumeEditor } from './ResumeEditorV2'

interface ResumeWorkspaceProps {
  data: StructuredResumeResponse
  mode?: 'fast' | 'deep'
  loading?: boolean
  onStartOver: () => void
  onRunFullAnalysis?: () => void
}

export function ResumeWorkspace({ data, mode = 'deep', loading = false, onStartOver, onRunFullAnalysis }: ResumeWorkspaceProps) {
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

  // Helper: Normalize section names for matching (handles "Summary" vs "Professional Summary", etc.)
  const normalizeSectionName = (name: string | undefined): string => {
    if (!name || typeof name !== 'string') return ''
    return name.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  // Helper: Match change section to resume section title
  const matchesSection = (changeSection: string | undefined, sectionTitle: string | undefined): boolean => {
    const normalizedChange = normalizeSectionName(changeSection)
    const normalizedTitle = normalizeSectionName(sectionTitle)

    // If either is empty, no match
    if (!normalizedChange || !normalizedTitle) return false
    
    // Direct match
    if (normalizedChange === normalizedTitle) return true
    
    // Special cases: "Summary" matches "Professional Summary", "Summary", etc.
    if (normalizedChange === 'summary' && normalizedTitle.includes('summary')) return true
    if (normalizedTitle === 'summary' && normalizedChange.includes('summary')) return true
    
    // "Experience" matches "Work Experience", "Professional Experience", etc.
    if (normalizedChange === 'experience' && normalizedTitle.includes('experience')) return true
    if (normalizedTitle === 'experience' && normalizedChange.includes('experience')) return true
    
    return false
  }

  // Filter changes to only include visible/actionable ones
  // This ensures consistent counting across the UI
  // NOTE: Education changes are ALWAYS filtered out - education should never be modified
  // IMPORTANT: Include ALL changes (pending, accepted, rejected) in the count
  // We filter rejected changes when RENDERING, but not when COUNTING
  const visibleChanges = useMemo(() => data.changes.filter(c => {
    // Always exclude education changes - education should never be modified
    if (c.section === 'Education' || c.section === 'education') {
      return false
    }
    
    // Don't filter by rejection status - we want to count ALL changes (pending + accepted + rejected)
    // This ensures "X suggestions" shows the true total count
    
    // Only count changes that are actually visible/actionable
    // Filter out changes for sections that don't exist or are empty
    const section = data.optimizedResume.sections.find(s => matchesSection(c.section, s.title))
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
  }), [data.changes, data.optimizedResume.sections])

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
    // Only accept changes that haven't been rejected
    // This preserves the user's rejection decisions
    const changesToAccept = visibleChanges.filter(c => !rejectedChanges.has(c.id))
    setAcceptedChanges(new Set(changesToAccept.map(c => c.id)))
    // Keep rejectedChanges as-is - don't clear them!
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
      className={`w-full flex gap-8 py-8 ${mode === 'fast' ? 'justify-center' : ''}`}
      style={{ scrollbarGutter: 'stable' }}
    >
      {/* Left Pane: Glass Dashboard - Only show in Deep Mode */}
      {mode === 'deep' && (
        <div className="w-[360px] shrink-0 h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-2xl p-6">
            <TheBrain
              analysis={data.analysis}
              salary={data.salary}
              changesCount={visibleChanges.length}
              acceptedCount={visibleChanges.filter(c => acceptedChanges.has(c.id)).length}
              rejectedCount={visibleChanges.filter(c => rejectedChanges.has(c.id)).length}
              mode={mode}
              onStartOver={onStartOver}
              onRunFullAnalysis={onRunFullAnalysis}
            />
          </div>
        </div>
      )}

      {/* Right Pane: Resume Editor */}
      <motion.div
        variants={rightPanelVariants}
        initial="hidden"
        animate="visible"
        className={`${
          mode === 'fast'
            ? 'w-full max-w-[1200px] overflow-y-auto'
            : 'flex-1 min-w-[700px] h-[calc(100vh-8rem)] overflow-y-auto'
        }`}
      >
        {/* Fast Mode Header - Show above CV */}
        {mode === 'fast' && (
          <div className="backdrop-blur-md bg-gradient-to-r from-gray-900 to-gray-700 border border-gray-800 shadow-[0_4px_30px_rgba(0,0,0,0.2)] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2 font-serif">
                  Quick Optimize
                </h2>
                <p className="text-sm text-gray-200 font-sans">
                  Your CV has been optimized with high-impact changes. Want fit scores and diagnostics?
                </p>
              </div>
              <div className="flex items-center gap-3">
                {onRunFullAnalysis && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={onRunFullAnalysis}
                      disabled={loading}
                      className={`py-2 px-6 rounded-xl transition-all shadow-lg font-sans text-sm font-medium flex items-center gap-2 ${
                        loading
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-white text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {loading ? 'Running...' : 'Run Full Analysis'}
                    </button>
                    <span className="text-xs text-gray-300 font-sans">(re-runs with diagnostics)</span>
                  </div>
                )}
                <button
                  onClick={onStartOver}
                  className="text-gray-300 hover:text-white underline text-sm transition-colors font-sans"
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-2xl p-6 ${mode === 'fast' ? 'h-auto' : 'h-full'}`}>
          <ResumeEditor
            optimizedResume={data.optimizedResume}
            changes={data.changes}
            acceptedChanges={acceptedChanges}
            rejectedChanges={rejectedChanges}
            onAcceptChange={handleAcceptChange}
            onRejectChange={handleRejectChange}
            onAcceptAll={handleAcceptAll}
            jobTitle={data.metadata.job_metadata.title}
            companyName={data.metadata.job_metadata.company}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
