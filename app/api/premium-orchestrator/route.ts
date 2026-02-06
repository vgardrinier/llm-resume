import { NextRequest, NextResponse } from 'next/server'
import { calculateBaselineFitScore } from '@/lib/utils/fitScore'

// Increase timeout for long-running premium analysis
export const maxDuration = 120 // 120 seconds for premium flow

/**
 * PREMIUM ORCHESTRATOR - Coordinates 2-Call Analysis
 *
 * Flow:
 * 1. Parallel: Structural analysis (Haiku, 10s) + Baseline fit (4s)
 * 2. Sequential: Strategic analysis (Sonnet 4, 25s) using structural output
 * 3. Generator (Haiku, 20s) using merged analysis
 * 4. Curator (Haiku, 15s) validates changes
 * 5. Final fit score
 *
 * Total target: 60-80s
 */

const STRUCTURAL_TIMEOUT_MS = 20000 // 20s max for Haiku extraction
const STRATEGIC_TIMEOUT_MS = 35000  // 35s max for Sonnet 4 reasoning
const BASELINE_TIMEOUT_MS = 15000   // 15s max for baseline fit

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms
    )

    promise
      .then((res) => {
        clearTimeout(timeoutId)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        reject(err)
      })
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { candidate_resume, job_description, generation_id, session_id } = body

    if (!candidate_resume || !job_description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Premium-Orchestrator] Starting premium flow...', { generation_id })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // STEP 1: Parallel execution - Structural + Baseline Fit
    const structuralPromise = withTimeout(
      fetch(`${baseUrl}/api/premium-analyzer-structural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalResume: candidate_resume,
          jobDescription: job_description
        })
      }),
      STRUCTURAL_TIMEOUT_MS,
      'Structural analyzer'
    )

    const baselinePromise = withTimeout(
      calculateBaselineFitScore({
        jobDescription: job_description,
        originalResume: candidate_resume
      }),
      BASELINE_TIMEOUT_MS,
      'Baseline fit'
    )

    const [structuralResult, baselineResult] = await Promise.allSettled([
      structuralPromise,
      baselinePromise
    ])

    const parallelTime = Date.now() - startTime

    // Handle structural analyzer failure
    if (structuralResult.status !== 'fulfilled') {
      console.error('[Premium-Orchestrator] Structural failed:', structuralResult.reason)
      return NextResponse.json(
        {
          premium_available: false,
          error: 'Structural analysis failed',
          baseline_fit: baselineResult.status === 'fulfilled' ? baselineResult.value : null
        },
        { status: 500 }
      )
    }

    const structuralResponse = await structuralResult.value.json()
    const structuralAnalysis = structuralResponse.analysis

    if (!structuralAnalysis) {
      throw new Error('Structural analysis returned empty')
    }

    console.log(`[Premium-Orchestrator] Step 1 complete (${parallelTime}ms)`, {
      structural: 'received',
      baseline: baselineResult.status === 'fulfilled' ? 'received' : 'failed'
    })

    // STEP 2: Strategic analyzer (sequential, depends on structural)
    const strategicStart = Date.now()
    let strategicAnalysis = null

    try {
      const strategicResponse = await withTimeout(
        fetch(`${baseUrl}/api/premium-analyzer-strategic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalResume: candidate_resume,
            jobDescription: job_description,
            structuralAnalysis
          })
        }),
        STRATEGIC_TIMEOUT_MS,
        'Strategic analyzer'
      )

      if (strategicResponse.ok) {
        const strategicJson = await strategicResponse.json()
        strategicAnalysis = strategicJson.analysis
        const strategicTime = Date.now() - strategicStart
        console.log(`[Premium-Orchestrator] Step 2 complete (${strategicTime}ms)`)
      } else {
        console.error('[Premium-Orchestrator] Strategic HTTP error:', strategicResponse.status)
      }
    } catch (error) {
      console.error('[Premium-Orchestrator] Strategic failed:', error)
      // Continue without strategic analysis - we have structural
    }

    // STEP 3: Call generator with merged analysis
    const generatorStart = Date.now()

    // Merge structural + strategic into single analysis object
    const mergedAnalysis = {
      // Structural data
      scope: structuralAnalysis.scope ?? null,
      altitude: structuralAnalysis.altitude ?? null,
      experience: structuralAnalysis.experience ?? [],
      red_flags: structuralAnalysis.red_flags ?? [],

      // Strategic data (if available)
      culture: strategicAnalysis?.culture ?? null,
      metrics: strategicAnalysis?.metrics ?? [],
      summary: strategicAnalysis?.summary ?? null,
      competitive: strategicAnalysis?.competitive ?? null
    }

    const generatorResponse = await fetch(`${baseUrl}/api/premium-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalResume: candidate_resume,
        jobDescription: job_description,
        premiumAnalysis: mergedAnalysis
      })
    })

    const generatorResult = await generatorResponse.json()
    const generatorTime = Date.now() - generatorStart

    console.log(`[Premium-Orchestrator] Generator complete (${generatorTime}ms)`, {
      changesCount: generatorResult.changes?.length
    })

    if (!generatorResult.optimizedResume || !generatorResult.changes) {
      throw new Error('Generator failed')
    }

    // STEP 4: Curator validation (with fallback)
    const curatorStart = Date.now()
    let curatorResult = null
    let curatorTime = 0

    try {
      const curatorResponse = await fetch(`${baseUrl}/api/curator-structured`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'validate',
          changes: generatorResult.changes,
          optimizedResume: generatorResult.optimizedResume,
          originalResume: candidate_resume,
          jobDescription: job_description,
          analysis: mergedAnalysis
        })
      })

      if (curatorResponse.ok) {
        curatorResult = await curatorResponse.json()
        curatorTime = Date.now() - curatorStart
        console.log(`[Premium-Orchestrator] Curator complete (${curatorTime}ms)`, {
          validatedCount: curatorResult.validatedChanges?.length
        })
      } else {
        console.error('[Premium-Orchestrator] Curator HTTP error:', curatorResponse.status)
      }
    } catch (error) {
      curatorTime = Date.now() - curatorStart
      console.error('[Premium-Orchestrator] Curator failed:', error)
      // Continue without curator validation - use generator results directly
    }

    // STEP 5: Final fit score
    const finalFitStart = Date.now()
    const optimizedResumeText = JSON.stringify(
      curatorResult?.validatedOptimizedResume || generatorResult.optimizedResume
    )

    const finalFitResult = await calculateBaselineFitScore({
      jobDescription: job_description,
      originalResume: optimizedResumeText
    })

    const finalFitTime = Date.now() - finalFitStart

    // Extract baseline fit scores
    const baselineFit = baselineResult.status === 'fulfilled'
      ? { fitScore: baselineResult.value.score, breakdown: baselineResult.value.breakdown }
      : { fitScore: 0, breakdown: {} }

    const finalFit = {
      fitScore: finalFitResult.score,
      breakdown: finalFitResult.breakdown
    }

    console.log(`[Premium-Orchestrator] Final fit (${finalFitTime}ms)`, {
      before: baselineFit.fitScore,
      after: finalFit.fitScore,
      improvement: finalFit.fitScore - baselineFit.fitScore
    })

    // STEP 6: Salary lookup
    let salaryData = null
    try {
      const { extractJobTitleAndLocation, lookupSalary } = await import('@/lib/utils/salaryMCP')
      const { role, location } = await extractJobTitleAndLocation(job_description)
      salaryData = await lookupSalary({ role, location })
      console.log('[Premium-Orchestrator] Salary:', salaryData?.median || 'N/A')
    } catch (error) {
      console.warn('[Premium-Orchestrator] Salary lookup failed:', error)
    }

    const totalTime = Date.now() - startTime

    // Ensure optimizedResume has required structure
    const optimizedResume = curatorResult?.validatedOptimizedResume || generatorResult.optimizedResume

    // Safety check: ensure sections array exists
    if (!optimizedResume?.sections) {
      console.warn('[Premium-Orchestrator] optimizedResume missing sections, using fallback')
      optimizedResume.sections = []
    }

    // NORMALIZED RESPONSE
    return NextResponse.json({
      success: true,
      premium_available: true,

      // Resume data
      optimizedResume,
      changes: curatorResult?.validatedChanges || generatorResult.changes,

      // Analysis (normalized structure)
      analysis: {
        ...mergedAnalysis,
        fitScoreBefore: baselineFit.fitScore,
        fitScoreAfter: finalFit.fitScore,
        subscores: {
          before: baselineFit.breakdown,
          after: finalFit.breakdown
        }
      },

      // Salary data
      salary: salaryData,

      // Quality metrics
      clarity: curatorResult?.clarity ?? null,
      relevance: curatorResult?.relevance ?? null,
      honesty: curatorResult?.honesty ?? null,

      // Metadata
      metadata: {
        generation_id,
        session_id,
        job_metadata: {
          title: 'Position',
          company: 'Company',
          location: 'Location'
        },
        timing: {
          total_ms: totalTime,
          structural_ms: parallelTime,
          strategic_ms: strategicAnalysis ? (Date.now() - strategicStart - generatorTime - curatorTime - finalFitTime) : null,
          generator_ms: generatorTime,
          curator_ms: curatorTime,
          fit_score_ms: finalFitTime
        },
        version: 'premium-v2.0-disciplined'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Premium-Orchestrator] Error:', error)
    return NextResponse.json(
      {
        error: 'Premium orchestration failed',
        details: error instanceof Error ? error.message : 'Unknown',
        duration_ms: duration
      },
      { status: 500 }
    )
  }
}
