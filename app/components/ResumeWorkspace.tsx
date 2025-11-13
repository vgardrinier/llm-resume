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
    setAcceptedChanges(new Set(data.changes.map(c => c.id)))
    setRejectedChanges(new Set())
  }

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
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1], // Same smooth easing as left panel
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
        <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-2xl p-6 h-full">
          <TheBrain
            analysis={data.analysis}
            salary={data.salary}
            changesCount={data.changes.length}
            acceptedCount={acceptedChanges.size}
            rejectedCount={rejectedChanges.size}
            onStartOver={onStartOver}
          />
        </div>
      </div>

      {/* Right Pane: Glass Resume Editor - Appears all at once after left panel sections */}
      <motion.div
        variants={rightPanelVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 2.5 }} // Start after left panel sections finish (last delay is 2.0s + 0.8s duration = 2.8s, so 2.5s gives smooth overlap)
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
