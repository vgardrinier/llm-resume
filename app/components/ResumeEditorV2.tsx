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
  byEducationEntry: Map<string, ResumeChange[]>
}

function indexChanges(changes: ResumeChange[]): ChangeIndex {
  const bySectionAndBullet = new Map<string, ResumeChange[]>()
  const bySection = new Map<string, ResumeChange[]>()
  const byEducationEntry = new Map<string, ResumeChange[]>()

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

    // NOTE: Education changes are not indexed - education should never be modified
    // We keep the byEducationEntry map for type consistency but it will always be empty
  })

  return { bySectionAndBullet, bySection, byEducationEntry }
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

    // Filter out rejected changes for display
    const activeChanges = changes.filter(c => getChangeStatus(c.id) !== 'rejected')
    const rejectedChanges = changes.filter(c => getChangeStatus(c.id) === 'rejected')
    
    // If all changes are rejected, show original
    if (activeChanges.length === 0) {
      return <span className="text-gray-700 font-sans">{originalText}</span>
    }

    // If all changes are accepted, show the last accepted suggestion (or merge them)
    const allAccepted = activeChanges.every(c => getChangeStatus(c.id) === 'accepted')
    if (allAccepted && activeChanges.length > 0) {
      // Show the most recent accepted change's suggested text
      return <span className="text-gray-700 font-sans">{activeChanges[activeChanges.length - 1].suggested}</span>
    }

    // For pending changes, show original text with a single highlight overlay
    // When multiple changes exist on the same line, show a count badge
    const pendingChanges = activeChanges.filter(c => getChangeStatus(c.id) === 'pending')
    
    if (pendingChanges.length === 0) {
      // All active changes are accepted, show the last one
      return <span className="text-gray-700 font-sans">{activeChanges[activeChanges.length - 1].suggested}</span>
    }

    // Show original text with highlight, and handle multiple changes
    const hasMultipleChanges = pendingChanges.length > 1
    
    return (
      <span className="relative inline-block group">
        {/* Show original text with highlight when there are pending changes */}
        <span
          className={`
            text-gray-700 font-sans
            bg-yellow-50/80 border-b-2 border-yellow-500 px-0.5 rounded-sm cursor-pointer
          `}
        >
          {originalText}
        </span>
        {/* Show count badge when multiple changes are on the same line */}
        {hasMultipleChanges && (
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-semibold font-sans">
            {pendingChanges.length}
          </span>
        )}
        {/* Render tooltip for the first pending change (or all if multiple) */}
        {pendingChanges.length > 0 && (
          <ChangeOverlay
            change={pendingChanges[0]}
            allChanges={pendingChanges}
            status={getChangeStatus(pendingChanges[0].id)}
            isHovered={hoveredChange === pendingChanges[0].id || pendingChanges.some(c => hoveredChange === c.id)}
            onHover={() => setHoveredChange(pendingChanges[0].id)}
            onLeave={() => setHoveredChange(null)}
            onAccept={(changeId) => onAcceptChange(changeId)}
            onReject={(changeId) => onRejectChange(changeId)}
            multipleChanges={hasMultipleChanges}
          />
        )}
      </span>
    )
  }

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

  // Helper: Filter changes to only include visible/actionable ones
  // This ensures consistent counting across the UI
  // NOTE: Education changes are ALWAYS filtered out - education should never be modified
  const getVisibleChanges = useMemo(() => {
    return changes.filter(c => {
      // Always exclude education changes - education should never be modified
      if (c.section === 'Education' || c.section === 'education') {
        return false
      }
      
      // Only count changes that are actually visible/actionable
      // Filter out changes for sections that don't exist or are empty
      const section = optimizedResume.sections.find(s => s.title === c.section)
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
  }, [changes, optimizedResume.sections])


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
                  {entry.bullets && entry.bullets.map((bullet: string, bulletIdx: number) => {
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

      // Education or other array sections
      // NOTE: Education section should NEVER be modified - always show original content exactly as provided
      // Display exactly what's in the structured data - backend should handle parsing correctly
      if (section.type === 'education') {
        return (
          <div className="space-y-4">
            {section.content.map((entry: any, entryIdx: number) => (
              <div key={entryIdx}>
                <div className="font-semibold text-gray-900 font-serif">
                  {entry.degree}
                </div>
                {/* Only show institution/location if institution exists - prevents ", Location" when institution is missing */}
                {entry.institution && (
                  <div className="text-sm text-gray-700 font-sans">
                    {entry.institution}{entry.location && `, ${entry.location}`}
                  </div>
                )}
                {/* If institution is missing but location exists, show location (backend parsing issue, but display what we have) */}
                {!entry.institution && entry.location && (
                  <div className="text-sm text-gray-700 font-sans">
                    {entry.location}
                  </div>
                )}
                {entry.date && (
                  <div className="text-sm text-gray-600 font-sans">{entry.date}</div>
                )}
                {entry.details && entry.details.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {entry.details.map((detail: string, detailIdx: number) => (
                      <li key={detailIdx} className="text-sm text-gray-600 font-sans">• {detail}</li>
                    ))}
                  </ul>
                )}
              </div>
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
            {getVisibleChanges.length} suggestions • {getVisibleChanges.filter(c => acceptedChanges.has(c.id)).length} accepted
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
          {optimizedResume.sections
            .filter(section => hasSectionContent(section)) // Only show sections with content
            .map((section, idx) => (
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
  allChanges?: ResumeChange[] // When multiple changes exist on the same line
  status: 'accepted' | 'rejected' | 'pending'
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  onAccept: (changeId: string) => void
  onReject: (changeId: string) => void
  multipleChanges?: boolean
  changeIndex?: number
}

function ChangeOverlay({
  change,
  allChanges = [change],
  status,
  isHovered,
  onHover,
  onLeave,
  onAccept,
  onReject,
  multipleChanges = false
}: ChangeOverlayProps) {
  return (
    <>
      {/* Invisible hover area that covers the highlighted text */}
      <span
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className="absolute inset-0 cursor-pointer"
        style={{ zIndex: 1 }}
      />

      {/* Tooltip with all changes when multiple exist on the same line */}
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
            {multipleChanges && allChanges.length > 1 ? (
              // Show all changes when multiple exist
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-900 font-sans mb-2">
                  {allChanges.length} suggestions on this line:
                </div>
                {allChanges.map((c, idx) => (
                  <div key={c.id} className="border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-700 font-sans flex-1">{c.reason}</p>
                    </div>
                    {c.original && c.type !== 'addition' && (
                      <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-gray-600 font-sans">
                        <span className="font-medium">Original:</span> {c.original}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAccept(c.id)
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                        title="Accept"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700 font-sans">Accept</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReject(c.id)
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-medium text-red-700 font-sans">Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show single change
              <>
                <div className="flex items-start gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-700 font-sans flex-1">{change.reason}</p>
                </div>
                {change.original && change.type !== 'addition' && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-gray-600 font-sans">
                    <span className="font-medium">Original:</span> {change.original}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAccept(change.id)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                    title="Accept"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700 font-sans">Accept</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onReject(change.id)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-xs font-medium text-red-700 font-sans">Reject</span>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
