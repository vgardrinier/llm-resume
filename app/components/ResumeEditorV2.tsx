'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReactToPrint } from 'react-to-print'
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

// Normalize section name for consistent matching (case-insensitive, trimmed)
function normalizeSectionName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Extract core section name (e.g., "Professional Summary" -> "summary", "Work Experience" -> "experience")
// CRITICAL: This must handle ALL variations from generator: "Professional Summary", "Summary", "Work Experience", "Experience", etc.
function getCoreSectionName(name: string): string {
  if (!name || typeof name !== 'string') return 'unknown'
  
  const normalized = normalizeSectionName(name)
  
  // CRITICAL: Check for keywords in order of specificity (more specific first)
  // Handle all variations: "Professional Summary", "Summary", "Executive Summary", etc.
  if (normalized.includes('summary')) return 'summary'
  
  // Handle all experience variations: "Work Experience", "Professional Experience", "Experience", "Job Experience", etc.
  if (normalized.includes('experience')) return 'experience'
  
  // Handle education variations
  if (normalized.includes('education')) return 'education'
  
  // Handle skills variations: "Skills", "Technical Skills", "Core Skills", etc.
  if (normalized.includes('skill')) return 'skills'
  
  // Handle projects variations
  if (normalized.includes('project')) return 'projects'
  
  // Handle certifications
  if (normalized.includes('certification')) return 'certifications'
  
  // Fallback: try direct match on common names
  const directMatches: Record<string, string> = {
    'summary': 'summary',
    'experience': 'experience',
    'education': 'education',
    'skills': 'skills',
    'projects': 'projects',
    'certifications': 'certifications'
  }
  
  if (directMatches[normalized]) {
    return directMatches[normalized]
  }
  
  // Last resort: return normalized name
  return normalized
}

