import { NextRequest, NextResponse } from 'next/server'
import { calculateFitScore, calculateBaselineFitScore, type FitScoreResult } from '@/lib/utils/fitScore'
import { extractJobTitleAndLocation } from '@/lib/utils/salaryMCP'
import { autoPatchHallucinations } from '@/lib/utils/postprocess'
import { randomUUID } from 'crypto'

// Extract company name from job description
function extractCompanyName(jobDescription: string): string {
  const patterns = [
    /(?:at|@|Company:|Employer:)\s*([A-Z][a-zA-Z\s&.,]+?)(?:\s|,|\.|$)/i,
    /([A-Z][a-zA-Z\s&.,]+?)\s+(?:Inc|Corp|LLC|Ltd|Technologies|Systems|Solutions|Labs|Group)/i
  ]

  for (const pattern of patterns) {
    const match = jobDescription.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  const atPattern = /at\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+in|\s+located|$|,|\.)/i
  const atMatch = jobDescription.match(atPattern)
  if (atMatch && atMatch[1]) {
    return atMatch[1].trim()
  }

  return 'Company'
}

export async function POST(request: NextRequest) {
  const overallStart = Date.now()
  const generationId = randomUUID()
  const sessionId = request.headers.get('x-session-id') || randomUUID()

  try {
    const body = await request.json()
    const { job_description, candidate_resume, creative_mode = 'balanced' } = body

    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Orchestrator] ANTHROPIC_API_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log(`[Orchestrator] Starting two-step resume generation process (generation_id: ${generationId}, session_id: ${sessionId})`)

    // Construct base URL for internal API calls
    const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Parallel prep: Extract job metadata while generator runs (saves ~200-500ms)
    const metadataStart = Date.now()
    const [generatorResponse, jobMeta] = await Promise.all([
      // Step 1: Call generator (main work)
      fetch(`${baseUrl}/api/generator`, {
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
          generation_id: generationId,
          session_id: sessionId
        })
      }),
      // Parallel: Extract job metadata (fast, can run concurrently)
      Promise.all([
        extractJobTitleAndLocation(job_description),
        Promise.resolve(extractCompanyName(job_description))
      ]).then(([{ role, location }, companyName]) => ({
        role,
        location,
        companyName
      }))
    ])

    const metadataTime = Date.now() - metadataStart
    console.log(`[Orchestrator] Job metadata extracted in ${metadataTime}ms: ${jobMeta.role} at ${jobMeta.companyName} in ${jobMeta.location}`)

    if (!generatorResponse.ok) {
      const errorData = await generatorResponse.json()
      console.error('[Orchestrator] Generator failed:', errorData)
      return NextResponse.json(
        { error: 'Generator failed', details: errorData.error || 'Unknown error' },
        { status: generatorResponse.status }
      )
    }

    const generatorStart = Date.now()
    const generatorData = await generatorResponse.json()
    const generatorTime = Date.now() - generatorStart
    console.log(`[Orchestrator] Generator completed in ${generatorTime}ms`)

    // Step 2: Call curator
    const curatorStart = Date.now()
    console.log('[Orchestrator] Step 2: Calling curator (Claude Sonnet)...')
    const curatorResponse = await fetch(`${baseUrl}/api/curator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-generation-id': generationId,
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        generated_resume: generatorData.resume_md,
        original_resume: candidate_resume,
        job_description,
        generator_output: {
          themes_covered: generatorData.themes_covered,
          keywords_used: generatorData.keywords_used
        },
        generation_id: generationId,
        session_id: sessionId
      })
    })

    let evaluation
    let curatorTime: number
    if (!curatorResponse.ok) {
      const errorData = await curatorResponse.json()
      curatorTime = Date.now() - curatorStart
      console.error(`[Orchestrator] Curator failed after ${curatorTime}ms:`, errorData)
      console.warn('[Orchestrator] Continuing without curator evaluation')
      
      // TODO: Future enhancement - Queue curator retry for background processing
      // This allows fast user feedback while deeper evaluation continues asynchronously
      // Example: await inngest.send({ name: 'curator/retry', data: { generation_id, ... } })
      
      evaluation = {
        clarity: 75,
        relevance: 75,
        honesty: 75,
        feedback: 'Evaluation service unavailable'
      }
    } else {
      evaluation = await curatorResponse.json()
      curatorTime = Date.now() - curatorStart
      console.log(`[Orchestrator] Curator completed in ${curatorTime}ms`)
    }

    console.log('[Orchestrator] Curator evaluation:', {
      clarity: evaluation.clarity,
      relevance: evaluation.relevance,
      honesty: evaluation.honesty,
      revision_applied: evaluation.revision_applied || false
    })

    // Use revised resume if curator provided one, otherwise use generator output
    let resumeMd = evaluation.revised_resume || generatorData.resume_md
    
    if (evaluation.revision_applied && evaluation.revised_resume) {
      console.log('[Orchestrator] Using curator-revised resume')
    }

    // Post-processor: Auto-patch hallucinations (on final resume)
    const patchStart = Date.now()
    const patchedResume = autoPatchHallucinations(resumeMd, candidate_resume)
    if (patchedResume !== resumeMd) {
      const patchTime = Date.now() - patchStart
      console.log(`[Orchestrator] Auto-patched hallucinated numbers in ${patchTime}ms`)
      resumeMd = patchedResume
    }

    // Calculate fit score
    const fitScoreStart = Date.now()
    console.log('[Orchestrator] Calculating fit score...')
    const fitScore = await calculateFitScore({
      jobDescription: job_description,
      candidateResume: candidate_resume,
      generatedResume: resumeMd,
      keywordsUsed: generatorData.keywords_used || [],
      themesCovered: generatorData.themes_covered || []
    })
    const fitScoreTime = Date.now() - fitScoreStart
    console.log(`[Orchestrator] Fit score calculated in ${fitScoreTime}ms`)

    const normalizedScore = Math.max(1, Math.min(100, Number.isFinite(fitScore.score) ? fitScore.score : 0))
    if (normalizedScore !== fitScore.score) {
      console.warn('[Orchestrator] Adjusted fit score to normalized range:', { original: fitScore.score, normalized: normalizedScore })
    }

    // Calculate baseline fit score
    const baselineStart = Date.now()
    let baseline: FitScoreResult
    try {
      baseline = await calculateBaselineFitScore({
        jobDescription: job_description,
        originalResume: candidate_resume
      })
      const baselineTime = Date.now() - baselineStart
      console.log(`[Orchestrator] Baseline fit score calculated in ${baselineTime}ms`)
    } catch (e) {
      console.warn('[Orchestrator] Baseline fit score failed, using estimate:', e)
      baseline = {
        score: Math.max(0, normalizedScore - 10),
        breakdown: fitScore.breakdown,
        explanation: 'Estimated baseline (scoring service unavailable)'
      }
    }

    // Use pre-extracted job metadata (already available from parallel prep)
    const { role, location, companyName } = jobMeta

    // Build insights response (matching frontend expectations)
    const insights: any = {}

    // Salary insight
    if (generatorData.salary_data) {
      const salaryData = generatorData.salary_data
      insights.salary = {
        median: salaryData.median,
        range: [salaryData.low, salaryData.high],
        location,
        role,
        comment: `Typical salary in ${location}: $${salaryData.median.toLocaleString()} (range $${salaryData.low.toLocaleString()}–$${salaryData.high.toLocaleString()}).`
      }
    }

    // Fit insight (before/after)
    const scoreAfter = normalizedScore
    insights.fit = {
      score_before: baseline.score,
      score_after: Math.max(1, Math.min(100, scoreAfter)),
      subscores: {
        before: baseline.breakdown,
        after: fitScore.breakdown
      },
      summary: fitScore.explanation || 'Unable to calculate fit score'
    }

    // Other insights
    insights.keywords = generatorData.keywords_used || []
    insights.themes = generatorData.themes_covered || []
    insights.optimizations = generatorData.changes_made || []

    // Add evaluation insights from curator
    if (evaluation) {
      insights.evaluation = {
        clarity: evaluation.clarity,
        relevance: evaluation.relevance,
        honesty: evaluation.honesty,
        feedback: evaluation.feedback
      }

      // Add review notes if honesty score is low
      if (evaluation.honesty < 80) {
        insights.review_notes = [evaluation.feedback]
      }
    }

    const responsePayload = {
      insights,
      optimized_resume: resumeMd || '',
      raw_resume: candidate_resume,
      generation: {
        resume_md: resumeMd,
        fit_summary: generatorData.fit_summary,
        changes_made: generatorData.changes_made,
        keywords_used: generatorData.keywords_used,
        themes_covered: generatorData.themes_covered
      },
      evaluation: evaluation || null,
      // Metadata for tracking and future Supabase integration
      metadata: {
        generation_id: generationId,
        session_id: sessionId,
        job_metadata: {
          title: role,
          company: companyName,
          location: location
        },
        timing: {
          total_ms: Date.now() - overallStart,
          generator_ms: generatorTime,
          curator_ms: curatorTime,
          metadata_extraction_ms: metadataTime
        }
      }
    }

    const totalTime = Date.now() - overallStart
    console.log(`[Orchestrator] Process complete in ${totalTime}ms. Returning combined response.`)

    return NextResponse.json(responsePayload)

  } catch (error) {
    const totalTime = Date.now() - overallStart
    console.error(`[Orchestrator] API error after ${totalTime}ms:`, error)
    
    return NextResponse.json(
      {
        error: 'Failed to generate resume',
        details: error instanceof Error ? error.message : 'Unknown error',
        generation_id: generationId,
        session_id: sessionId
      },
      { status: 500 }
    )
  }
}
