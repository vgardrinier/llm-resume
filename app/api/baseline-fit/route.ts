import { NextRequest, NextResponse } from 'next/server'
import { calculateBaselineFitScore } from '@/lib/utils/fitScore'

/**
 * Quick baseline fit score endpoint
 * Returns in ~2s to show early feedback while main generation runs
 */
export async function POST(request: NextRequest) {
  const start = Date.now()
  
  try {
    const body = await request.json()
    const { job_description, candidate_resume } = body

    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and resume are required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const baselineScore = await calculateBaselineFitScore({
      jobDescription: job_description,
      originalResume: candidate_resume
    }).catch(() => {
      // Fallback if calculation fails
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

    const duration = Date.now() - start
    console.log(`[Baseline-Fit] Calculated in ${duration}ms: ${baselineScore.score}/100`)

    return NextResponse.json({
      score: baselineScore.score,
      breakdown: baselineScore.breakdown,
      timing_ms: duration
    })
  } catch (error: any) {
    console.error('[Baseline-Fit] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate baseline score' },
      { status: 500 }
    )
  }
}

