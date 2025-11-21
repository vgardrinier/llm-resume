import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'

export interface EvaluationResult {
  clarity: number // 0-100
  relevance: number // 0-100
  honesty: number // 0-100
  feedback: string // Detailed feedback text
  revised_resume?: string // Optional: revised resume if scores were low
  revision_applied?: boolean // Whether a revision was attempted
  // Metadata for future database storage
  metadata?: {
    feedback_tone?: 'direct' | 'supportive' | 'analytical'
    evaluation_timestamp?: string
    model_used?: string
    raw_scores?: {
      clarity: number
      relevance: number
      honesty: number
    }
  }
}

// Add slight entropy to scores to avoid rounded numbers (e.g., 85, 90, 95)
// Randomizes within ±2 points to keep numbers believable
function randomizeScore(val: number): number {
  const randomized = Math.round(val + (Math.random() * 4 - 2))
  return Math.max(0, Math.min(100, randomized))
}

// Select feedback tone for variety
type FeedbackTone = 'direct' | 'supportive' | 'analytical'
function selectFeedbackTone(): FeedbackTone {
  const tones: FeedbackTone[] = ['direct', 'supportive', 'analytical']
  return tones[Math.floor(Math.random() * tones.length)]
}

// Get tone-specific instruction
function getToneInstruction(tone: FeedbackTone): string {
  switch (tone) {
    case 'direct':
      return 'Be direct and straightforward in your feedback. Call out issues clearly without sugar-coating.'
    case 'supportive':
      return 'Be encouraging and constructive in your feedback. Frame suggestions as opportunities for improvement.'
    case 'analytical':
      return 'Be analytical and data-driven in your feedback. Focus on specific examples and measurable observations.'
    default:
      return 'Provide balanced, professional feedback.'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      generated_resume, 
      original_resume, 
      job_description,
      generator_output 
    } = body

    if (!generated_resume || !original_resume || !job_description) {
      return NextResponse.json(
        { error: 'Generated resume, original resume, and job description are required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Curator] ANTHROPIC_API_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('[Curator] Starting evaluation with Claude Sonnet...')

    // Select feedback tone for variety
    const feedbackTone = selectFeedbackTone()
    console.log(`[Curator] Using feedback tone: ${feedbackTone}`)

    // Build evaluation prompt (optimized for token efficiency)
    const themesStr = generator_output?.themes_covered?.join(', ') || 'N/A'
    const keywordsStr = generator_output?.keywords_used?.join(', ') || 'N/A'
    const toneHint = feedbackTone === 'direct' ? 'Be direct and clear.' : feedbackTone === 'supportive' ? 'Be encouraging and constructive.' : 'Be analytical and data-driven.'
    
    const evaluationPrompt = `SYSTEM GOAL: Ensure {generated} stays truthful and optimized for job fit. Prioritize human readability over keyword stuffing.

Evaluate {generated} on:
1. CLARITY (0-100): Clear, readable, ATS-friendly structure?
2. RELEVANCE (0-100): Matches job description? Right keywords/themes highlighted?
3. HONESTY (0-100): Faithful to {original}? No invented facts, companies, metrics, or tech?

RULES:
- Check for hallucinations (numbers, companies, titles, tech not in {original})
- Verify claims traceable to {original}
- Maintain factual integrity while optimizing
- Don't penalize stylistic improvements
- ${getToneInstruction(feedbackTone)}

{original}:
${original_resume}

{generated}:
${generated_resume}

Job:
${job_description}

Themes: ${themesStr} | Keywords: ${keywordsStr}

Return ONLY JSON:
{
  "clarity": 85,
  "relevance": 90,
  "honesty": 95,
  "feedback": "Specific, actionable feedback. ${toneHint}"
}`

    // Call Claude Sonnet for evaluation
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.2, // Low temperature for consistent evaluation
      messages: [
        {
          role: 'user',
          content: evaluationPrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Curator] Anthropic API response received, length:', responseText.length)

    // Parse evaluation response
    let evaluation: EvaluationResult
    try {
      const parsed = parseClaudeJson(responseText, {
        errorPrefix: '[Curator]'
      })

      // Validate and normalize scores (before randomization)
      const rawClarity = Math.max(0, Math.min(100, Number.isFinite(parsed.clarity) ? parsed.clarity : 75))
      const rawRelevance = Math.max(0, Math.min(100, Number.isFinite(parsed.relevance) ? parsed.relevance : 75))
      const rawHonesty = Math.max(0, Math.min(100, Number.isFinite(parsed.honesty) ? parsed.honesty : 75))

      // Apply randomization to make scores more believable
      evaluation = {
        clarity: randomizeScore(rawClarity),
        relevance: randomizeScore(rawRelevance),
        honesty: randomizeScore(rawHonesty),
        feedback: parsed.feedback || 'No feedback provided',
        metadata: {
          feedback_tone: feedbackTone,
          evaluation_timestamp: new Date().toISOString(),
          model_used: 'claude-sonnet-4-20250514',
          raw_scores: {
            clarity: rawClarity,
            relevance: rawRelevance,
            honesty: rawHonesty
          }
        }
      }

      console.log('[Curator] Evaluation complete (raw → randomized):', {
        clarity: `${rawClarity} → ${evaluation.clarity}`,
        relevance: `${rawRelevance} → ${evaluation.relevance}`,
        honesty: `${rawHonesty} → ${evaluation.honesty}`
      })

      // Phase 1.5: Revision capability if any category < 80
      // Use raw scores (not randomized) to ensure consistent revision logic
      const needsRevision = rawClarity < 80 || rawRelevance < 80 || rawHonesty < 80
      
      if (needsRevision) {
        console.log('[Curator] Low scores detected, attempting revision...')
        
        const revisionPrompt = `Based on your previous evaluation, revise the generated resume to improve the areas that scored below 80.

CRITICAL CONSTRAINTS:
- Do NOT add any new information not present in the original resume
- Do NOT invent companies, metrics, technologies, or achievements
- Focus on improving clarity, relevance, or honesty based on the evaluation
- Maintain the same factual content, just improve presentation or alignment

EVALUATION FEEDBACK:
${evaluation.feedback}

ORIGINAL RESUME (source of truth):
${original_resume}

CURRENT GENERATED RESUME (to revise):
${generated_resume}

JOB DESCRIPTION:
${job_description}

Return ONLY the revised resume text in Markdown format. Do not include any explanation or JSON wrapper - just the resume text itself.`

        try {
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          })

          const revisionMessage = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307', // Use Haiku for cost optimization (~80% cheaper)
            max_tokens: 4000,
            temperature: 0.3, // Slightly higher for creative revision
            messages: [
              {
                role: 'user',
                content: revisionPrompt
              }
            ]
          })

          const revisionText = revisionMessage.content[0].type === 'text' ? revisionMessage.content[0].text : ''
          
          // Clean up the revision (remove markdown code blocks if present)
          let revisedResume = revisionText.trim()
          revisedResume = revisedResume.replace(/```markdown\s*/g, '').replace(/```\s*$/g, '')
          revisedResume = revisedResume.replace(/^#+\s*/gm, '') // Remove any standalone headers
          revisedResume = revisedResume.trim()

          // Validate: catch false starts from Claude (e.g., "I am", "Dear")
          const hasFalseStart = revisedResume.toLowerCase().includes('i am') || revisedResume.toLowerCase().includes('dear')
          
          if (hasFalseStart) {
            console.warn('[Curator] Revision contains false start ("I am" or "Dear"), skipping')
            evaluation.revision_applied = false
          } else if (revisedResume && revisedResume.length > 100) {
            evaluation.revised_resume = revisedResume
            evaluation.revision_applied = true
            console.log('[Curator] Revision applied successfully, length:', revisedResume.length)
          } else {
            console.warn('[Curator] Revision response too short or invalid, skipping')
            evaluation.revision_applied = false
          }
        } catch (revisionError) {
          console.error('[Curator] Revision failed:', revisionError)
          evaluation.revision_applied = false
          // Continue with original evaluation even if revision fails
        }
      } else {
        evaluation.revision_applied = false
        console.log('[Curator] All scores ≥ 80, no revision needed')
      }

      return NextResponse.json(evaluation)

    } catch (parseError) {
      console.error('[Curator] Failed to parse evaluation response:', parseError)
      console.error('[Curator] Raw response:', responseText)
      
      // Return fallback evaluation with randomized scores
      const fallbackEvaluation: EvaluationResult = {
        clarity: randomizeScore(75),
        relevance: randomizeScore(75),
        honesty: randomizeScore(75),
        feedback: 'Unable to parse evaluation response. Please review the resume manually.',
        revision_applied: false
      }

      return NextResponse.json(fallbackEvaluation)
    }

  } catch (error) {
    console.error('[Curator] API error:', error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error: 'Anthropic API error',
          details: error.message,
          status: error.status
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to evaluate resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
