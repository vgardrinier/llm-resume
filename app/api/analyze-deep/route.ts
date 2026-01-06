import { NextRequest, NextResponse } from 'next/server'
import { generateJobId, createJob, updateJob, completeJob, failJob } from '@/lib/jobQueue'
import { calculateBaselineFitScore } from '@/lib/utils/fitScore'

// Allow up to 5 minutes for deep analysis (synchronous)
export const maxDuration = 300

/**
 * DEEP ANALYSIS - Synchronous
 * 
 * Formerly "Premium" analysis.
 * Now runs synchronously to avoid serverless termination issues.
 * Returns full analysis + optimized resume.
 */

export async function POST(request: NextRequest) {
  let jobId = 'pending'
  try {
    const body = await request.json()
    const { candidate_resume, job_description, generation_id, session_id, jobId: providedJobId } = body

    // Extract job metadata from request body (matches fast mode pattern)
    const jobTitle = body.job_title || body.jobTitle || 'Position'
    const companyName = body.company || body.companyName || null
    const location = body.location || null

    if (!candidate_resume || !job_description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use provided jobId or generate a new one
    jobId = providedJobId || generateJobId()
    
    console.log(`[Deep-Analysis] Starting sync job ${jobId}...`)

    // Initialize job in queue so it can be polled
    createJob(jobId)
    updateJob(jobId, { 
      status: 'processing',
      progress: 5,
      currentStep: 'Initializing analysis...'
    })

    // Run analysis synchronously
    const result = await runDeepAnalysis(jobId, {
      candidate_resume,
      job_description,
      generation_id,
      session_id,
      job_title: jobTitle,
      company: companyName,
      location,
    })

    // Finalize job status
    completeJob(jobId, result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[Deep-Analysis] Error:', error)
    
    // Mark job as failed in queue so polling clients know
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (jobId !== 'pending') {
      failJob(jobId, errorMessage)
    }

    return NextResponse.json(
      {
        error: 'Failed to complete analysis',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * SYNCHRONOUS ORCHESTRATION
 */
async function runDeepAnalysis(
  jobId: string,
  params: {
    candidate_resume: string
    job_description: string
    generation_id?: string
    session_id?: string
    job_title?: string
    company?: string | null
    location?: string | null
  }
) {
  const startTime = Date.now()
  const { candidate_resume, job_description, generation_id, session_id, job_title, company, location } = params

  try {
    // For sync mode, we still log steps for observability in server logs
    console.log(`[Job ${jobId}] Starting structural analysis...`)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // STEP 1: Parallel - Structural + Baseline (0-20%)
    console.log(`[Job ${jobId}] Analyzing structure & baseline...`)
    updateJob(jobId, { progress: 10, currentStep: 'Analyzing résumé structure...' })

    const [structuralRes, baselineResult] = await Promise.allSettled([
      fetch(`${baseUrl}/api/analyzer-structural`, {
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

    // Store baseline fit score immediately (available ~5s in)
    if (baselineResult.status === 'fulfilled') {
      console.log(`[Job ${jobId}] Baseline fit score available:`, baselineResult.value.score)
      updateJob(jobId, { 
        baselineFit: {
          overallScore: baselineResult.value.score,
          breakdown: baselineResult.value.breakdown
        }
      })
    }

    if (structuralRes.status !== 'fulfilled') {
      throw new Error('Structural analysis failed')
    }

    const structuralData = await structuralRes.value.json()

    // Check if structural analysis succeeded
    if (!structuralData.analysis) {
      throw new Error(structuralData.error || 'Structural analysis returned no data')
    }

    const structuralAnalysis = structuralData.analysis
    updateJob(jobId, { progress: 30, currentStep: 'Strategic analysis...' })

    // STEP 2: Strategic (20-40%)
    console.log(`[Job ${jobId}] Strategic analysis...`)

    const strategicRes = await fetch(`${baseUrl}/api/analyzer-strategic`, {
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
    console.log(`[Job ${jobId}] Generating optimizations...`)
    updateJob(jobId, { progress: 50, currentStep: 'Generating improvements...' })

    const generatorRes = await fetch(`${baseUrl}/api/generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalResume: candidate_resume,
        jobDescription: job_description,
        analysis: mergedAnalysis,
      }),
    })

    if (!generatorRes.ok) {
      throw new Error('Generator failed')
    }

    const generatorData = await generatorRes.json()

    // STEP 4: Curator (70-90%)
    console.log(`[Job ${jobId}] Validating changes...`)
    updateJob(jobId, { progress: 75, currentStep: 'Finalizing optimizations...' })

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

    let optimizedResume = curatorData?.validatedOptimizedResume || generatorData.optimizedResume

    // Safety check: ensure optimizedResume exists and has sections
    if (!optimizedResume) {
      optimizedResume = { 
        contactInfo: { name: 'Applicant' }, 
        sections: [] 
      }
    } else if (!optimizedResume.sections) {
      optimizedResume.sections = []
    }

    // STEP 5: Final fit score (90-95%)
    console.log(`[Job ${jobId}] Calculating fit score...`)
    updateJob(jobId, { progress: 90, currentStep: 'Calculating final fit score...' })

    const optimizedResumeText = JSON.stringify(optimizedResume)

    const finalFitResult = await calculateBaselineFitScore({
      jobDescription: job_description,
      originalResume: optimizedResumeText,
    })

    // STEP 6: Salary lookup (95-98%)
    console.log(`[Job ${jobId}] Looking up salary data...`)
    updateJob(jobId, { progress: 95, currentStep: 'Researching market salary...' })


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

    const totalTime = Date.now() - startTime

    // Map analysis to diagnostic panel format
    const whatWorks: string[] = []
    const whatsMissing: string[] = []
    const jobThemes: string[] = []
    const resumeThemes: string[] = []
    const missingThemes: string[] = []

    // 1. STRENGTHS WE FOUND
    // From culture.mappable_resume_signals
    if (mergedAnalysis.culture?.mappable_resume_signals && Array.isArray(mergedAnalysis.culture.mappable_resume_signals)) {
      mergedAnalysis.culture.mappable_resume_signals.slice(0, 4).forEach((signal: any) => {
        if (signal && signal.theme) {
          whatWorks.push(`Strong ${signal.theme.toLowerCase()} signals${signal.bullet_hint ? `: "${signal.bullet_hint}"` : ''}`)
        }
      })
    }
    
    // Add ownership signals from scope
    if (mergedAnalysis.scope?.ownership && Array.isArray(mergedAnalysis.scope.ownership)) {
      const ownershipSignal = mergedAnalysis.scope.ownership[0]
      if (ownershipSignal && whatWorks.length < 5) {
        whatWorks.push(`Clear ownership signals: ${ownershipSignal}`)
      }
    }
    
    // Add high-relevance experience
    if (mergedAnalysis.experience && Array.isArray(mergedAnalysis.experience)) {
      const highRelevanceRoles = mergedAnalysis.experience
        .filter(exp => exp.relevance >= 7)
        .slice(0, 1)
      if (highRelevanceRoles.length > 0 && whatWorks.length < 5) {
        whatWorks.push(`Relevant experience in ${highRelevanceRoles[0].title || 'similar roles'}`)
      }
    }

    // Fallback if no strengths found
    if (whatWorks.length === 0) {
      whatWorks.push('Your experience shows relevant background')
      whatWorks.push('Strong foundation for the role')
    }

    // 2. GAPS TO CLOSE FOR THIS ROLE
    // High/critical red flags
    if (mergedAnalysis.red_flags && Array.isArray(mergedAnalysis.red_flags)) {
      mergedAnalysis.red_flags
        .filter(flag => flag.severity === 'high' || flag.severity === 'critical')
        .slice(0, 3)
        .forEach((flag: any) => {
          whatsMissing.push(flag.message)
        })
    }

    // Missing cultural themes (themes in JD but not in resume signals)
    if (mergedAnalysis.culture?.themes && Array.isArray(mergedAnalysis.culture.themes)) {
      const mappedThemes = new Set(
        (mergedAnalysis.culture.mappable_resume_signals || []).map((s: any) => s.theme?.toLowerCase())
      )
      mergedAnalysis.culture.themes.slice(0, 6).forEach((theme: string) => {
        if (!mappedThemes.has(theme.toLowerCase()) && whatsMissing.length < 6) {
          whatsMissing.push(`Missing explicit ${theme.toLowerCase()} signals`)
        }
      })
    }

    // Add medium-severity red flags if we have room
    if (whatsMissing.length < 3 && mergedAnalysis.red_flags) {
      mergedAnalysis.red_flags
        .filter((flag: any) => flag.severity === 'medium')
        .slice(0, 3 - whatsMissing.length)
        .forEach((flag: any) => {
          whatsMissing.push(flag.message)
        })
    }

    // 3. KEYWORDS & THEMES
    // Job themes from culture analysis
    if (mergedAnalysis.culture?.themes && Array.isArray(mergedAnalysis.culture.themes)) {
      jobThemes.push(...mergedAnalysis.culture.themes.slice(0, 8))
    }

    // Resume themes from mappable signals
    if (mergedAnalysis.culture?.mappable_resume_signals && Array.isArray(mergedAnalysis.culture.mappable_resume_signals)) {
      const resumeThemeSet = new Set<string>()
      mergedAnalysis.culture.mappable_resume_signals.forEach((signal: any) => {
        if (signal.theme) {
          resumeThemeSet.add(signal.theme)
        }
      })
      resumeThemes.push(...Array.from(resumeThemeSet).slice(0, 6))
    }

    // Missing themes = job themes not in resume themes
    const resumeThemesLower = new Set(resumeThemes.map(t => t.toLowerCase()))
    jobThemes.forEach((theme: string) => {
      if (!resumeThemesLower.has(theme.toLowerCase())) {
        missingThemes.push(theme)
      }
    })

    // 4. RATIONALE FOR CHANGES (Strategic coaching)
    let rationale = ''
    
    // Start with honest feedback if available
    if (mergedAnalysis.competitive?.honest_feedback) {
      rationale = mergedAnalysis.competitive.honest_feedback
    }
    
    // Add experience strategy summary
    if (mergedAnalysis.experience && Array.isArray(mergedAnalysis.experience)) {
      const expandCount = mergedAnalysis.experience.filter(e => e.strategy === 'EXPAND').length
      const compressCount = mergedAnalysis.experience.filter(e => e.strategy === 'COMPRESS').length
      const minimizeCount = mergedAnalysis.experience.filter(e => e.strategy === 'MINIMIZE').length
      
      let strategyNote = ''
      if (expandCount > 0) {
        strategyNote += `We expanded ${expandCount} relevant ${expandCount === 1 ? 'role' : 'roles'} with detailed impact. `
      }
      if (compressCount > 0) {
        strategyNote += `We compressed ${compressCount} supporting ${compressCount === 1 ? 'role' : 'roles'}. `
      }
      if (minimizeCount > 0) {
        strategyNote += `We minimized ${minimizeCount} less-relevant ${minimizeCount === 1 ? 'role' : 'roles'}. `
      }
      
      if (strategyNote && rationale) {
        rationale += '\n\n' + strategyNote.trim()
      } else if (strategyNote) {
        rationale = strategyNote.trim()
      }
    }
    
    // Add altitude/tone strategy if available
    if (mergedAnalysis.altitude?.overall_level && mergedAnalysis.summary?.tone) {
      const altitudeNote = `We lifted your résumé language to emphasize ${mergedAnalysis.summary.tone} while staying honest about your ${mergedAnalysis.scope?.seniority || 'professional'} experience level.`
      if (rationale) {
        rationale += '\n\n' + altitudeNote
      } else {
        rationale = altitudeNote
      }
    }
    
    // Fallback
    if (!rationale) {
      rationale = 'We optimized your résumé to better match the role requirements while maintaining complete honesty and accuracy.'
    }

    const result = {
      success: true,
      optimizedResume,
      changes: curatorData?.validatedChanges || generatorData.changes,
      analysis: {
        // Diagnostic panel fields (deep mode)
        whatWorks,
        whatsMissing,
        keywordsToTarget: {
          jobThemes,
          resumeThemes,
          missingThemes,
          // Legacy fields (kept for backwards compatibility)
          verbs: jobThemes.slice(0, 5),
          techStack: [],
          concepts: resumeThemes
        },
        rationaleForChanges: rationale,

        // Fit scores
        fitScoreBefore: baselineFit.fitScore,
        fitScoreAfter: finalFit.fitScore,
        subscores: {
          before: baselineFit.breakdown,
          after: finalFit.breakdown,
        },

        // Advanced analysis fields (deep mode)
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
          title: job_title || 'Position',
          company: company || null,
          location: location || null,
        },
        timing: {
          total_ms: totalTime,
        },
        version: 'deep-v2.0-async',
      },
    }

    // Complete job (internal tracking only)
    // completeJob(jobId, result)

    console.log(`[Job ${jobId}] ✅ Completed in ${(totalTime / 1000).toFixed(1)}s`)
    return result

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Job ${jobId}] ❌ Failed after ${duration}ms:`, error)
    throw error // Re-throw to be caught by POST handler
  }
}
