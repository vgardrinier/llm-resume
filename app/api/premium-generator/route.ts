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

    // LEAN PROMPT - Sonnet 4 is smart, we don't need verbose examples
    const prompt = `Transform this resume based on strategic analysis.

ORIGINAL RESUME:
${originalResume}

TARGET JOB:
${jobDescription}

STRATEGIC ANALYSIS (your blueprint):
${JSON.stringify(premiumAnalysis, null, 2)}

EXECUTE TRANSFORMATION:

1. Apply experience architecture: EXPAND strong roles (6-7 bullets), COMPRESS weak ones (2-3), MINIMIZE irrelevant
2. Lift altitude per analysis guidance (only if can_lift=true)
3. Map bullets to company culture (LP alignment for Amazon, innovation for Google, etc.)
4. Add metric placeholders with [X] where analysis flagged opportunities
5. Rewrite summary using industry lens from analysis
6. Remove red flags identified
7. Ensure altitude coherence across all sections

CRITICAL:
- Generate 15-25 changes (strategic, not cosmetic)
- Every change needs Grammarly-style reason (1 sentence, why it helps)
- Track position for each change
- Flag requires_user_input=true for metric placeholders
- Be aggressive but honest (stay within realistic_altitude_ceiling)

OUTPUT (valid JSON only):
{
  "optimizedResume": {
    "contactInfo": {...},
    "sections": [...]
  },
  "changes": [
    {
      "id": "change-1",
      "type": "addition|modification",
      "section": "Summary|Experience|Skills",
      "original": "...",
      "suggested": "...",
      "reason": "Concise explanation of strategic value",
      "impactScore": 1-10,
      "position": {"sectionIndex": 0, "bulletIndex": 0},
      "requires_user_input": false,
      "altitude_shift": "Level 2 → Level 3" (if applicable),
      "lp_alignment": ["Ownership"] (if applicable),
      "questions": ["Ask user this"] (if requires_user_input)
    }
  ]
}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Haiku for speed - analyzer provides the strategy
      max_tokens: 6000,
      temperature: 0.5, // Slightly higher for more aggressive changes
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const genTime = Date.now() - startTime

    console.log(`[Premium-Generator] Generated (${genTime}ms), length: ${responseText.length}`)

    const result = parseClaudeJson(responseText, { attemptEscapeFix: true, errorPrefix: '[Premium-Generator]' })

    if (!result.optimizedResume || !result.changes) {
      throw new Error('Invalid generator response')
    }

    console.log('[Premium-Generator] Complete:', {
      changesCount: result.changes.length,
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
