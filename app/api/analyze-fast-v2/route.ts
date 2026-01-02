import { NextRequest, NextResponse } from 'next/server'
import pLimit from 'p-limit'
import { generateEntryId, extractEntryFingerprint, extractNumbers, calculateOverlap } from '@/lib/utils/entryId'

export const maxDuration = 120

/**
 * FAST MODE V2 - Parallel Entry Processing
 *
 * Architecture:
 * 1. Parse resume into entries
 * 2. Optimize each entry in parallel (4 concurrent max)
 * 3. Validate deterministically (no mixing, no invented facts)
 * 4. Merge and return
 *
 * Benefits:
 * - 3-5x faster (10-15s vs 60s)
 * - No content mixing (by construction)
 * - Graceful degradation (failed entries keep original)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { originalResume, jobDescription, jobTitle, companyName } = body

    if (!originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Fast-V2] ⚡ Starting parallel optimization...')
    const startTime = Date.now()

    // Debug: log first 500 chars of resume
    console.log('[Fast-V2] Resume preview:', originalResume.substring(0, 500))

    // Step 1: Parse resume into entries using LLM (robust to any format)
    const parseResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/parse-resume-structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: originalResume })
    })

    if (!parseResponse.ok) {
      throw new Error(`Resume parsing failed: ${parseResponse.statusText}`)
    }

    const parsed = await parseResponse.json()
    const experienceEntries = parsed.experience_entries || []

    console.log(`[Fast-V2] Parsed ${experienceEntries.length} experience entries`)
    if (experienceEntries.length > 0) {
      console.log('[Fast-V2] First entry:', JSON.stringify(experienceEntries[0], null, 2))
    }

    // Step 2: Generate stable IDs for all entries
    const entriesWithIds = experienceEntries.map((entry: any) => ({
      ...entry,
      entry_id: generateEntryId(entry),
      fingerprint: extractEntryFingerprint(entry),
      originalNumbers: extractNumbers(entry.bullets?.join(' ') || '')
    }))

    // Step 3: Optimize entries in parallel (max 4 concurrent)
    const limit = pLimit(4)
    const optimizationPromises = entriesWithIds.map((entry: any) =>
      limit(() => optimizeEntry(entry, jobDescription))
    )

    const optimizationStart = Date.now()
    const results = await Promise.allSettled(optimizationPromises)
    const optimizationTime = Date.now() - optimizationStart

    console.log(`[Fast-V2] ✅ Parallel optimization completed in ${optimizationTime}ms`)

    // Step 4: Validate and merge
    const validatedEntries = []
    const failedEntries = []
    let allChanges: any[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const originalEntry = entriesWithIds[i]

      if (result.status === 'fulfilled') {
        const optimized = result.value

        // Deterministic validation
        const validation = validateEntry(originalEntry, optimized, entriesWithIds)

        if (validation.valid) {
          validatedEntries.push({
            ...originalEntry,
            bullets: optimized.rewritten_bullets
          })
          allChanges.push(...(optimized.changes || []))
        } else {
          console.warn(`[Fast-V2] ⚠️  Entry ${originalEntry.entry_id} failed validation: ${validation.reason}`)
          // Keep original bullets
          validatedEntries.push(originalEntry)
          failedEntries.push({
            entry_id: originalEntry.entry_id,
            reason: validation.reason
          })
        }
      } else {
        console.error(`[Fast-V2] ❌ Entry ${originalEntry.entry_id} optimization failed:`, result.reason)
        // Keep original bullets
        validatedEntries.push(originalEntry)
        failedEntries.push({
          entry_id: originalEntry.entry_id,
          reason: 'optimization_failed'
        })
      }
    }

    // Step 5: Build optimized resume
    const optimizedResume = {
      contactInfo: {},
      sections: [
        {
          title: 'Summary',
          type: 'summary',
          content: parsed.summary || originalResume.split('\n')[0] // Simple fallback for now
        },
        {
          title: 'Experience',
          type: 'experience',
          content: validatedEntries.map(entry => ({
            company: entry.company,
            role: entry.role,
            dates: entry.dates,
            bullets: entry.bullets
          }))
        },
        ...(parsed.skills ? [{
          title: 'Skills',
          type: 'skills',
          content: parsed.skills
        }] : []),
        ...(parsed.education ? [{
          title: 'Education',
          type: 'education',
          content: parsed.education
        }] : [])
      ]
    }

    const totalTime = Date.now() - startTime

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Fast-V2] ⚡ COMPLETE - Performance Breakdown:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  ⚙️  Parsing:          ${optimizationStart - startTime}ms`)
    console.log(`  🤖 Parallel LLM:     ${optimizationTime}ms`)
    console.log(`  ✅ Validation:       ${Date.now() - (optimizationStart + optimizationTime)}ms`)
    console.log(`  ⏱️  TOTAL TIME:       ${totalTime}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  📊 Entries processed: ${entriesWithIds.length}`)
    console.log(`  ✅ Validated: ${validatedEntries.length - failedEntries.length}`)
    console.log(`  ⚠️  Kept original: ${failedEntries.length}`)
    console.log(`  📝 Total changes: ${allChanges.length}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    return NextResponse.json({
      optimizedResume,
      changes: allChanges,
      analysis: {
        rationaleForChanges: 'Fast Mode V2: Parallel processing with deterministic validation'
      },
      metadata: {
        generation_time_ms: totalTime,
        optimization_time_ms: optimizationTime,
        model: 'claude-sonnet-4-5-20250929',
        mode: 'fast-v2',
        entries_total: entriesWithIds.length,
        entries_failed: failedEntries.length,
        failed_entries: failedEntries,
        job_metadata: {
          title: jobTitle || null,
          company: companyName || null
        }
      }
    })

  } catch (error) {
    console.error('[Fast-V2] Error:', error)
    return NextResponse.json(
      {
        error: 'Fast optimization V2 failed',
        details: error instanceof Error ? error.message : 'Unknown'
      },
      { status: 500 }
    )
  }
}

// Helper: Optimize single entry via API call
async function optimizeEntry(
  entry: any,
  jobDescription: string
): Promise<any> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/optimize-entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entry_id: entry.entry_id,
      company: entry.company,
      role: entry.role,
      dates: entry.dates,
      bullets: entry.bullets,
      jobDescription
    })
  })

  if (!response.ok) {
    throw new Error(`Entry optimization failed: ${response.statusText}`)
  }

  return response.json()
}

// Helper: Validate entry (deterministic)
function validateEntry(
  original: any,
  optimized: any,
  allEntries: any[]
): { valid: boolean; reason?: string } {
  // Check 1: No invented numbers
  const optimizedText = optimized.rewritten_bullets.join(' ')
  const optimizedNumbers = extractNumbers(optimizedText)

  for (const num of optimizedNumbers) {
    if (!original.originalNumbers.includes(num)) {
      return {
        valid: false,
        reason: `invented_number: ${num}`
      }
    }
  }

  // Check 2: No content leakage from other entries
  const optimizedFingerprint = extractEntryFingerprint({
    company: original.company,
    role: original.role,
    bullets: optimized.rewritten_bullets
  })

  const overlapWithOriginal = calculateOverlap(original.fingerprint, optimizedFingerprint)

  // Must have at least 30% overlap with original
  if (overlapWithOriginal < 0.3) {
    return {
      valid: false,
      reason: `low_overlap_with_original: ${Math.round(overlapWithOriginal * 100)}%`
    }
  }

  // Check overlap with OTHER entries (should be low)
  for (const otherEntry of allEntries) {
    if (otherEntry.entry_id === original.entry_id) continue

    const overlapWithOther = calculateOverlap(otherEntry.fingerprint, optimizedFingerprint)

    // Should have less than 40% overlap with other entries
    if (overlapWithOther > 0.4) {
      return {
        valid: false,
        reason: `high_overlap_with_other_entry: ${otherEntry.company} (${Math.round(overlapWithOther * 100)}%)`
      }
    }
  }

  return { valid: true }
}
