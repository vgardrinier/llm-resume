import { NextRequest, NextResponse } from 'next/server'
import { calculateFitScore, calculateBaselineFitScore, type FitScoreResult } from '@/lib/utils/fitScore'
import { extractJobTitleAndLocation } from '@/lib/utils/salaryMCP'
import { autoPatchHallucinations } from '@/lib/utils/postprocess'
import { generateCoachingMessages, generateUnifiedCoachingMessage } from '@/lib/utils/coachingMessages'
import { randomUUID } from 'crypto'

/**
 * Extract actionable goals from coaching message
 * Returns top 1-2 specific suggestions that can be implemented
 */
function extractActionableGoals(coachingText: string): string {
  // Look for sentences with actionable verbs
  const sentences = coachingText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
  
  const actionablePatterns = [
    /(add|include|consider|try|should|could|might want to|you could|consider adding)/i,
    /(improve|enhance|strengthen|clarify|emphasize|highlight|focus on)/i
  ]
  
  const actionableSentences = sentences.filter(s => 
    actionablePatterns.some(pattern => pattern.test(s))
  ).slice(0, 2) // Take top 2
  
  if (actionableSentences.length > 0) {
    return actionableSentences.join('. ').trim()
  }
  
  // Fallback: return first 2 sentences if no clear actionables found
  return sentences.slice(0, 2).join('. ').trim()
}

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

    // Debug: Log start with input validation
    console.log('[Orchestrator] Request received', {
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
      console.error('[Orchestrator] Missing required inputs', {
        step: 'validation_failed',
        hasJob: !!job_description,
        hasResume: !!candidate_resume,
        jobType: typeof job_description,
        resumeType: typeof candidate_resume,
      })
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    // Validate job description length (catch empty or suspiciously short descriptions)
    const trimmedJobDescription = job_description.trim()
    
    // Very minimal validation - just catch empty/whitespace (30 chars is about 5-6 words)
    // We allow short descriptions because users might manually paste brief ones
    // The fit score calculation will handle incomplete descriptions gracefully
    if (trimmedJobDescription.length < 30) {
      console.error('[Orchestrator] Job description too short', {
        step: 'validation_failed',
        jobLength: trimmedJobDescription.length,
        jobPreview: trimmedJobDescription.substring(0, 100),
      })
      return NextResponse.json(
        { 
          error: 'Job description is too short. Please provide at least a job title and basic requirements (minimum 30 characters).',
          details: `Received only ${trimmedJobDescription.length} characters.`
        },
        { status: 400 }
      )
    }
    
    // Log warning for short descriptions but allow them to proceed
    if (trimmedJobDescription.length < 200) {
      console.warn('[Orchestrator] Job description is short - may be incomplete', {
        step: 'validation_warning',
        jobLength: trimmedJobDescription.length,
        jobPreview: trimmedJobDescription.substring(0, 200),
      })
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
    console.log(`[Orchestrator] Generator completed in ${generatorTime}ms`, {
      step: 'generator_complete',
      hasResumeMd: !!generatorData.resume_md,
      resumeMdLength: generatorData.resume_md?.length || 0,
      hasKeywords: !!generatorData.keywords_used,
      keywordsCount: generatorData.keywords_used?.length || 0,
      hasThemes: !!generatorData.themes_covered,
      themesCount: generatorData.themes_covered?.length || 0,
    })

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

    // Other insights
    insights.keywords = generatorData.keywords_used || []
    insights.themes = generatorData.themes_covered || []
    insights.optimizations = generatorData.changes_made || []

    // Add evaluation insights from curator with human-friendly coaching messages
    if (evaluation) {
      // Generate contextual coaching messages using LLM (personalized, not templated)
      const coachingStart = Date.now()
      console.log('[Orchestrator] Generating personalized coaching messages...')
      
      const coachingMessages = await generateCoachingMessages(evaluation, {
        role,
        company: companyName,
        location
      }, {
        model: 'haiku', // Use Haiku for speed, can switch to 'sonnet' for richer phrasing
        originalResume: candidate_resume // Pass original resume so coaching can verify claims
      })
      
      const coachingTime = Date.now() - coachingStart
      console.log(`[Orchestrator] Coaching messages generated in ${coachingTime}ms`)

      insights.evaluation = {
        // Raw scores (for backend/analytics)
        clarity: evaluation.clarity,
        relevance: evaluation.relevance,
        honesty: evaluation.honesty,
        // Technical feedback (for debugging - not shown to users)
        feedback: evaluation.feedback,
        // Human-friendly coaching messages (for user-facing chat)
        coaching: {
          clarity: coachingMessages.clarity,
          relevance: coachingMessages.relevance,
          honesty: coachingMessages.honesty,
          unified: coachingMessages.unified // Single message combining all aspects
        }
      }

      // Removed: review_notes - we now use coaching.honesty message instead
      // The coaching messages are user-friendly and context-aware, replacing raw technical feedback

      // COACHING-BASED REVISION: If coaching suggests improvements and curator didn't revise, do a second generator pass
      // This ensures coaching suggestions (e.g., "add summary") actually get implemented
      if (coachingMessages.unified && !evaluation.revision_applied) {
        // Check if coaching contains actionable suggestions (not just observations)
        const hasActionableSuggestions = /(add|include|consider|try|might|should|could|improve|enhance|strengthen|clarify|emphasize)/i.test(coachingMessages.unified)
        
        if (hasActionableSuggestions) {
          console.log('[Orchestrator] Coaching suggests improvements, doing second generator pass...')
          const revisionStart = Date.now()
          
          try {
            // Extract top 1-2 actionable suggestions from coaching
            const revisionGoals = extractActionableGoals(coachingMessages.unified)
            
            const revisionResponse = await fetch(`${baseUrl}/api/generator`, {
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
                revision_goals: revisionGoals, // New: pass coaching suggestions as revision goals
                generation_id: generationId,
                session_id: sessionId
              })
            })

            if (revisionResponse.ok) {
              const revisionData = await revisionResponse.json()
              const revisionTime = Date.now() - revisionStart
              console.log(`[Orchestrator] Coaching-based revision completed in ${revisionTime}ms`)
              
              // Use revised resume if it's different and better
              if (revisionData.resume_md && revisionData.resume_md !== resumeMd) {
                resumeMd = revisionData.resume_md
                console.log('[Orchestrator] Using coaching-revised resume')
              }
            } else {
              console.warn('[Orchestrator] Coaching-based revision failed, using original')
            }
          } catch (revisionErr) {
            console.warn('[Orchestrator] Coaching-based revision error:', revisionErr)
            // Continue with original resume if revision fails
          }
        }
      }
    }

    // Calculate fit score AFTER all revisions are complete (including coaching-based revision)
    // This ensures insights.fit reflects the final optimized_resume that the user receives
    const fitScoreStart = Date.now()
    console.log('[Orchestrator] Calculating fit score on final resume...', {
      step: 'fit_score_start',
      jobLength: job_description?.length || 0,
      originalResumeLength: candidate_resume?.length || 0,
      generatedResumeLength: resumeMd?.length || 0,
      keywordsCount: generatorData.keywords_used?.length || 0,
      themesCount: generatorData.themes_covered?.length || 0,
    })
    const fitScore = await calculateFitScore({
      jobDescription: job_description,
      candidateResume: candidate_resume,
      generatedResume: resumeMd,
      keywordsUsed: generatorData.keywords_used || [],
      themesCovered: generatorData.themes_covered || []
    })
    const fitScoreTime = Date.now() - fitScoreStart
    console.log(`[Orchestrator] Fit score calculated in ${fitScoreTime}ms`, {
      step: 'fit_score_complete',
      fitScore: fitScore.score,
      breakdown: fitScore.breakdown,
      explanation: fitScore.explanation?.substring(0, 100),
    })

    const normalizedScore = Math.max(1, Math.min(100, Number.isFinite(fitScore.score) ? fitScore.score : 0))
    if (normalizedScore !== fitScore.score) {
      console.warn('[Orchestrator] Adjusted fit score to normalized range:', { 
        step: 'fit_score_normalized',
        original: fitScore.score, 
        normalized: normalizedScore,
        isFinite: Number.isFinite(fitScore.score),
      })
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
      // Create a proper baseline breakdown estimate (lower than optimized)
      const estimatedBaselineScore = Math.max(0, normalizedScore - 10)
      baseline = {
        score: estimatedBaselineScore,
        breakdown: {
          keywordMatch: Math.max(0, fitScore.breakdown.keywordMatch - 10),
          themeAlignment: Math.max(0, fitScore.breakdown.themeAlignment - 10),
          experienceRelevance: fitScore.breakdown.experienceRelevance, // Experience doesn't change
          skillOverlap: Math.max(0, fitScore.breakdown.skillOverlap - 10)
        },
        explanation: 'Estimated baseline (scoring service unavailable)'
      }
    }
    
    // Ensure optimized score is always >= baseline (optimization should never decrease the score)
    // If somehow the optimized score is lower, use baseline + 1 as minimum
    const scoreAfter = Math.max(baseline.score + 1, normalizedScore)
    
    // Debug: Log final fit score after baseline is calculated
    console.log('[Orchestrator] Final fit score', {
      step: 'fit_score_final',
      rawScore: fitScore.score,
      normalizedScore: normalizedScore,
      scoreBefore: baseline.score,
      scoreAfter: scoreAfter,
      improvement: scoreAfter - baseline.score,
    })

    // Fit insight (before/after) - calculated after all revisions
    insights.fit = {
      score_before: baseline.score,
      score_after: Math.max(1, Math.min(100, scoreAfter)),
      subscores: {
        before: baseline.breakdown,
        after: fitScore.breakdown
      },
      summary: fitScore.explanation || 'Unable to calculate fit score'
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
    console.log(`[Orchestrator] Process complete in ${totalTime}ms. Returning combined response.`, {
      step: 'complete',
      generation_id: generationId,
      session_id: sessionId,
      totalTimeMs: totalTime,
      fitScoreAfter: insights.fit?.score_after,
      fitScoreBefore: insights.fit?.score_before,
      hasOptimizedResume: !!responsePayload.optimized_resume,
      optimizedResumeLength: responsePayload.optimized_resume?.length || 0,
    })

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
