import { NextRequest, NextResponse } from 'next/server'
import { generateJobId, createJob, updateJob, completeJob, failJob } from '@/lib/jobQueue'
import { calculateBaselineFitScore } from '@/lib/utils/fitScore'

// No maxDuration needed - this returns immediately
export const maxDuration = 10

/**
 * START PREMIUM ANALYSIS - Non-blocking
 *
 * 1. Validates input
 * 2. Creates job with unique ID
 * 3. Starts async orchestration
 * 4. Returns jobId immediately (<200ms)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candidate_resume, job_description, generation_id, session_id } = body

    if (!candidate_resume || !job_description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create job immediately
    const jobId = generateJobId()
    createJob(jobId)

    console.log(`[Premium-Start] Created job ${jobId}, starting async processing...`)

    // Start async processing (don't await!)
    runPremiumAnalysis(jobId, {
      candidate_resume,
      job_description,
      generation_id,
      session_id,
    }).catch((error) => {
      console.error(`[Premium-Start] Async job ${jobId} failed:`, error)
      failJob(jobId, error instanceof Error ? error.message : 'Unknown error')
    })

    // Return immediately
    return NextResponse.json({
      jobId,
      status: 'pending',
      message: 'Analysis started. Poll /api/premium-status?jobId=' + jobId,
    })

  } catch (error) {
    console.error('[Premium-Start] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to start analysis',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * ASYNC PREMIUM ORCHESTRATION
 * This runs in the background without blocking the client
 */
