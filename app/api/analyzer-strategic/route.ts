import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'

/**
 * STRATEGIC ANALYZER - Reasoning Only
 *
 * Model: Sonnet 4 (intelligent, creative)
 * Temperature: 0.3 (strategic thinking)
 * Target: 20-30 seconds
 * Token budget: 2000 max output
 */

const STRATEGIC_PROMPT = `You are an EXPERT RESUME STRATEGIST.

You receive:
- The original resume.
- The job description.
- A structural analysis JSON with scope, altitude, experience architecture, and red flags.

Your job: THINK and COACH at a high level.
You are allowed to reason and interpret, but you MUST respect the structural facts.
Do NOT contradict structural ceilings or invent fake scope.

INPUT:

<resume>
{{RESUME}}
</resume>

<job_description>
{{JOB_DESCRIPTION}}
</job_description>

<structural_analysis_json>
{{STRUCTURAL_JSON}}
</structural_analysis_json>

TASKS:

1) COMPANY CULTURE + ROLE INTENT
- Detect likely culture_type based on job description:
  - "amazon_lp" (ownership, metrics, LP-heavy language)
  - "google_innovation" (innovation, scale, technical depth)
  - "startup" (scrappy, 0–1, wearing many hats)
  - "enterprise" (process, compliance, stakeholder management)
- Extract 3–6 key cultural/behavioral themes from the JD (e.g. "ownership", "stakeholder management", "data-driven", "ambiguity", "customer obsession").
- Map 3–8 resume bullets or responsibilities that COULD be reframed to show those themes.

2) METRIC OPPORTUNITIES (NO FAKE NUMBERS)
Using structural analysis:
- Only flag bullets where impact is CLAIMED but NO metric exists (e.g. "improved", "increased", "reduced", "scaled").
- Cap at 3 opportunities TOTAL across entire resume. Pick highest impact only.
- For each opportunity:
  - Write a SINGLE concrete question for the user (e.g. "What % did you improve performance by?").
  - Provide placeholder_format (e.g. "[X]%", "[X] users", "[X]ms") OR a neutral_fallback phrase (e.g. "measurably", "by notable margin"). Choose one, keep minimal.
- Do NOT invent numbers. Do NOT propose baselines.

3) SUMMARY STRATEGY
Based on:
- structural.seniority,
- structural.industry,
- target culture_type,
craft:
- industry_lens: e.g. "fintech", "saas", "real_estate", "ecommerce", "generalist".
- tone: e.g. "high-agency", "operations-heavy", "strategic-leaning", "delivery-focused".
- draft_summary: a 2-line, high-altitude summary that is honest and does not exceed structural altitude ceilings.

Formula guideline (adapt, don't copy blindly):
"[Seniority] [domain] professional with [X+] years driving [high-agency verbs] across [scope]. Proven experience in [capability 1], [capability 2], and [capability 3] within [industry/context]."

4) COMPETITIVE ANALYSIS (HONEST CEILING)
Using all inputs:
- before_score: 0–10 estimate of current competitiveness for THIS JOB LEVEL (not generic market).
- realistic_target_level: e.g. "Program Manager", "Product Manager", "Senior PM", "Operations Lead".
- after_potential: 0–10 realistic ceiling AFTER optimization, respecting structural ceilings.
- honest_feedback: short, direct explanation:
  - if they are aiming too high, say so clearly.
  - if they are well-matched, say that too.
  - if their profile is better suited to a slightly different role, name it.

OUTPUT:
Return ONLY valid JSON. No commentary, no markdown.

{
  "culture": {
    "detected_company": "string",
    "culture_type": "amazon_lp|google_innovation|startup|enterprise",
    "themes": [ "string" ],
    "mappable_resume_signals": [
      {
        "theme": "string",
        "role_index": 0,
        "bullet_hint": "short quote or paraphrase from resume"
      }
    ]
  },
  "metrics": [
    {
      "role_index": 0,
      "bullet_hint": "short quote from resume bullet",
      "question": "string",
      "placeholder_format": "[X]%",
      "neutral_fallback": "measurably",
      "reason": "string"
    }
  ],
  "summary": {
    "industry_lens": "string",
    "tone": "string",
    "draft_summary": "string"
  },
  "competitive": {
    "before_score": 0,
    "realistic_target_level": "string",
    "after_potential": 0,
    "honest_feedback": "string"
  }
}`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { originalResume, jobDescription, structuralAnalysis } = await request.json()

    if (!originalResume || !jobDescription || !structuralAnalysis) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Strategic] Starting reasoning...')

    const prompt = STRATEGIC_PROMPT
      .replace('{{RESUME}}', originalResume)
      .replace('{{JOB_DESCRIPTION}}', jobDescription)
      .replace('{{STRUCTURAL_JSON}}', JSON.stringify(structuralAnalysis, null, 2))

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000, // Tight budget, shallow JSON
      temperature: 0.3, // Creative strategic thinking
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const duration = Date.now() - startTime

    console.log(`[Strategic] Complete (${duration}ms), output: ${responseText.length} chars`)

    const analysis = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Strategic]'
    })

    return NextResponse.json({
      analysis,
      metadata: {
        duration_ms: duration,
        model: 'claude-sonnet-4-20250514',
        output_tokens: responseText.length
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Strategic] Error:', error)
    return NextResponse.json(
      {
        error: 'Strategic analysis failed',
        details: error instanceof Error ? error.message : 'Unknown',
        duration_ms: duration
      },
      { status: 500 }
    )
  }
}
