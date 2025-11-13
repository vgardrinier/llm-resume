'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StructuredResume, ResumeChange } from '@/types/api'
import { Check, X, Info, Download } from 'lucide-react'
import { Button } from './Button'

interface ResumeEditorProps {
  optimizedResume: StructuredResume
  changes: ResumeChange[]
  acceptedChanges: Set<string>
  rejectedChanges: Set<string>
  onAcceptChange: (id: string) => void
  onRejectChange: (id: string) => void
  onAcceptAll: () => void
}

// Pre-index changes for O(1) lookup instead of O(n²) filtering
type ChangeIndex = {
  bySectionAndBullet: Map<string, ResumeChange[]>
  bySection: Map<string, ResumeChange[]>
}

function indexChanges(changes: ResumeChange[]): ChangeIndex {
  const bySectionAndBullet = new Map<string, ResumeChange[]>()
  const bySection = new Map<string, ResumeChange[]>()

  changes.forEach(change => {
    // Index by section only (for summary, skills, etc.)
    const sectionKey = `section-${change.section}`
    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, [])
    }
    bySection.get(sectionKey)!.push(change)

    // Index by section + bullet (for experience, projects)
    if (change.position?.sectionIndex !== undefined && change.position?.bulletIndex !== undefined) {
      const bulletKey = `${change.section}-${change.position.sectionIndex}-${change.position.bulletIndex}`
      if (!bySectionAndBullet.has(bulletKey)) {
        bySectionAndBullet.set(bulletKey, [])
      }
      bySectionAndBullet.get(bulletKey)!.push(change)
    }
  })

  return { bySectionAndBullet, bySection }
}

