'use client'

import { useState } from 'react'
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

  // Helper: Get change status
  const getChangeStatus = (id: string): 'accepted' | 'rejected' | 'pending' => {
    if (acceptedChanges.has(id)) return 'accepted'
    if (rejectedChanges.has(id)) return 'rejected'
    return 'pending'
  }

  // Helper: Render section content with change highlights
  const renderSectionContent = (section: any, sectionIdx: number) => {
    if (typeof section.content === 'string') {
      // Simple text section (e.g., summary)
      const sectionChanges = changes.filter(c =>
        c.section === section.title &&
        !c.position?.sectionIndex
      )

      return (
        <div className="space-y-2">
          {sectionChanges.map(change => (
            <ChangeHighlight
              key={change.id}
              change={change}
              status={getChangeStatus(change.id)}
              isHovered={hoveredChange === change.id}
              onHover={() => setHoveredChange(change.id)}
              onLeave={() => setHoveredChange(null)}
              onAccept={() => onAcceptChange(change.id)}
              onReject={() => onRejectChange(change.id)}
            />
          ))}
          {sectionChanges.length === 0 && (
            <p className="text-gray-700 font-serif">{section.content}</p>
          )}
        </div>
      )
    }

    if (Array.isArray(section.content)) {
      if (section.type === 'experience' || section.type === 'projects') {
        return (
          <div className="space-y-4">
            {section.content.map((entry: any, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="font-semibold text-gray-900 font-serif">
                  {entry.title} – {entry.company}
                </div>
                {entry.location && (
                  <div className="text-sm text-gray-600 font-sans">
                    {entry.location}
                  </div>
                )}
                <div className="text-sm text-gray-500 font-sans">{entry.dates}</div>

                <ul className="space-y-2 mt-2">
                  {entry.bullets.map((bullet: string, bulletIdx: number) => {
                    // Find changes for this bullet
                    const bulletChanges = changes.filter(c =>
                      c.section === section.title &&
                      c.position?.sectionIndex === idx &&
                      c.position?.bulletIndex === bulletIdx
                    )

                    return (
                      <li key={bulletIdx} className="flex gap-2">
                        <span className="text-gray-400 flex-shrink-0">•</span>
                        <div className="flex-1 space-y-1">
                          {bulletChanges.length > 0 ? (
                            bulletChanges.map(change => (
                              <ChangeHighlight
                                key={change.id}
                                change={change}
                                status={getChangeStatus(change.id)}
                                isHovered={hoveredChange === change.id}
                                onHover={() => setHoveredChange(change.id)}
                                onLeave={() => setHoveredChange(null)}
                                onAccept={() => onAcceptChange(change.id)}
                                onReject={() => onRejectChange(change.id)}
                              />
                            ))
                          ) : (
                            <span className="text-gray-700 font-sans">{bullet}</span>
                          )}
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
    <div className="space-y-4">
      {/* Header with Accept All */}
      <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 font-serif">
            Your Optimized Résumé
          </h2>
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

      {/* Resume Content */}
      <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-8">
        {/* Contact Info */}
        {optimizedResume.contactInfo && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 font-serif">
              {optimizedResume.contactInfo.name}
            </h1>
            <div className="flex items-center justify-center gap-3 text-sm text-gray-600 font-sans">
              {optimizedResume.contactInfo.email && <span>{optimizedResume.contactInfo.email}</span>}
              {optimizedResume.contactInfo.phone && <span>•</span>}
              {optimizedResume.contactInfo.phone && <span>{optimizedResume.contactInfo.phone}</span>}
              {optimizedResume.contactInfo.location && <span>•</span>}
              {optimizedResume.contactInfo.location && <span>{optimizedResume.contactInfo.location}</span>}
            </div>
            {(optimizedResume.contactInfo.linkedin || optimizedResume.contactInfo.website) && (
              <div className="flex items-center justify-center gap-3 text-sm text-blue-600 mt-1 font-sans">
                {optimizedResume.contactInfo.linkedin && (
                  <a href={`https://${optimizedResume.contactInfo.linkedin}`} className="hover:underline">
                    LinkedIn
                  </a>
                )}
                {optimizedResume.contactInfo.website && (
                  <a href={`https://${optimizedResume.contactInfo.website}`} className="hover:underline">
                    Website
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-6">
          {optimizedResume.sections.map((section, idx) => (
            <div key={idx}>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-2 font-serif">
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

// Change Highlight Component (Grammarly-style)
interface ChangeHighlightProps {
  change: ResumeChange
  status: 'accepted' | 'rejected' | 'pending'
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  onAccept: () => void
  onReject: () => void
}

function ChangeHighlight({
  change,
  status,
  isHovered,
  onHover,
  onLeave,
  onAccept,
  onReject
}: ChangeHighlightProps) {
  const getHighlightColor = () => {
    if (status === 'accepted') return 'bg-green-100 border-green-300'
    if (status === 'rejected') return 'bg-red-100 border-red-300 line-through opacity-60'
    if (change.type === 'addition') return 'bg-green-50 border-green-200'
    if (change.type === 'deletion') return 'bg-red-50 border-red-200 line-through'
    return 'bg-yellow-50 border-yellow-200'
  }

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={`
          ${getHighlightColor()}
          border px-1 py-0.5 rounded cursor-pointer transition-all
          hover:shadow-sm
          font-sans text-gray-700
        `}
      >
        {change.suggested}
      </span>

      {/* Tooltip on Hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-0 mb-2 w-80 backdrop-blur-md bg-white/95 border border-gray-200 shadow-lg rounded-lg p-4"
          >
            {/* Reason */}
            <div className="flex items-start gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 font-sans">{change.reason}</p>
            </div>

            {/* Original (for modifications/deletions) */}
            {change.original && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-gray-600 font-sans">
                <span className="font-medium">Original:</span> {change.original}
              </div>
            )}

            {/* Actions */}
            {status === 'pending' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAccept()
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1 font-sans"
                >
                  <Check className="h-3 w-3" />
                  Accept
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onReject()
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1 font-sans"
                >
                  <X className="h-3 w-3" />
                  Reject
                </button>
              </div>
            )}

            {status === 'accepted' && (
              <div className="text-xs text-green-700 font-medium flex items-center gap-1 font-sans">
                <Check className="h-3 w-3" />
                Accepted
              </div>
            )}

            {status === 'rejected' && (
              <div className="text-xs text-red-700 font-medium flex items-center gap-1 font-sans">
                <X className="h-3 w-3" />
                Rejected
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
