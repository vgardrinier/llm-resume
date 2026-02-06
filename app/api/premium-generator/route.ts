import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'

// PREMIUM GENERATOR - Executes transformation based on Premium Analyzer strategy
export async function POST(request: NextRequest) {
  try {
    const { originalResume, jobDescription, premiumAnalysis } = await request.json()

    if (!originalResume || !jobDescription || !premiumAnalysis) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('[Premium-Generator] Starting transformation...')
    const startTime = Date.now()

    // EXECUTION PROMPT - Sonnet 4 for reliable structure generation
    const prompt = `You are a PREMIUM RESUME TRANSFORMER.

Execute the transformation plan based on strategic analysis.

ORIGINAL RESUME:
${originalResume}

TARGET JOB:
${jobDescription}

STRATEGIC ANALYSIS:
${JSON.stringify(premiumAnalysis, null, 2)}

YOUR TASKS:

1. STRUCTURE GENERATION
Parse the original resume and output a complete structured resume with:
- contactInfo: Extract name, email, phone, location
- sections: Array of section objects, each with:
  - title: "Summary" | "Experience" | "Education" | "Skills" | etc.
  - type: "summary" | "experience" | "education" | "skills" | "other"
  - content: Array of items (for experience: company, role, dates, bullets)

2. APPLY TRANSFORMATIONS
Based on analysis.experience strategy:
- EXPAND roles: 6-7 detailed bullets with metrics and impact
- COMPRESS roles: 2-3 focused bullets
- MINIMIZE roles: 1 bullet or title-only

Based on analysis.altitude:
- Lift language from current_level to ceiling_level (if can_lift=true)
- Level 2→3: "coordinated" → "owned", "assisted" → "led"
- Level 3→4: add strategic framing, business context

Based on analysis.culture (if available):
- Map bullets to detected themes
- Align language to culture_type (ownership for Amazon, innovation for Google)

Based on analysis.metrics (if available):
- For bullets with metric_opportunity: generate TWO variants:
  1. suggested: uses neutral_fallback (e.g. "improved performance measurably")
  2. suggested_with_metric: uses placeholder_format (e.g. "improved performance by [X]%")
- For bullets WITHOUT metric_opportunity: generate single suggested variant (normal rewrite)
- NEVER invent numbers. Use fallback by default.

Based on analysis.summary (if available):
- Rewrite summary using industry_lens and tone

3. TRACK CHANGES
For each modification, create a change object with:
- original text vs suggested text
- reason (1 sentence explaining strategic value)
- impactScore (1-10)
- position in structure

CRITICAL REQUIREMENTS:
- optimizedResume MUST have contactInfo AND sections array
- sections array MUST be complete with all parsed sections
- Generate 10-25 strategic changes (not cosmetic)
- Stay within structural ceilings (respect altitude.ceiling_level)
- Be aggressive but honest

OUTPUT STRUCTURE (valid JSON only, no markdown):
{
  "optimizedResume": {
    "contactInfo": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "location": "string"
    },
    "sections": [
      {
        "title": "Summary",
        "type": "summary",
        "content": "string"
      },
      {
        "title": "Experience",
        "type": "experience",
        "content": [
          {
            "company": "string",
            "role": "string",
            "dates": "string",
            "bullets": ["string"]
          }
        ]
      },
      {
        "title": "Skills",
        "type": "skills",
        "content": "string or array"
      }
    ]
  },
  "changes": [
    {
      "id": "change-N",
      "type": "addition|modification",
      "section": "Summary|Experience|Skills|Education",
      "original": "exact text from original",
      "suggested": "improved text (always valid, uses fallback if needed)",
      "suggested_with_metric": "version with placeholder (only if metric_opportunity exists)",
      "metric_opportunity": {
        "question": "string",
        "placeholder_format": "[X]%",
        "neutral_fallback": "measurably"
      },
      "reason": "Concise explanation of strategic value",
      "impactScore": 8,
      "position": {
        "sectionIndex": 0,
        "bulletIndex": 0
      },
      "altitude_shift": "Level 2 → Level 3"
    }
  ]
}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Sonnet 4 for reliable structure generation
      max_tokens: 8000, // Increased for full resume + changes
      temperature: 0.4, // Balanced: creative but controlled
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const genTime = Date.now() - startTime

    console.log(`[Premium-Generator] Generated (${genTime}ms), length: ${responseText.length}`)

    const result = parseClaudeJson(responseText, { attemptEscapeFix: true, errorPrefix: '[Premium-Generator]' })

    if (!result.optimizedResume || !result.changes) {
      throw new Error('Invalid generator response structure')
    }

    // Validate required structure
    if (!result.optimizedResume.sections || !Array.isArray(result.optimizedResume.sections)) {
      console.error('[Premium-Generator] Missing sections array, adding fallback')
      result.optimizedResume.sections = []
    }

    console.log('[Premium-Generator] Complete:', {
      changesCount: result.changes.length,
      sectionsCount: result.optimizedResume.sections.length,
      optimizedResumeLength: JSON.stringify(result.optimizedResume).length,
      hasUserInputNeeded: result.changes.some((c: any) => c.requires_user_input)
    })

    return NextResponse.json({
      ...result,
      metadata: { generation_time_ms: genTime, model: 'claude-sonnet-4-20250514' }
    })

  } catch (error) {
    console.error('[Premium-Generator] Error:', error)
    return NextResponse.json(
      { error: 'Generation failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
