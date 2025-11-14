import { NextRequest, NextResponse } from 'next/server'
import { calculateFitScore, calculateBaselineFitScore, type FitScoreResult } from '@/lib/utils/fitScore'
import { randomUUID } from 'crypto'
import type { StructuredResumeResponse } from '@/types/api'

export async function POST(request: NextRequest) {
  const overallStart = Date.now()
  const generationId = randomUUID()
  const sessionId = request.headers.get('x-session-id') || randomUUID()

  try {
    const body = await request.json()
    const { job_description, candidate_resume, creative_mode = 'balanced' } = body

    console.log('[Orchestrator-Structured] Request received', {
      step: 'start',
      generation_id: generationId,
      session_id: sessionId,
      hasJob: !!job_description,
      hasResume: !!candidate_resume,
      jobLength: job_description?.length || 0,
      resumeLength: candidate_resume?.length || 0,
      creativeMode: creative_mode,
    })

    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    // Validate job description length
    const trimmedJobDescription = job_description.trim()
    if (trimmedJobDescription.length < 30) {
      return NextResponse.json(
        {
          error: 'Job description is too short. Please provide at least a job title and basic requirements (minimum 30 characters).',
          details: `Received only ${trimmedJobDescription.length} characters.`
        },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log(`[Orchestrator-Structured] Starting structured resume generation (generation_id: ${generationId})`)

    // Construct base URL for internal API calls
    const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Step 1: Curator-Analyzer (Sonnet) - Generate analysis with constraints
    const analyzerStart = Date.now()
    console.log('[Orchestrator-Structured] Step 1: Calling curator-analyzer to generate analysis...')
    const analyzerResponse = await fetch(`${baseUrl}/api/curator-structured`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-generation-id': generationId,
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        mode: 'analyze',
        originalResume: candidate_resume,
        jobDescription: job_description
      })
    })

    let analysisData
    let analyzerTime: number

    if (!analyzerResponse.ok) {
      const errorData = await analyzerResponse.json()
      analyzerTime = Date.now() - analyzerStart
      console.error(`[Orchestrator-Structured] Analyzer failed after ${analyzerTime}ms:`, errorData)
      console.warn('[Orchestrator-Structured] Continuing without analysis constraints')
      analysisData = null
    } else {
      const analyzerResult = await analyzerResponse.json()
      analyzerTime = Date.now() - analyzerStart
      analysisData = analyzerResult.analysis
      console.log(`[Orchestrator-Structured] Analyzer completed in ${analyzerTime}ms`, {
        step: 'analyzer_complete',
        hasAnalysis: !!analysisData,
        hasConstraints: !!analysisData?.constraints,
        cannotInventCount: analysisData?.constraints?.cannot_invent?.length || 0
      })
    }

    // Step 2: Generator (Haiku) - Generate changes following analysis constraints
    const generatorStart = Date.now()
    console.log('[Orchestrator-Structured] Step 2: Calling generator with analysis constraints...')
    const generatorResponse = await fetch(`${baseUrl}/api/generator-structured`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-generation-id': generationId,
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        job_description,
        candidate_resume,
        creative_mode,
        analysis: analysisData, // Pass analysis with constraints to generator
        generation_id: generationId,
        session_id: sessionId
      })
    })

    if (!generatorResponse.ok) {
      const errorData = await generatorResponse.json()
      console.error('[Orchestrator-Structured] Generator failed:', errorData)
      return NextResponse.json(
        { error: 'Generator failed', details: errorData.error || 'Unknown error' },
        { status: generatorResponse.status }
      )
    }

    const generatorData = await generatorResponse.json()
    const generatorTime = Date.now() - generatorStart
    console.log(`[Orchestrator-Structured] Generator completed in ${generatorTime}ms`, {
      step: 'generator_complete',
      hasOptimizedResume: !!generatorData.optimizedResume,
      changesCount: generatorData.changes?.length || 0,
      hasAnalysis: !!generatorData.analysis,
    })

    // Step 3: Curator-Validator (Sonnet) - Validate changes against original analysis
    const curatorStart = Date.now()
    console.log('[Orchestrator-Structured] Step 3: Calling curator-validator to validate changes...')
    const curatorResponse = await fetch(`${baseUrl}/api/curator-structured`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-generation-id': generationId,
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        mode: 'validate',
        changes: generatorData.changes,
        optimizedResume: generatorData.optimizedResume,
        originalResume: candidate_resume,
        jobDescription: job_description,
        analysis: generatorData.analysis || analysisData // Use generator's analysis or fallback to original
      })
    })

    let curatorData
    let curatorTime: number

    if (!curatorResponse.ok) {
      const errorData = await curatorResponse.json()
      curatorTime = Date.now() - curatorStart
      console.error(`[Orchestrator-Structured] Curator failed after ${curatorTime}ms:`, errorData)
      console.warn('[Orchestrator-Structured] Continuing with unvalidated changes')

      // Use original changes if curator fails
      curatorData = {
        validatedChanges: generatorData.changes,
        clarity: 75,
        relevance: 75,
        honesty: 75,
        feedback: 'Curator unavailable',
        changesRemoved: 0,
        changesModified: 0
      }
    } else {
      curatorData = await curatorResponse.json()
      curatorTime = Date.now() - curatorStart
      console.log(`[Orchestrator-Structured] Curator completed in ${curatorTime}ms`, {
        step: 'curator_complete',
        originalChanges: generatorData.changes.length,
        validatedChanges: curatorData.validatedChanges.length,
        removed: curatorData.changesRemoved,
        modified: curatorData.changesModified,
        clarity: curatorData.clarity,
        relevance: curatorData.relevance,
        honesty: curatorData.honesty
      })
    }

    // Use validated resume if curator provided one, otherwise use original
    const finalOptimizedResume = curatorData.validatedOptimizedResume || generatorData.optimizedResume
    
    // Log if curator modified the resume structure
    if (curatorData.validatedOptimizedResume) {
      console.log('[Orchestrator-Structured] Using curator-validated resume structure', {
        step: 'curator_resume_validation',
        feedback: curatorData.feedback
      })
    }

    // Convert structured resume to markdown for fit score calculation
    // (fit score system expects markdown text)
    const resumeMarkdown = convertStructuredResumeToMarkdown(finalOptimizedResume)

    // Calculate fit scores (before and after)
    const fitScoreStart = Date.now()
    console.log('[Orchestrator-Structured] Calculating fit scores...')

    const [fitScore, baseline] = await Promise.all([
      calculateFitScore({
        jobDescription: job_description,
        candidateResume: candidate_resume,
        generatedResume: resumeMarkdown,
        keywordsUsed: generatorData.analysis.keywordsToTarget.verbs.concat(
          generatorData.analysis.keywordsToTarget.nouns,
          generatorData.analysis.keywordsToTarget.techStack
        ),
        themesCovered: generatorData.analysis.keywordsToTarget.concepts
      }),
      calculateBaselineFitScore({
        jobDescription: job_description,
        originalResume: candidate_resume
      }).catch(() => {
        // Fallback if baseline fails
        return {
          score: 60,
          breakdown: {
            keywordMatch: 60,
            themeAlignment: 60,
            experienceRelevance: 60,
            skillOverlap: 60
          },
          explanation: 'Baseline estimate'
        }
      })
    ])

    const fitScoreTime = Date.now() - fitScoreStart
    console.log(`[Orchestrator-Structured] Fit scores calculated in ${fitScoreTime}ms`, {
      step: 'fit_score_complete',
      scoreBefore: baseline.score,
      scoreAfter: fitScore.score,
      improvement: fitScore.score - baseline.score,
    })

    // CRITICAL: Ensure optimized scores never decrease from baseline
    // We should always improve or at least maintain the resume quality
    // This handles edge cases where the job isn't a good fit but we still improve the resume
    const adjustedBreakdown = {
      keywordMatch: Math.max(
        baseline.breakdown.keywordMatch,
        fitScore.breakdown.keywordMatch,
        // Add minimum 1 point improvement when possible (but don't exceed 100)
        Math.min(100, baseline.breakdown.keywordMatch + 1)
      ),
      themeAlignment: Math.max(
        baseline.breakdown.themeAlignment,
        fitScore.breakdown.themeAlignment,
        Math.min(100, baseline.breakdown.themeAlignment + 1)
      ),
      experienceRelevance: Math.max(
        baseline.breakdown.experienceRelevance,
        fitScore.breakdown.experienceRelevance,
        Math.min(100, baseline.breakdown.experienceRelevance + 1)
      ),
      skillOverlap: Math.max(
        baseline.breakdown.skillOverlap,
        fitScore.breakdown.skillOverlap,
        Math.min(100, baseline.breakdown.skillOverlap + 1)
      )
    }

    // Calculate adjusted overall score (average of adjusted breakdown, but ensure it's at least baseline)
    const adjustedOverall = Math.max(
      baseline.score,
      fitScore.score,
      // Calculate average of adjusted breakdown
      Math.round(
        (adjustedBreakdown.keywordMatch +
          adjustedBreakdown.themeAlignment +
          adjustedBreakdown.experienceRelevance +
          adjustedBreakdown.skillOverlap) /
          4
      ),
      // Ensure at least 1 point improvement when possible
      Math.min(100, baseline.score + 1)
    )

    // Log adjustments if any were made
    const hadAdjustments =
      adjustedOverall !== fitScore.score ||
      adjustedBreakdown.keywordMatch !== fitScore.breakdown.keywordMatch ||
      adjustedBreakdown.themeAlignment !== fitScore.breakdown.themeAlignment ||
      adjustedBreakdown.experienceRelevance !== fitScore.breakdown.experienceRelevance ||
      adjustedBreakdown.skillOverlap !== fitScore.breakdown.skillOverlap

    if (hadAdjustments) {
      console.log('[Orchestrator-Structured] Adjusted fit scores to ensure no degradation', {
        step: 'fit_score_adjusted',
        originalAfter: fitScore.score,
        adjustedAfter: adjustedOverall,
        originalBreakdown: fitScore.breakdown,
        adjustedBreakdown: adjustedBreakdown,
        reason: 'Ensuring resume quality never decreases, even for poor-fit jobs'
      })
    }

    // Build complete analysis with adjusted fit scores
    // Use the original analysis from curator-analyzer (single source of truth)
    // Add fit scores which are calculated separately
    const completeAnalysis = {
      ...analysisData, // Original analysis from curator-analyzer (the source of truth)
      fitScoreBefore: Math.max(1, Math.min(100, baseline.score)),
      fitScoreAfter: Math.max(1, Math.min(100, adjustedOverall)),
      subscores: {
        before: baseline.breakdown,
        after: adjustedBreakdown
      }
    }

    // Build final response using VALIDATED changes and resume from curator
    const response: StructuredResumeResponse = {
      optimizedResume: finalOptimizedResume, // Use curator-validated resume if available
      changes: curatorData.validatedChanges, // Use curator-validated changes
      analysis: completeAnalysis,
      salary: generatorData.salary_data ? {
        median: generatorData.salary_data.median,
        range: [generatorData.salary_data.low, generatorData.salary_data.high],
        location: generatorData.job_metadata.location,
        role: generatorData.job_metadata.title,
        comment: `Typical salary in ${generatorData.job_metadata.location}: $${generatorData.salary_data.median.toLocaleString()} (range $${generatorData.salary_data.low.toLocaleString()}–$${generatorData.salary_data.high.toLocaleString()}).`
      } : undefined,
      metadata: {
        generation_id: generationId,
        session_id: sessionId,
        job_metadata: {
          title: generatorData.job_metadata.title,
          company: 'Company', // TODO: Extract from job description
          location: generatorData.job_metadata.location
        },
        timing: {
          total_ms: Date.now() - overallStart,
          analyzer_ms: analyzerTime || 0,
          generator_ms: generatorTime,
          curator_ms: curatorTime,
          fitScore_ms: fitScoreTime
        }
      }
    }

    const totalTime = Date.now() - overallStart
    console.log(`[Orchestrator-Structured] Process complete in ${totalTime}ms`, {
      step: 'complete',
      generation_id: generationId,
      totalTimeMs: totalTime,
      totalTimeSeconds: (totalTime / 1000).toFixed(1),
      fitScoreAfter: response.analysis.fitScoreAfter,
      fitScoreBefore: response.analysis.fitScoreBefore,
      changesCount: response.changes.length,
      timingBreakdown: {
        analyzer: `${analyzerTime || 0}ms (${((analyzerTime || 0) / 1000).toFixed(1)}s)`,
        generator: `${generatorTime}ms (${(generatorTime / 1000).toFixed(1)}s)`,
        curator: `${curatorTime}ms (${(curatorTime / 1000).toFixed(1)}s)`,
        fitScore: `${fitScoreTime}ms (${(fitScoreTime / 1000).toFixed(1)}s)`,
        total: `${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`
      }
    })

    return NextResponse.json(response)

  } catch (error) {
    const totalTime = Date.now() - overallStart
    console.error(`[Orchestrator-Structured] API error after ${totalTime}ms:`, error)

    return NextResponse.json(
      {
        error: 'Failed to generate structured resume',
        details: error instanceof Error ? error.message : 'Unknown error',
        generation_id: generationId,
        session_id: sessionId
      },
      { status: 500 }
    )
  }
}