function indexChanges(changes: ResumeChange[]): ChangeIndex {
  const bySectionAndBullet = new Map<string, ResumeChange[]>()
  const bySection = new Map<string, ResumeChange[]>()
  const byEducationEntry = new Map<string, ResumeChange[]>()

  changes.forEach(change => {
    // CRITICAL: Normalize section name robustly - handle ALL generator variations
    // Generator can send: "Professional Summary", "Summary", "Work Experience", "Experience", etc.
    const sectionName = change.section || ''
    const coreSection = getCoreSectionName(sectionName)
    
    // DEBUG: Log if we're getting unexpected section names
    if (process.env.NODE_ENV === 'development' && coreSection === 'unknown') {
      console.warn('[ResumeEditor] Unknown section name in change:', {
        changeId: change.id,
        originalSection: change.section,
        normalized: normalizeSectionName(sectionName),
        coreSection
      })
    }
    
    // Index by section only (for summary, skills, etc.)
    const sectionKey = `section-${coreSection}`
    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, [])
    }
    bySection.get(sectionKey)!.push(change)

    // Index by section + bullet (for experience, projects)
    if (change.position?.sectionIndex !== undefined && change.position?.bulletIndex !== undefined) {
      const bulletKey = `${coreSection}-${change.position.sectionIndex}-${change.position.bulletIndex}`
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
  const resumeRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: resumeRef,
    documentTitle: 'Resumelm_Resume',
  })

  // Pre-index changes once (O(n) setup, O(1) lookups)
  const changeIndex = useMemo(() => {
    const index = indexChanges(changes)
    
    // DEBUG: Log indexing results
    if (process.env.NODE_ENV === 'development' && changes.length > 0) {
      const modifications = changes.filter((c: any) => c.type === 'modification')
      console.log('[ResumeEditor] Change indexing complete:', {
        totalChanges: changes.length,
        modifications: modifications.length,
        indexedBySection: Array.from(index.bySection.entries()).map(([key, vals]) => ({
          key,
          count: vals.length,
          sections: Array.from(new Set(vals.map(v => v.section)))
        })),
        indexedByBullet: Array.from(index.bySectionAndBullet.entries()).map(([key, vals]) => ({
          key,
          count: vals.length,
          changes: vals.map((v: any) => ({
            id: v.id,
            type: v.type,
            section: v.section,
            position: v.position
          }))
        })),
        modificationsWithPositions: modifications.filter((c: any) => 
          c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined
        ).map((c: any) => ({
          id: c.id,
          section: c.section,
          position: c.position,
          hasOriginal: !!(c.original && c.original.trim().length > 0)
        }))
      })
    }
    
    return index
  }, [changes])
  
  // DEBUG: Log changes breakdown on mount/update
  useEffect(() => {
    const changesByType = changes.reduce((acc: any, c: any) => {
      acc[c.type] = (acc[c.type] || 0) + 1
      return acc
    }, {})
    
    const changesBySection = changes.reduce((acc: any, c: any) => {
      const section = c.section || 'unknown'
      acc[section] = (acc[section] || 0) + 1
      return acc
    }, {})
    
    const modifications = changes.filter((c: any) => c.type === 'modification')
    const modificationsWithOriginal = modifications.filter((c: any) => c.original && c.original.trim().length > 0)
    const modificationsWithPosition = modifications.filter((c: any) => 
      c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined
    )
    
    console.log('[ResumeEditor] Changes received:', {
      total: changes.length,
      byType: changesByType,
      bySection: changesBySection,
      modifications: {
        total: modifications.length,
        withOriginal: modificationsWithOriginal.length,
        withPosition: modificationsWithPosition.length,
        details: modifications.map((c: any) => ({
          id: c.id,
          section: c.section,
          hasOriginal: !!(c.original && c.original.trim().length > 0),
          hasPosition: !!(c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined),
          position: c.position
        }))
      }
    })
  }, [changes])

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
    // DEBUG: Log when we have changes but they're not showing
    if (process.env.NODE_ENV === 'development' && changes.length > 0) {
      const modifications = changes.filter(c => c.type === 'modification')
      if (modifications.length > 0) {
        console.log(`[ResumeEditor] renderTextWithChanges called with ${changes.length} changes (${modifications.length} modifications):`, {
          sectionTitle,
          changes: changes.map(c => ({
            id: c.id,
            type: c.type,
            status: getChangeStatus(c.id),
            hasOriginal: !!(c.original && c.original.trim().length > 0),
            originalPreview: c.original?.substring(0, 30),
            suggestedPreview: c.suggested?.substring(0, 30)
          }))
        })
      }
    }
    
    if (changes.length === 0) {
      return <span className="text-gray-700 font-sans">{originalText}</span>
    }

    // CRITICAL: Filter out rejected changes FIRST - they should not affect highlighting or styling
    const nonRejectedChanges = changes.filter(c => getChangeStatus(c.id) !== 'rejected')
    
    // If all changes are rejected, handle based on change type
    if (nonRejectedChanges.length === 0) {
      // Check if any rejected change was an addition (new content)
      const rejectedAdditions = changes.filter(c => 
        getChangeStatus(c.id) === 'rejected' && c.type === 'addition'
      )
      
      // If rejected changes include additions, return empty (new content should disappear when rejected)
      if (rejectedAdditions.length > 0) {
        // For additions, if rejected, show nothing (or original if it existed)
        const hasOriginal = changes.some(c => c.original && c.original.trim().length > 0)
        return hasOriginal 
          ? <span className="text-gray-700 font-sans">{changes.find(c => c.original)?.original || ''}</span>
          : <span></span> // Empty - addition was rejected, so remove it
      }
      
      // For modifications/deletions, return the ORIGINAL text from the change object
      // CRITICAL: When a modification is rejected, we must show the original text from the change,
      // not the optimized text (originalText parameter might be the optimized version)
      const rejectedModifications = changes.filter(c => 
        getChangeStatus(c.id) === 'rejected' && c.type === 'modification' && c.original
      )
      
      if (rejectedModifications.length > 0) {
        // Use the original text from the most recent rejected modification
        const originalFromChange = rejectedModifications[rejectedModifications.length - 1].original
        if (originalFromChange && originalFromChange.trim().length > 0) {
          return <span className="text-gray-700 font-sans">{originalFromChange}</span>
        }
      }
      
      // Fallback: return originalText parameter (for deletions or if no original found)
      return <span className="text-gray-700 font-sans">{originalText}</span>
    }

    // Now work only with non-rejected changes
    const activeChanges = nonRejectedChanges

    // If all changes are accepted, show the last accepted suggestion (or merge them)
    const allAccepted = activeChanges.every(c => getChangeStatus(c.id) === 'accepted')
    if (allAccepted && activeChanges.length > 0) {
      // Show the most recent accepted change's suggested text
      return <span className="text-gray-700 font-sans">{activeChanges[activeChanges.length - 1].suggested}</span>
    }

    // For pending changes, show original text with a single highlight overlay
    // When multiple changes exist on the same line, show a count badge
    const pendingChanges = activeChanges.filter(c => getChangeStatus(c.id) === 'pending')
    
    // DEBUG: Log if we have active changes but no pending ones
    if (process.env.NODE_ENV === 'development' && activeChanges.length > 0 && pendingChanges.length === 0) {
      console.log(`[ResumeEditor] renderTextWithChanges: ${activeChanges.length} active changes but 0 pending (all accepted?)`, {
        sectionTitle,
        activeChanges: activeChanges.map(c => ({
          id: c.id,
          type: c.type,
          status: getChangeStatus(c.id)
        }))
      })
    }
    
    if (pendingChanges.length === 0) {
      // All active changes are accepted, show the last one
      return <span className="text-gray-700 font-sans">{activeChanges[activeChanges.length - 1].suggested}</span>
    }

    // Determine what text to show and what color to use
    const firstChange = pendingChanges[0]
    const isAddition = firstChange.type === 'addition'
    const isModification = firstChange.type === 'modification'
    const isDeletion = firstChange.type === 'deletion'
    
    // DEBUG: Log what we're about to highlight
    if (process.env.NODE_ENV === 'development' && isModification) {
      console.log(`[ResumeEditor] About to highlight modification:`, {
        changeId: firstChange.id,
        sectionTitle,
        hasOriginal: !!(firstChange.original && firstChange.original.trim().length > 0),
        originalPreview: firstChange.original?.substring(0, 50),
        suggestedPreview: firstChange.suggested?.substring(0, 50),
        displayTextWillBe: firstChange.original || originalText
      })
    }
    
    // For additions, show the suggested text (new content)
    // For modifications/deletions, show the original text (what's being changed)
    // CRITICAL: For modifications, we MUST use firstChange.original if it exists
    // If original is missing for a modification, that's a data issue - log it and show optimized text
    
    // VALIDATION: Check if suggested text is valid (not just the section title)
    const isValidSuggestion = (text: string | undefined) => {
      if (!text) return false
      const normalizedText = text.toLowerCase().trim()
      const normalizedTitle = sectionTitle.toLowerCase().trim()
      // If suggestion is identical to title, it's likely a hallucination
      if (normalizedText === normalizedTitle) return false
      // If suggestion is extremely short (< 15 chars) for a summary, it's suspicious
      if (normalizedText.length < 15 && sectionTitle.toLowerCase().includes('summary')) return false
      return true
    }

    const displayText = isAddition 
      ? (isValidSuggestion(firstChange.suggested) ? firstChange.suggested : originalText)
      : (firstChange.original && firstChange.original.trim().length > 0)
        ? firstChange.original  // Use original from change object (most reliable)
        : (() => {
            // DEBUG: Log missing original for modifications
            if (isModification && process.env.NODE_ENV === 'development') {
              console.warn(`[ResumeEditor] Modification change ${firstChange.id} missing original field`, {
                changeId: firstChange.id,
                section: firstChange.section,
                suggested: firstChange.suggested?.substring(0, 50),
                originalText: originalText?.substring(0, 50)
              })
            }
            // For modifications without original, show optimized text (no highlight - data issue)
            return originalText
          })()

    // Use different colors for different change types
    // Yellow for modifications (edits), Green/Blue for additions (new content)
    const highlightClasses = isAddition
      ? `bg-green-200/90 border-b-2 border-green-600 px-1 rounded-sm cursor-pointer transition-all duration-200 hover:bg-green-300/90 hover:border-green-700`
      : isDeletion
      ? `bg-red-200/90 border-b-2 border-red-600 px-1 rounded-sm cursor-pointer transition-all duration-200 hover:bg-red-300/90 hover:border-red-700`
      : `bg-yellow-200/90 border-b-2 border-yellow-600 px-1 rounded-sm cursor-pointer transition-all duration-200 hover:bg-yellow-300/90 hover:border-yellow-700`
    
    const badgeColor = isAddition
      ? 'bg-green-600'
      : isDeletion
      ? 'bg-red-600'
      : 'bg-yellow-600'
    
    const shadowColor = isAddition
      ? 'rgba(34, 197, 94, 0.2)' // green
      : isDeletion
      ? 'rgba(239, 68, 68, 0.2)' // red
      : 'rgba(234, 179, 8, 0.2)' // yellow

    // Show original text with highlight, and handle multiple changes
    const hasMultipleChanges = pendingChanges.length > 1
    
    return (
      <span className="relative inline-block group">
        {/* Show text with highlight when there are pending changes */}
        <span
          className={`text-gray-700 font-sans ${highlightClasses}`}
          style={{
            textDecoration: 'none',
            boxShadow: `0 1px 2px ${shadowColor}`
          }}
        >
          {displayText}
        </span>
        {/* Show count badge when multiple changes are on the same line */}
        {hasMultipleChanges && (
          <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full ${badgeColor} text-white text-xs font-semibold font-sans shadow-sm`}>
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

  // Helper: Match change section to resume section title
  // CRITICAL: Use getCoreSectionName for consistent matching - handles ALL variations
  // This ensures "Professional Summary" matches "Summary", "Work Experience" matches "Experience", etc.
  const matchesSection = (changeSection: string, sectionTitle: string): boolean => {
    // Use core section names for matching - this handles all variations robustly
    const changeCore = getCoreSectionName(changeSection)
    const titleCore = getCoreSectionName(sectionTitle)
    
    // Direct core match - this is the primary matching logic
    if (changeCore === titleCore && changeCore !== 'unknown') {
      return true
    }
    
    // Fallback: also check normalized names (for edge cases where getCoreSectionName might miss)
    const normalizedChange = normalizeSectionName(changeSection)
    const normalizedTitle = normalizeSectionName(sectionTitle)
    
    if (normalizedChange === normalizedTitle) return true
    
    // Additional fallback: check substring matches for known core types
    const knownCores = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications']
    if (knownCores.includes(changeCore) && knownCores.includes(titleCore)) {
      // If both resolve to known cores, they should match if cores match
      return changeCore === titleCore
    }
    
    return false
  }

  // Helper: Filter changes to only include visible/actionable ones
  // This ensures consistent counting across the UI
  // NOTE: Education changes are ALWAYS filtered out - education should never be modified
  // CRITICAL: Rejected changes are excluded - they should not count as "visible"
  const getVisibleChanges = useMemo(() => {
    return changes.filter(c => {
      // Always exclude education changes - education should never be modified
      if (c.section === 'Education' || c.section === 'education') {
        return false
      }

      // Always exclude rejected changes - they're not actionable
      if (getChangeStatus(c.id) === 'rejected') {
        return false
      }
      
      // For ADDITIONS (new content), always count them if they're not rejected
      // They might be adding content to sections that don't exist yet or are empty
      if (c.type === 'addition') {
        // Check if section exists in optimized resume (where the addition would appear)
        const section = optimizedResume.sections.find(s => matchesSection(c.section, s.title))
        // If section exists, count it; if not, still count it (it's being added)
        return true // Additions are always visible/actionable
      }
      
      // For modifications/deletions, verify the section exists and content is valid
      const section = optimizedResume.sections.find(s => matchesSection(c.section, s.title))
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
      
      // For non-positioned changes (like summary modifications), check if section has content
      return hasSectionContent(section)
    })
  }, [changes, optimizedResume.sections, acceptedChanges, rejectedChanges])


  // Helper: Render section content
  const renderSectionContent = (section: any, sectionIdx: number) => {
    // Use core section name for consistent matching (handles "Professional Summary" vs "Summary")
    const coreSectionName = getCoreSectionName(section.title)
    const sectionKey = `section-${coreSectionName}`
    let sectionChanges = (changeIndex.bySection.get(sectionKey) || [])
      .filter(c => getChangeStatus(c.id) !== 'rejected') // CRITICAL: Exclude rejected changes

    // Debug: Log if we're not finding changes but they should exist
    // (This helps identify section matching issues)
    if (sectionChanges.length === 0 && changes.length > 0) {
      // Try to find changes that might match this section by checking all changes
      const potentialMatches = changes.filter(c => {
        const changeCoreSection = getCoreSectionName(c.section)
        return changeCoreSection === coreSectionName && getChangeStatus(c.id) !== 'rejected'
      })
      if (potentialMatches.length > 0) {
        sectionChanges = potentialMatches
      }
    }

    if (typeof section.content === 'string') {
      // Simple text section (e.g., summary)
      // For summary sections, include ALL changes for this section (both positioned and non-positioned)
      // Some generators might incorrectly add positions to summary changes
      const nonPositionedChanges = sectionChanges.filter(c => !c.position?.sectionIndex && !c.position?.bulletIndex)

      // Check if this is a pure addition (new section) that was rejected
      const isPureAddition = nonPositionedChanges.length === 0 && 
        changes.some(c => {
          const changeCoreSection = getCoreSectionName(c.section)
          return changeCoreSection === coreSectionName && 
                 c.type === 'addition' && 
                 getChangeStatus(c.id) === 'rejected' &&
                 (!c.original || c.original.trim().length === 0)
        })

      // If it's a rejected pure addition, don't render the section content
      if (isPureAddition) {
        return null
      }

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
                    // O(1) lookup using pre-indexed map (uses core section name for consistent matching)
                    const bulletKey = `${coreSectionName}-${entryIdx}-${bulletIdx}`
                    let bulletChanges = (changeIndex.bySectionAndBullet.get(bulletKey) || [])
                      .filter(c => getChangeStatus(c.id) !== 'rejected') // CRITICAL: Exclude rejected changes

                    // Fallback: If no changes found via indexed lookup, try multiple matching strategies
                    // CRITICAL: This handles cases where section name matching failed during indexing OR positions don't match
                    if (bulletChanges.length === 0 && changes.length > 0) {
                      // Strategy 1: Try exact position match with core section name
                      bulletChanges = changes.filter(c => {
                        const changeCoreSection = getCoreSectionName(c.section || '')
                        const matchesCore = changeCoreSection === coreSectionName
                        const matchesPosition = c.position?.sectionIndex === entryIdx &&
                          c.position?.bulletIndex === bulletIdx
                        const notRejected = getChangeStatus(c.id) !== 'rejected'
                        
                        return matchesCore && matchesPosition && notRejected
                      })
                      
                      // Strategy 2: If still no matches, try content-based matching for modifications
                      // This handles cases where generator didn't provide correct positions
                      if (bulletChanges.length === 0) {
                        const sectionChanges = changes.filter(c => {
                          const changeCoreSection = getCoreSectionName(c.section || '')
                          return changeCoreSection === coreSectionName && getChangeStatus(c.id) !== 'rejected'
                        })
                        
                        // For modifications, try to match by content similarity
                        // We check BOTH original (old) and suggested (new) text against the bullet (new)
                        // because we are rendering the optimized resume (new text)
                        bulletChanges = sectionChanges.filter(c => {
                          if (c.type === 'modification') {
                            const bulletLower = bullet.toLowerCase().trim()
                            
                            // Check 1: Does suggested text match the current bullet?
                            // This is the most reliable check since bullet IS the suggested text
                            if (c.suggested) {
                              const suggestedLower = c.suggested.toLowerCase().trim()
                              // Exact match or close enough
                              if (suggestedLower === bulletLower || 
                                  bulletLower.includes(suggestedLower) || 
                                  (suggestedLower.length > 20 && suggestedLower.includes(bulletLower))) {
                                return true
                              }
                            }
                            
                            // Check 2: Does original text match? (Fallback)
                            // This happens if the bullet hasn't been updated yet or if matching logic is fuzzy
                            if (c.original) {
                              const originalLower = c.original.toLowerCase().trim()
                              // Check if original text is similar to bullet (exact match or bullet contains original)
                              const isMatch = originalLower === bulletLower || 
                                             bulletLower.includes(originalLower) ||
                                             originalLower.includes(bulletLower)
                              
                              if (isMatch && process.env.NODE_ENV === 'development') {
                                console.log(`[ResumeEditor] Found modification via content matching for bullet ${entryIdx}-${bulletIdx}:`, {
                                  changeId: c.id,
                                  original: c.original.substring(0, 50),
                                  bullet: bullet.substring(0, 50),
                                  position: c.position,
                                  expectedPosition: { sectionIndex: entryIdx, bulletIndex: bulletIdx }
                                })
                              }
                              
                              return isMatch
                            }
                          }
                          return false
                        })
                      }
                      
                      // DEBUG: Log if we found matches via fallback
                      if (bulletChanges.length > 0 && process.env.NODE_ENV === 'development') {
                        console.log(`[ResumeEditor] Found ${bulletChanges.length} change(s) via fallback matching for bullet ${entryIdx}-${bulletIdx}`)
                      }
                    }

                    // DEBUG: Log bullet changes for modifications
                    if (bulletChanges.length > 0 && process.env.NODE_ENV === 'development') {
                      const hasModifications = bulletChanges.some(c => c.type === 'modification')
                      if (hasModifications) {
                        console.log(`[ResumeEditor] Bullet ${entryIdx}-${bulletIdx} (${coreSectionName}) has changes:`, {
                          bulletKey,
                          changesCount: bulletChanges.length,
                          changes: bulletChanges.map((c: any) => ({
                            id: c.id,
                            type: c.type,
                            hasOriginal: !!(c.original && c.original.trim().length > 0),
                            originalPreview: c.original?.substring(0, 50),
                            suggestedPreview: c.suggested?.substring(0, 50),
                            status: getChangeStatus(c.id)
                          }))
                        })
                      }
                    }

                    // DEBUG: Log EVERY bullet render call to see if changes are being passed
                    if (process.env.NODE_ENV === 'development') {
                      if (bulletChanges.length === 0 && changes.length > 0) {
                        // Check if there SHOULD be changes for this bullet
                        const allChangesForSection = changes.filter(c => {
                          const changeCoreSection = getCoreSectionName(c.section || '')
                          return changeCoreSection === coreSectionName && getChangeStatus(c.id) !== 'rejected'
                        })
                        if (allChangesForSection.length > 0) {
                          console.log(`[ResumeEditor] ⚠️ POSITION MISMATCH: Bullet ${entryIdx}-${bulletIdx} has NO changes but section has ${allChangesForSection.length} changes:`, {
                            bulletKey,
                            coreSectionName,
                            sectionTitle: section.title,
                            expectedPosition: { sectionIndex: entryIdx, bulletIndex: bulletIdx },
                            allSectionChanges: allChangesForSection.map((c: any) => ({
                              id: c.id,
                              type: c.type,
                              section: c.section,
                              hasPosition: !!(c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined),
                              actualPosition: c.position,
                              matchesExpected: c.position?.sectionIndex === entryIdx && c.position?.bulletIndex === bulletIdx,
                              originalPreview: c.original?.substring(0, 40),
                              suggestedPreview: c.suggested?.substring(0, 40)
                            }))
                          })
                        }
                      }
                    }

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
        // Get actionable changes for skills section
        const skillChanges = (changeIndex.bySection.get(sectionKey) || [])
          .filter(c => getChangeStatus(c.id) !== 'rejected')

        return (
          <div className="flex flex-wrap gap-2">
            {section.content.map((skill: string, idx: number) => {
              // Find change that added this skill
              const change = skillChanges.find(c => 
                c.type === 'addition' && 
                c.suggested?.toLowerCase().trim() === skill.toLowerCase().trim()
              )
              
              // Determine styling based on change status
              let classes = "bg-gray-100 text-gray-700 border border-transparent"
              if (change) {
                const status = getChangeStatus(change.id)
                if (status === 'pending') {
                  classes = "bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200 transition-colors relative group"
                }
              }
              
              return (
                <span
                  key={idx}
                  className={`px-3 py-1 rounded-lg text-sm font-sans ${classes}`}
                >
                  {skill}
                  {change && getChangeStatus(change.id) === 'pending' && (
                    <ChangeOverlay
                      change={change}
                      status="pending"
                      isHovered={hoveredChange === change.id}
                      onHover={() => setHoveredChange(change.id)}
                      onLeave={() => setHoveredChange(null)}
                      onAccept={onAcceptChange}
                      onReject={onRejectChange}
                    />
                  )}
                </span>
              )
            })}
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
            onClick={() => handlePrint()}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Resume Content - Inside glass container */}
      <div ref={resumeRef} className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-[0_2px_8px_rgba(0,0,0,0.05)] rounded-lg p-12 flex-1 overflow-y-auto print:overflow-visible print:h-auto print:bg-white print:p-0 print:shadow-none print:border-0" style={{
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
            .map((section, idx) => {
              // Check if this section has any actionable changes (both section-level and bullet-level)
              // CRITICAL: Only count non-rejected changes for border styling
              const coreSectionName = getCoreSectionName(section.title)
              const sectionKey = `section-${coreSectionName}`
              
              // Get section-level changes (filter out rejected)
              const sectionChanges = (changeIndex.bySection.get(sectionKey) || [])
                .filter(c => getChangeStatus(c.id) !== 'rejected')
              
              // Get bullet-level changes for this section (filter out rejected)
              let bulletChanges: ResumeChange[] = []
              if (section.type === 'experience' || section.type === 'projects') {
                if (Array.isArray(section.content)) {
                  section.content.forEach((entry: any, entryIdx: number) => {
                    if (entry.bullets && Array.isArray(entry.bullets)) {
                      entry.bullets.forEach((_: string, bulletIdx: number) => {
                        const bulletKey = `${coreSectionName}-${entryIdx}-${bulletIdx}`
                        const changes = (changeIndex.bySectionAndBullet.get(bulletKey) || [])
                          .filter(c => getChangeStatus(c.id) !== 'rejected')
                        bulletChanges.push(...changes)
                      })
                    }
                  })
                }
              }
              
              // Combine all actionable changes for this section (already filtered to exclude rejected)
              const actionableChanges = [...sectionChanges, ...bulletChanges]
              
              // REMOVED: Section borders - we use inline highlights like Grammarly, not side borders
              // The highlights are applied inline via renderTextWithChanges
              
              // Check if section content should be hidden (pure addition that was rejected)
              const sectionContent = renderSectionContent(section, idx)
              
              // If section content is null (rejected pure addition), don't render the section at all
              if (sectionContent === null) {
                return null
              }
              
              return (
                <div key={idx}>
                  <h2 className="text-base font-bold text-gray-900 mb-3 border-b-2 border-gray-900 pb-1 font-serif uppercase tracking-wide">
                    {section.title}
                  </h2>
                  {sectionContent}
                </div>
              )
            })}
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
