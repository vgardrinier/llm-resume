import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

/**
 * Parse resume text into structured entries using LLM
 * Fast, single-purpose call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { resume } = body

    if (!resume) {
      return NextResponse.json({ error: 'Missing resume' }, { status: 400 })
    }

    const prompt = `Parse this resume into structured JSON. Extract all experience/work entries with their bullets.

RESUME:
${resume}

Output ONLY valid JSON (no markdown):
{
  "experience_entries": [
    {
      "company": "string",
      "role": "string",
      "dates": "string",
      "bullets": ["string"]
    }
  ],
  "summary": "string or null",
  "skills": "string or null",
  "education": "string or null"
}

Rules:
- Extract ALL experience/work entries
- Keep bullets exactly as written
- If no summary section exists, set to null
- Preserve all original text`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json(parsed)

  } catch (error) {
    console.error('[ParseResume] Error:', error)
    return NextResponse.json(
      { error: 'Parse failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