export function ResumeEditor({
  optimizedResume,
  changes,
  acceptedChanges,
  rejectedChanges,
  onAcceptChange,
  onRejectChange,
  onAcceptAll
}: ResumeEditorProps) {
  const [hoveredChange, setHoveredChange] = useState<string | null>(null)

  // Pre-index changes once (O(n) setup, O(1) lookups)
  const changeIndex = useMemo(() => indexChanges(changes), [changes])

  // Helper: Get change status
  const getChangeStatus = (id: string): 'accepted' | 'rejected' | 'pending' => {
    if (acceptedChanges.has(id)) return 'accepted'
    if (rejectedChanges.has(id)) return 'rejected'
    return 'pending'
  }

  // Helper: Render text with inline change overlays (NOT replacements)
  const renderTextWithChanges = (
    originalText: string,
    changes: ResumeChange[],
    sectionTitle: string
  ) => {
    if (changes.length === 0) {
      return <span className="text-gray-700 font-sans">{originalText}</span>
    }

    // For now, show original text with change overlays
    // TODO: Implement proper word-level diff
    return (
      <div className="relative inline">
        {changes.map(change => {
          const status = getChangeStatus(change.id)

          // If rejected, show original only
          if (status === 'rejected') {
            return (
              <span key={change.id} className="text-gray-700 font-sans">
                {change.original || originalText}
              </span>
            )
          }

          // If accepted, show suggested
          if (status === 'accepted') {
            return (
              <span key={change.id} className="text-gray-700 font-sans">
                {change.suggested}
              </span>
            )
          }

          // If pending, show original with overlay suggestion
          return (
            <ChangeOverlay
              key={change.id}
              change={change}
              status={status}
              isHovered={hoveredChange === change.id}
              onHover={() => setHoveredChange(change.id)}
              onLeave={() => setHoveredChange(null)}
              onAccept={() => onAcceptChange(change.id)}
              onReject={() => onRejectChange(change.id)}
            />
          )
        })}
      </div>
    )
  }

  // Helper: Render section content
  const renderSectionContent = (section: any, sectionIdx: number) => {
    const sectionKey = `section-${section.title}`
    const sectionChanges = changeIndex.bySection.get(sectionKey) || []

    if (typeof section.content === 'string') {
      // Simple text section (e.g., summary)
      const nonPositionedChanges = sectionChanges.filter(c => !c.position?.sectionIndex)

      return (
        <div className="space-y-2">
          {renderTextWithChanges(section.content, nonPositionedChanges, section.title)}
        </div>
      )
    }

    if (Array.isArray(section.content)) {
      if (section.type === 'experience' || section.type === 'projects') {
        return (
          <div className="space-y-5">
            {section.content.map((entry: any, entryIdx: number) => (
              <div key={entryIdx}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="font-semibold text-gray-900 font-serif">
                    {entry.title}
                  </div>
                  <div className="text-sm text-gray-600 font-sans">{entry.dates}</div>
                </div>
                <div className="text-sm text-gray-700 font-sans mb-2">
                  {entry.company}{entry.location && ` • ${entry.location}`}
                </div>

                <ul className="space-y-1.5 mt-2">
                  {entry.bullets.map((bullet: string, bulletIdx: number) => {
                    // O(1) lookup using pre-indexed map
                    const bulletKey = `${section.title}-${entryIdx}-${bulletIdx}`
                    const bulletChanges = changeIndex.bySectionAndBullet.get(bulletKey) || []

                    return (
                      <li key={bulletIdx} className="flex gap-2 text-[15px] leading-relaxed">
                        <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
                        <div className="flex-1">
                          {renderTextWithChanges(bullet, bulletChanges, section.title)}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )
      }

      if (section.type === 'skills') {
        return (
          <div className="flex flex-wrap gap-2">
            {section.content.map((skill: string, idx: number) => (
              <span
                key={idx}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-sans"
              >
                {skill}
              </span>
            ))}
          </div>
        )
      }
    }

    return null
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Action Bar - Inside glass container */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-[0_2px_8px_rgba(0,0,0,0.05)] rounded-lg px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-sans">
            {changes.length} suggestions • {acceptedChanges.size} accepted
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={onAcceptAll}
            variant="gradient"
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Accept All
          </Button>
          <Button
            onClick={() => {/* TODO: Export */}}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Resume Content - Inside glass container */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-[0_2px_8px_rgba(0,0,0,0.05)] rounded-lg p-12 flex-1 overflow-y-auto" style={{
        lineHeight: '1.6'
      }}>
        {/* Contact Info */}
        {optimizedResume.contactInfo && (
          <div className="mb-10 text-center max-w-full">
            <h1 className="text-3xl font-bold text-gray-900 mb-3 font-serif tracking-tight">
              {optimizedResume.contactInfo.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-gray-700 font-sans">
              {optimizedResume.contactInfo.email && <span className="whitespace-nowrap">{optimizedResume.contactInfo.email}</span>}
              {optimizedResume.contactInfo.phone && <span className="hidden sm:inline">•</span>}
              {optimizedResume.contactInfo.phone && <span className="whitespace-nowrap">{optimizedResume.contactInfo.phone}</span>}
              {optimizedResume.contactInfo.location && <span className="hidden sm:inline">•</span>}
              {optimizedResume.contactInfo.location && <span className="whitespace-nowrap">{optimizedResume.contactInfo.location}</span>}
            </div>
            {(optimizedResume.contactInfo.linkedin || optimizedResume.contactInfo.website) && (
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-blue-600 mt-2 font-sans">
                {optimizedResume.contactInfo.linkedin && (
                  <a href={`https://${optimizedResume.contactInfo.linkedin}`} className="hover:underline whitespace-nowrap">
                    LinkedIn
                  </a>
                )}
                {optimizedResume.contactInfo.website && (
                  <a href={`https://${optimizedResume.contactInfo.website}`} className="hover:underline whitespace-nowrap">
                    Website
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {optimizedResume.sections.map((section, idx) => (
            <div key={idx}>
              <h2 className="text-base font-bold text-gray-900 mb-3 border-b-2 border-gray-900 pb-1 font-serif uppercase tracking-wide">
                {section.title}
              </h2>
              {renderSectionContent(section, idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Change Overlay Component (shows original with suggestion overlay - NOT replacement)
interface ChangeOverlayProps {
  change: ResumeChange
  status: 'accepted' | 'rejected' | 'pending'
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  onAccept: () => void
  onReject: () => void
}

function ChangeOverlay({
  change,
  status,
  isHovered,
  onHover,
  onLeave,
  onAccept,
  onReject
}: ChangeOverlayProps) {
  const getStyle = () => {
    if (change.type === 'addition') {
      return 'bg-green-50/80 border-b-2 border-green-500'
    }
    if (change.type === 'deletion') {
      return 'bg-red-50/80 border-b-2 border-red-500 line-through'
    }
    return 'bg-yellow-50/80 border-b-2 border-yellow-500'
  }

  return (
    <span className="relative inline-block group">
      {/* Original text with visual indicator */}
      <span
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={`
          ${getStyle()}
          cursor-pointer transition-all
          px-0.5 rounded-sm
          font-sans text-gray-700
        `}
      >
        {change.type === 'deletion' ? change.original : change.suggested}
      </span>

      {/* Reason tooltip with accept/reject buttons inside */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15, delay: 0.2 }}
            onMouseEnter={onHover} // Keep tooltip open when hovering over it
            onMouseLeave={onLeave}
            className="absolute z-50 top-full left-0 mt-2 w-80 backdrop-blur-md bg-white/95 border border-gray-200 shadow-lg rounded-lg p-3"
          >
            {/* Reason explanation */}
            <div className="flex items-start gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 font-sans flex-1">{change.reason}</p>
            </div>

            {/* Original text (if applicable) */}
            {change.original && change.type !== 'addition' && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-gray-600 font-sans">
                <span className="font-medium">Original:</span> {change.original}
              </div>
            )}

            {/* Accept/Reject buttons - only show for pending changes */}
            {status === 'pending' && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAccept()
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors group"
                  title="Accept"
                >
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700 font-sans">Accept</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onReject()
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors group"
                  title="Reject"
                >
                  <X className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-red-700 font-sans">Reject</span>
                </button>
              </div>
            )}

            {/* Status indicator for accepted/rejected changes */}
            {status === 'accepted' && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700 font-sans">Accepted</span>
              </div>
            )}
            {status === 'rejected' && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <X className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-700 font-sans">Rejected</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
