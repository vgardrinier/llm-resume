import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'
import type { ResumeChange } from '@/types/api'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface StructuredCuratorResult {
  // Validated and possibly refined changes
  validatedChanges: ResumeChange[]

  // Quality scores
  clarity: number // 0-100
  relevance: number // 0-100
  honesty: number // 0-100

  // Feedback for logging/debugging (not shown to user)
  feedback: string

  // Metadata
  changesRemoved: number // How many changes were rejected
  changesModified: number // How many changes were refined
  metadata?: {
    evaluation_timestamp?: string
    model_used?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      changes,
      optimizedResume,
      originalResume,
      jobDescription,
      analysis
    } = body

    if (!changes || !optimizedResume || !originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields for curator validation' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('[Curator-Structured] Starting validation with Claude Sonnet...')
    console.log('[Curator-Structured] Validating', changes.length, 'changes')

    // Build curator prompt
    const curatorPrompt = `You are a résumé quality curator. Your job is to validate proposed changes to ensure they are:
1. HONEST - No invented facts, metrics, companies, or technologies
2. RELEVANT - Actually improve fit for the job
3. CLEAR - Well-written and professional

You will receive:
- Original resume (the truth)
- Proposed changes array (from generator)
- Job description (the target)

Your task:
- Validate each change against the original resume
- Remove changes that invent facts not in the original
- Refine change reasons to be more specific and actionable
- Adjust impactScores if needed
- Return the validated changes array

CRITICAL RULES:
1. If a change adds a metric/number not in original → REMOVE IT
2. If a change adds a technology not in original → REMOVE IT
3. If a change adds a company/project not in original → REMOVE IT
4. If a change's reason is generic → REFINE IT to be specific
5. Generic reasons like "improves clarity" → make specific: "Job requires X, this highlights your Y experience"

Original Resume:
${originalResume}

Job Description:
${jobDescription}

Proposed Changes:
${JSON.stringify(changes, null, 2)}

Return JSON in this format:
{
  "validatedChanges": [
    {
      "id": "change-1",
      "type": "addition",
      "section": "Summary",
      "suggested": "...",
      "reason": "Refined reason: Job emphasizes X and Y, this positions candidate as...",
      "impactScore": 8
    }
  ],
  "clarity": 85,
  "relevance": 90,
  "honesty": 95,
  "feedback": "Removed 2 changes that added metrics not in original. Refined 3 reasons to be more specific.",
  "changesRemoved": 2,
  "changesModified": 3
}

Be strict on honesty. Be helpful on clarity. Focus on high-impact changes.
`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      temperature: 0.3, // Lower temperature for consistency
      messages: [
        {
          role: 'user',
          content: curatorPrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Curator-Structured] Claude response received, length:', responseText.length)

    try {
      const result: StructuredCuratorResult = parseClaudeJson(responseText, {
        attemptEscapeFix: true,
        errorPrefix: '[Curator-Structured]'
      })

      // Validate response structure
      if (!result.validatedChanges || !Array.isArray(result.validatedChanges)) {
        throw new Error('Invalid curator response: missing validatedChanges array')
      }

      console.log('[Curator-Structured] Validation complete', {
        originalCount: changes.length,
        validatedCount: result.validatedChanges.length,
        removed: result.changesRemoved || 0,
        modified: result.changesModified || 0,
        clarity: result.clarity,
        relevance: result.relevance,
        honesty: result.honesty
      })

      return NextResponse.json({
        ...result,
        metadata: {
          evaluation_timestamp: new Date().toISOString(),
          model_used: 'claude-3-haiku-20240307'
        }
      })

    } catch (parseError) {
      console.error('[Curator-Structured] Failed to parse response:', parseError)
      console.error('[Curator-Structured] Raw response:', responseText)

      // Fallback: return original changes with warning
      return NextResponse.json({
        validatedChanges: changes,
        clarity: 75,
        relevance: 75,
        honesty: 75,
        feedback: 'Curator validation failed, using original changes',
        changesRemoved: 0,
        changesModified: 0,
        metadata: {
          evaluation_timestamp: new Date().toISOString(),
          model_used: 'fallback'
        }
      })
    }

  } catch (error) {
    console.error('[Curator-Structured] Error:', error)

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
        error: 'Curator validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