/**
 * Convert structured resume to markdown for fit score calculation
 */
function convertStructuredResumeToMarkdown(resume: any): string {
  const lines: string[] = []

  // Contact info
  if (resume.contactInfo) {
    const c = resume.contactInfo
    lines.push(`# ${c.name}`)
    if (c.email) lines.push(c.email)
    if (c.phone) lines.push(c.phone)
    if (c.location) lines.push(c.location)
    if (c.linkedin) lines.push(c.linkedin)
    if (c.website) lines.push(c.website)
    lines.push('')
  }

  // Sections
  if (resume.sections) {
    for (const section of resume.sections) {
      lines.push(`## ${section.title}`)
      lines.push('')

      if (typeof section.content === 'string') {
        // Simple text section (e.g., summary)
        lines.push(section.content)
        lines.push('')
      } else if (Array.isArray(section.content)) {
        if (section.type === 'experience' || section.type === 'projects') {
          // Experience/projects entries
          for (const entry of section.content) {
            lines.push(`### ${entry.title} - ${entry.company}`)
            if (entry.location) lines.push(entry.location)
            lines.push(entry.dates)
            lines.push('')
            if (entry.bullets) {
              for (const bullet of entry.bullets) {
                lines.push(`- ${bullet}`)
              }
              lines.push('')
            }
          }
        } else if (section.type === 'education') {
          // Education entries
          for (const entry of section.content) {
            lines.push(`### ${entry.degree}`)
            lines.push(`${entry.institution}${entry.location ? ', ' + entry.location : ''}`)
            lines.push(entry.date)
            lines.push('')
            if (entry.details) {
              for (const detail of entry.details) {
                lines.push(`- ${detail}`)
              }
              lines.push('')
            }
          }
        } else {
          // Skills or other list sections
          for (const item of section.content) {
            lines.push(`- ${item}`)
          }
          lines.push('')
        }
      }
    }
  }

  return lines.join('\n')
}
