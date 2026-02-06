import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'
import crypto from 'crypto'

export const maxDuration = 120

/**
 * FAST MODE - Single-pass resume optimization
 *
 * Goal: 20-30s total time, tight diffs, built-in validation
 * Trade-off: No separate diagnostic panel, curator, or fit scoring
 */

function generateChangeId(section: string, originalText: string): string {
  const input = `${section}\n${originalText.trim()}`
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  return `${section}_${hash.substring(0, 10)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { originalResume, jobDescription } = body

    // Extract job metadata from URL extraction (if available)
    const jobTitle = body.job_title || body.jobTitle || 'Position'
    const companyName = body.company || body.companyName || null

    if (!originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Fast-Mode] Starting single-pass optimization...')
    const startTime = Date.now()

    const prompt = `You are a PREMIUM RESUME OPTIMIZER working in FAST MODE.

Your job: Parse the resume, apply strategic transformations, output optimized CV + changes.

ORIGINAL RESUME:
${originalResume}

TARGET JOB:
${jobDescription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1: PARSE + TRANSFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PARSE STRUCTURE
Extract:
- contactInfo (name, email, phone, location)
- sections array (Summary, Experience, Education, Skills, etc.)

2. ANALYZE STRATEGICALLY (lightweight, inline)
- Role relevance: Which roles are HIGH/MEDIUM/LOW match to job?
- Language altitude: Current level (2-4), can we lift it?
- Metric gaps: Find 3 max bullets where impact is CLAIMED but NO number exists
- Key themes: What does the job prioritize? (ownership, scale, innovation, etc.)

3. APPLY TRANSFORMATIONS
Based on inline analysis:

EXPERIENCE:
- HIGH match roles: EXPAND to 6-7 bullets with metrics and impact
- MEDIUM match roles: COMPRESS to 2-3 focused bullets
- LOW match roles: MINIMIZE to 1 bullet or title-only

ALTITUDE:
- Lift language where possible (respect ceiling)
- Level 2→3: "coordinated" → "owned", "assisted" → "led"
- Level 3→4: add strategic framing, business context

METRICS (cap at 3 opportunities total):
- Only flag bullets where impact CLAIMED but NO metric exists
- For each: generate TWO variants
  1. suggested: neutral fallback (e.g. "improved performance measurably")
  2. suggested_with_metric: placeholder (e.g. "improved performance by [X]%")
- NEVER invent numbers

SUMMARY:
- Rewrite to emphasize job's key themes
- Match tone (technical depth vs leadership vs innovation)

4. TRACK CHANGES
For each modification, create change object with:
- section, original, suggested, suggested_with_metric (if metric opportunity)
- reason (1 sentence, strategic value)
- impactScore (1-10)
- evidence (SHORT QUOTE from original text this change is based on, or null if pure rewrite)
- metric_opportunity (only if applicable, with question + placeholder_format + neutral_fallback)

Cap at 12-15 changes. Quality over quantity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2: HONESTY PASS (critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before final output, scan EVERY change:

REMOVE if change invents:
- Numbers not in original (e.g. adding "35%" when no % exists)
- Technologies not in original (e.g. adding "React" when only "JavaScript" mentioned)
- Companies/projects not in original
- Facts not supported (e.g. "led team of 5" when no team size mentioned)
- Impact claims not in original (e.g. "increased revenue" when original says "supported sales")

REMOVE if:
- Change is no-op (original === suggested)
- Change is cosmetic only (e.g. just capitalization)

ALLOWED:
- Qualitative improvements IF impact was in original (e.g. "improved" → "improved significantly")
- Reordering/restructuring
- Language lifting (tactical → strategic) if ceiling allows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return valid JSON (no markdown, no wrapper):

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
      "id": "temp-N",
      "type": "addition|modification",
      "section": "Summary|Experience|Skills|Education",
      "original": "exact text from original (or empty string for additions)",
      "suggested": "improved text (always valid, uses fallback if needed)",
      "suggested_with_metric": "version with placeholder (only if metric_opportunity exists)",
      "evidence": "short quote from original this is based on, or null",
      "metric_opportunity": {
        "question": "What % did you improve performance by?",
        "placeholder_format": "[X]%",
        "neutral_fallback": "measurably"
      },
      "reason": "Why this change matters strategically",
      "impactScore": 8,
      "position": {
        "sectionIndex": 0,
        "bulletIndex": 0
      }
    }
  ],
  "honesty_validation": {
    "changes_before_validation": 0,
    "changes_after_validation": 0,
    "removed_changes": []
  }
}

CRITICAL:
- optimizedResume MUST have contactInfo AND sections array
- sections array MUST be complete
- Each change MUST have evidence field
- No invented facts
- 6000-8000 token output max (tight diffs, not prose)`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const genTime = Date.now() - startTime

    console.log(`[Fast-Mode] Generated (${genTime}ms), length: ${responseText.length}`)

    const result = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Fast-Mode]'
    })

    if (!result.optimizedResume || !result.changes) {
      throw new Error('Invalid fast mode response structure')
    }

    // Validate required structure
    if (!result.optimizedResume.sections || !Array.isArray(result.optimizedResume.sections)) {
      console.error('[Fast-Mode] Missing sections array')
      result.optimizedResume.sections = []
    }

    // ALWAYS regenerate deterministic change IDs (never trust model output)
    result.changes = result.changes.map((change: any) => {
      const deterministicId = generateChangeId(change.section, change.original || '')
      return {
        ...change,
        id: deterministicId
      }
    })

    console.log('[Fast-Mode] Complete:', {
      totalTime: genTime,
      changesCount: result.changes.length,
      sectionsCount: result.optimizedResume.sections.length,
      validationStats: result.honesty_validation
    })

    // Create minimal analysis object for UI compatibility
    const analysis = {
      rationaleForChanges: 'Fast Mode focuses on quick, high-impact optimizations without deep diagnostic analysis.',
      fitScoreBefore: 0,
      fitScoreAfter: 0,
      // Optional fields that UI may check for
      culture: undefined,
      altitude: undefined,
      metrics: undefined,
      summary: undefined
    }

    return NextResponse.json({
      optimizedResume: result.optimizedResume,
      changes: result.changes,
      analysis,
      metadata: {
        generation_time_ms: genTime,
        model: 'claude-sonnet-4-20250514',
        mode: 'fast',
        job_metadata: {
          title: jobTitle,
          company: companyName
        }
      }
    })

  } catch (error) {
    console.error('[Fast-Mode] Error:', error)
    return NextResponse.json(
      {
        error: 'Fast optimization failed',
        details: error instanceof Error ? error.message : 'Unknown'
      },
      { status: 500 }
    )
  }
}