async function runPremiumAnalysis(
  jobId: string,
  params: {
    candidate_resume: string
    job_description: string
    generation_id?: string
    session_id?: string
  }
) {
  const startTime = Date.now()
  const { candidate_resume, job_description, generation_id, session_id } = params

  try {
    updateJob(jobId, { status: 'processing', progress: 0, currentStep: 'Starting...' })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // STEP 1: Parallel - Structural + Baseline (0-20%)
    updateJob(jobId, { progress: 10, currentStep: 'Analyzing structure...' })

    const [structuralRes, baselineResult] = await Promise.allSettled([
      fetch(`${baseUrl}/api/premium-analyzer-structural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalResume: candidate_resume,
          jobDescription: job_description,
        }),
      }),
      calculateBaselineFitScore({
        jobDescription: job_description,
        originalResume: candidate_resume,
      }),
    ])

    if (structuralRes.status !== 'fulfilled') {
      throw new Error('Structural analysis failed')
    }

    const structuralData = await structuralRes.value.json()

    // Check if structural analysis succeeded
    if (!structuralData.analysis) {
      throw new Error(structuralData.error || 'Structural analysis returned no data')
    }

    const structuralAnalysis = structuralData.analysis

    // STEP 2: Strategic (20-40%)
    updateJob(jobId, { progress: 20, currentStep: 'Strategic analysis...' })

    const strategicRes = await fetch(`${baseUrl}/api/premium-analyzer-strategic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalResume: candidate_resume,
        jobDescription: job_description,
        structuralAnalysis,
      }),
    })

    let strategicAnalysis = null
    if (strategicRes.ok) {
      const strategicData = await strategicRes.json()
      strategicAnalysis = strategicData.analysis
    }

    // Merge analysis
    const mergedAnalysis = {
      scope: structuralAnalysis.scope ?? null,
      altitude: structuralAnalysis.altitude ?? null,
      experience: structuralAnalysis.experience ?? [],
      red_flags: structuralAnalysis.red_flags ?? [],
      culture: strategicAnalysis?.culture ?? null,
      metrics: strategicAnalysis?.metrics ?? [],
      summary: strategicAnalysis?.summary ?? null,
      competitive: strategicAnalysis?.competitive ?? null,
    }

    // STEP 3: Generator (40-70%)
    updateJob(jobId, { progress: 40, currentStep: 'Generating optimizations...' })

    const generatorRes = await fetch(`${baseUrl}/api/premium-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalResume: candidate_resume,
        jobDescription: job_description,
        premiumAnalysis: mergedAnalysis,
      }),
    })

    if (!generatorRes.ok) {
      throw new Error('Generator failed')
    }

    const generatorData = await generatorRes.json()

    // STEP 4: Curator (70-90%)
    updateJob(jobId, { progress: 70, currentStep: 'Validating changes...' })

    let curatorData = null
    try {
      const curatorRes = await fetch(`${baseUrl}/api/curator-structured`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'validate',
          changes: generatorData.changes,
          optimizedResume: generatorData.optimizedResume,
          originalResume: candidate_resume,
          jobDescription: job_description,
          analysis: mergedAnalysis,
        }),
      })

      if (curatorRes.ok) {
        curatorData = await curatorRes.json()
      }
    } catch (error) {
      console.warn(`[Job ${jobId}] Curator failed, continuing without validation`)
    }

    // STEP 5: Final fit score (90-95%)
    updateJob(jobId, { progress: 90, currentStep: 'Calculating fit score...' })

    const optimizedResumeText = JSON.stringify(
      curatorData?.validatedOptimizedResume || generatorData.optimizedResume
    )

    const finalFitResult = await calculateBaselineFitScore({
      jobDescription: job_description,
      originalResume: optimizedResumeText,
    })

    // STEP 6: Salary lookup (95-98%)
    updateJob(jobId, { progress: 95, currentStep: 'Looking up salary data...' })

    let salaryData = null
    try {
      const { extractJobTitleAndLocation, lookupSalary } = await import('@/lib/utils/salaryMCP')
      const { role, location } = await extractJobTitleAndLocation(job_description)
      salaryData = await lookupSalary({ role, location })
    } catch (error) {
      console.warn(`[Job ${jobId}] Salary lookup failed`)
    }

    // Build final result
    const baselineFit = baselineResult.status === 'fulfilled'
      ? { fitScore: baselineResult.value.score, breakdown: baselineResult.value.breakdown }
      : { fitScore: 0, breakdown: {} }

    const finalFit = {
      fitScore: finalFitResult.score,
      breakdown: finalFitResult.breakdown,
    }

    const optimizedResume = curatorData?.validatedOptimizedResume || generatorData.optimizedResume

    // Safety check
    if (!optimizedResume?.sections) {
      optimizedResume.sections = []
    }

    const totalTime = Date.now() - startTime

    // Map premium analysis to legacy format for TheBrain component
    const whatWorks = []
    const whatsMissing = []

    // Extract strengths from experience highlights
    if (mergedAnalysis.experience && Array.isArray(mergedAnalysis.experience)) {
      mergedAnalysis.experience.slice(0, 3).forEach(exp => {
        if (exp.highlights && exp.highlights.length > 0) {
          whatWorks.push(exp.highlights[0])
        }
      })
    }

    // Extract gaps from red_flags (they're objects with {type, message, location, severity})
    if (mergedAnalysis.red_flags && Array.isArray(mergedAnalysis.red_flags)) {
      mergedAnalysis.red_flags.slice(0, 3).forEach(flag => {
        if (flag && typeof flag === 'object' && flag.message) {
          whatsMissing.push(flag.message)
        }
      })
    }

    // Build rationale from summary and competitive feedback
    let rationale = 'Analysis completed successfully.'
    if (mergedAnalysis.summary?.draft_summary) {
      rationale = mergedAnalysis.summary.draft_summary
    } else if (mergedAnalysis.competitive?.honest_feedback) {
      rationale = mergedAnalysis.competitive.honest_feedback
    }

    const result = {
      success: true,
      premium_available: true,
      optimizedResume,
      changes: curatorData?.validatedChanges || generatorData.changes,
      analysis: {
        // Legacy fields for TheBrain component compatibility
        whatWorks: whatWorks.length > 0 ? whatWorks : ['Your experience shows relevant background', 'Strong foundation for the role'],
        whatsMissing: whatsMissing.length > 0 ? whatsMissing : [],
        keywordsToTarget: {
          verbs: mergedAnalysis.metrics?.slice(0, 5).map(m => m.question || m.metric_type || '') || [],
          techStack: [],
          concepts: []
        },
        rationaleForChanges: rationale,

        // Fit scores
        fitScoreBefore: baselineFit.fitScore,
        fitScoreAfter: finalFit.fitScore,
        subscores: {
          before: baselineFit.breakdown,
          after: finalFit.breakdown,
        },

        // Premium fields (for future use)
        scope: mergedAnalysis.scope,
        altitude: mergedAnalysis.altitude,
        experience: mergedAnalysis.experience,
        red_flags: mergedAnalysis.red_flags,
        culture: mergedAnalysis.culture,
        metrics: mergedAnalysis.metrics,
        summary: mergedAnalysis.summary,
        competitive: mergedAnalysis.competitive,
      },
      salary: salaryData,
      clarity: curatorData?.clarity ?? null,
      relevance: curatorData?.relevance ?? null,
      honesty: curatorData?.honesty ?? null,
      metadata: {
        generation_id,
        session_id,
        job_metadata: {
          title: 'Position',
          company: 'Company',
          location: 'Location',
        },
        timing: {
          total_ms: totalTime,
        },
        version: 'premium-v2.0-async',
      },
    }

    // Complete job
    completeJob(jobId, result)

    console.log(`[Job ${jobId}] ✅ Completed in ${(totalTime / 1000).toFixed(1)}s`)

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Job ${jobId}] ❌ Failed after ${duration}ms:`, error)
    failJob(jobId, error instanceof Error ? error.message : 'Unknown error')
  }
}
