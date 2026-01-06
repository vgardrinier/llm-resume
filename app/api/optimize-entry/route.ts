import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

/**
 * SINGLE-ENTRY OPTIMIZER
 *
 * Optimizes ONE experience/project entry in isolation
 * This prevents content mixing by construction
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      entry_id,
      company,
      role,
      dates,
      bullets,
      jobDescription,
      allowedFacts = []
    } = body

    if (!entry_id || !bullets || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: entry_id, bullets, jobDescription' },
        { status: 400 }
      )
    }

    console.log(`[OptimizeEntry] Processing ${entry_id} (${company})`)

    const startTime = Date.now()

    // Compact prompt - small context, focused task
    const prompt = `You are optimizing ONE experience entry for a resume.

ORIGINAL ENTRY:
Company: ${company || 'N/A'}
Role: ${role || 'N/A'}
Dates: ${dates || 'N/A'}
Bullets:
${bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}

TARGET JOB (key requirements only):
${jobDescription.substring(0, 3000)}

${allowedFacts.length > 0 ? `\nALLOWED FACTS (can reference these):\n${allowedFacts.join('\n')}` : ''}

TASK:
Rewrite the bullets for THIS ENTRY ONLY to:
1. Emphasize relevance to target job
2. Use stronger action verbs and strategic framing
3. Add context and impact where appropriate

CRITICAL CONSTRAINTS:
- ONLY use information from THIS entry's original bullets
- NEVER invent new numbers, technologies, or facts not in original or allowed facts
- Keep bullets factually grounded in the original content
- 3-7 bullets depending on relevance (high relevance = more bullets)

Output ONLY valid JSON (no markdown):
{
  "entry_id": "${entry_id}",
  "rewritten_bullets": ["string"],
  "changes": [
    {
      "original": "exact original bullet text",
      "suggested": "rewritten bullet",
      "reason": "why this improves fit"
    }
  ]
}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000, // Small output - just bullets
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const elapsed = Date.now() - startTime

    // Parse JSON
    let result
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch (e) {
      console.error('[OptimizeEntry] JSON parse error:', e)
      return NextResponse.json(
        { error: 'Failed to parse LLM response' },
        { status: 500 }
      )
    }

    console.log(`[OptimizeEntry] ✅ ${entry_id} completed in ${elapsed}ms`)

    return NextResponse.json({
      entry_id: result.entry_id,
      rewritten_bullets: result.rewritten_bullets,
      changes: result.changes || [],
      metadata: {
        elapsed_ms: elapsed,
        original_bullet_count: bullets.length,
        new_bullet_count: result.rewritten_bullets.length
      }
    })

  } catch (error) {
    console.error('[OptimizeEntry] Error:', error)
    return NextResponse.json(
      {
        error: 'Entry optimization failed',
        details: error instanceof Error ? error.message : 'Unknown'
      },
      { status: 500 }
    )
  }
}
