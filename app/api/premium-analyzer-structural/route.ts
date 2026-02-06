import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'

/**
 * STRUCTURAL ANALYZER - Pure Extraction
 *
 * Model: Haiku (fast, deterministic)
 * Temperature: 0 (no reasoning)
 * Target: 8-12 seconds
 * Token budget: 800 max output
 */

const STRUCTURAL_PROMPT = `You are a RESUME STRUCTURE ANALYZER.

Your job: EXTRACT facts from the resume + job description.
No coaching, no advice, no strategy, no leadership principles, no metrics guessing.
Only pattern detection and classification.

Do NOT explain your logic.
Do NOT reason.
Do NOT infer beyond what is explicitly stated.
Classify directly.
Return JSON only.

INPUT:
<resume>
{{RESUME}}
</resume>

<job_description>
{{JOB_DESCRIPTION}}
</job_description>

TASKS (EXTRACTION ONLY):

1) SCOPE SIGNALS
- Throughput: volumes, frequencies, counts (e.g. "40 appointments/month", "15 investors per quarter", "# of projects", "# of customers", "# of sales").
- Complexity: cross-functional teams, number of stakeholders, domains touched (finance, ops, product, marketing, engineering, etc.).
- Ownership: phrases that imply responsibility or accountability (e.g. "owned", "responsible for", "end-to-end", "point of contact").
- Industry context: best guess one or two words: e.g. "fintech", "real estate", "ecommerce", "saas", "retail", "consulting".
- Inferred seniority: "junior", "mid", "senior", or "lead", based ONLY on titles and scope (no flattering).

2) ALTITUDE CLASSIFICATION
Altitude levels:
1 = Tasks (keywords: "assisted", "supported", "handled", "processed").
2 = Coordination (keywords: "coordinated", "scheduled", "organized", "managed timelines").
3 = Ownership (keywords: "owned", "led", "drove", "accountable").
4 = Strategic (keywords: "defined strategy", "shaped roadmap", "designed process").
5 = Leadership (keywords: "built org", "scaled function", "transformed", "led team of X").

For each role:
- current_level: 1–5 based ONLY on the strongest evidence in that role.
- ceiling_level: 1–5 realistic maximum based on resume evidence (no guessing above what is shown).
- can_lift: true if ceiling_level > current_level, otherwise false.

Also compute:
- overall_altitude_level: 1–5 for the entire resume (based on strongest role).

3) EXPERIENCE ARCHITECTURE
For each role:
- relevance: 0–10 (match to job description keywords and responsibilities).
- recency: 0–10 (most recent roles score higher).
- seniority: 0–10 (based on scope and titles in that role).
- impact_potential: 0–10 (how promising this role looks for rewriting, even if impact is not yet quantified).
- total_score: sum of the four scores.

Strategy:
- If total_score >= 25 → "EXPAND" (6–7 bullets).
- If 15–24 → "COMPRESS" (2–3 bullets).
- If < 15 → "MINIMIZE" (1 bullet or title only).

4) RED FLAGS
Detect only what exists, do not invent:
- junior_tools: tools that signal junior profile for senior roles (e.g. "Canva", "CapCut", "basic Excel").
- soft_skills_fluff: phrases like "team player", "hard worker", "detail-oriented", "fast learner".
- repetitive_phrasing: same starting verb repeated 3+ times in a section ("managed", "responsible for", etc.).
- scope_ambiguity: roles with 0 numbers anywhere (no counts, no volumes, no teams, no budgets).
- narrative_conflict: title/seniority claims in summary that are not backed by any role (e.g. "Senior PM" but only assistant-level experience).

OUTPUT:
Return ONLY valid JSON, no commentary, no markdown, no explanation.

{
  "scope": {
    "throughput": [ "string" ],
    "complexity": [ "string" ],
    "ownership": [ "string" ],
    "industry": "string",
    "seniority": "junior|mid|senior|lead"
  },
  "altitude": {
    "overall_level": 1,
    "roles": [
      {
        "index": 0,
        "title": "string",
        "current_level": 2,
        "ceiling_level": 3,
        "can_lift": true
      }
    ],
    "fallback_mode": "normal|clarity_only"
  },
  "experience": [
    {
      "index": 0,
      "title": "string",
      "relevance": 0,
      "recency": 0,
      "seniority": 0,
      "impact_potential": 0,
      "total_score": 0,
      "strategy": "EXPAND|COMPRESS|MINIMIZE"
    }
  ],
  "red_flags": [
    {
      "type": "junior_tools|soft_skills|repetitive|scope_ambiguity|narrative_conflict",
      "message": "string",
      "location": "string",
      "severity": "low|medium|high|critical"
    }
  ]
}`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { originalResume, jobDescription } = await request.json()

    if (!originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Structural] Starting extraction...')

    const prompt = STRUCTURAL_PROMPT
      .replace('{{RESUME}}', originalResume)
      .replace('{{JOB_DESCRIPTION}}', jobDescription)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048, // Enough for complete JSON response
      temperature: 0, // Deterministic extraction
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const duration = Date.now() - startTime

    console.log(`[Structural] Complete (${duration}ms), output: ${responseText.length} chars`)

    const analysis = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Structural]'
    })

    return NextResponse.json({
      analysis,
      metadata: {
        duration_ms: duration,
        model: 'claude-3-5-haiku-20241022',
        output_tokens: responseText.length
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Structural] Error:', error)
    return NextResponse.json(
      {
        error: 'Structural analysis failed',
        details: error instanceof Error ? error.message : 'Unknown',
        duration_ms: duration
      },
      { status: 500 }
    )
  }
}
