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

function generateChangeId(section: string, originalText: string, suggestedText: string): string {
  const input = `${section}\n${originalText.trim()}\n${suggestedText.trim()}`
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

    console.log('[Fast-Mode] ⚡ Starting single-pass optimization...')
    const startTime = Date.now()
    const timings = {
      start: startTime,
      llmStart: 0,
      llmEnd: 0,
      parseEnd: 0,
      total: 0
    }

    const prompt = `You are an EXPERT RESUME OPTIMIZER working in FAST MODE.

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
- CRITICAL: PRESERVE ALL SECTIONS from original resume (Summary, Experience, Education, Skills, etc.)
- NEVER delete entire sections - only modify content within them

2. ANALYZE STRATEGICALLY (lightweight, inline)
- Role relevance: Which roles are HIGH/MEDIUM/LOW match to job?
- Language altitude: Current level (2-4), can we lift it?
- Metric gaps: Find 3 max bullets where impact is CLAIMED but NO number exists
- Key themes: What does the job prioritize? (ownership, scale, innovation, etc.)

3. APPLY TRANSFORMATIONS
Based on inline analysis:

EXPERIENCE - CRITICAL WORKFLOW:

For EACH company in the original resume, follow this exact process:

1. Read ONLY that company's section from the original
2. Note what work was done AT THAT SPECIFIC COMPANY
3. Write improved bullets using ONLY information from THAT company's section
4. Move to next company and repeat

Example workflow (generic):

Step 1 - Process Company A:
  Read original bullets under "Company A"
  Output: {
    "company": "Company A",
    "bullets": [improved versions of ONLY Company A's work]
  }

Step 2 - Process Company B:
  Read original bullets under "Company B"
  Output: {
    "company": "Company B",
    "bullets": [improved versions of ONLY Company B's work]
  }

ABSOLUTE RULES:
- Each company in output JSON MUST contain ONLY bullets derived from that same company in the original resume
- NEVER take a bullet from Company A in the original and put it under Company B in the output
- If you see "Company X: built product Y" in original → "built product Y" MUST appear under Company X in output, nowhere else
- Content isolation is MORE important than making the resume sound impressive

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
PHASE 2: CONTENT ISOLATION CHECK (critical - prevents mixing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: For each company in original resume, identify 2-3 unique domain keywords
Example: If Company A worked on "solar energy systems" → keywords: ["solar", "energy"]
         If Company B worked on "venture investments" → keywords: ["venture", "investment"]

Step 2: Cross-reference validation
For EACH company in your output:
- Verify every bullet uses keywords that appeared under THAT SAME company in the original
- If a bullet mentions keywords from a different company → DELETE that bullet immediately
- Better to have fewer bullets than to mix company content

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: HONESTY PASS (critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before final output, scan EVERY change:

REMOVE if change invents:
- Numbers not in original (e.g. adding "35%" when no % exists)
- Technologies not in original (e.g. adding "React" when only "JavaScript" mentioned)
- Companies/projects not in original
- Facts not supported (e.g. "led team of 5" when no team size mentioned)
- Impact claims not in original (e.g. "increased revenue" when original says "supported sales")

REMOVE if change mixes content between companies:
- CRITICAL: For EACH bullet in optimizedResume.sections[Experience].content[i].bullets, verify it came from the SAME company in the original resume
- Example of VIOLATION: If Solarmente's bullets mention "solar energy" or "smart contracts", but Front Row Ventures' bullets now contain those phrases → DELETE those Front Row bullets
- Example of VIOLATION: If original resume shows Front Row Ventures doing "venture capital" work, but optimized resume shows them doing "solar energy" → DELETE those bullets
- YOU MUST cross-reference EVERY bullet with the original resume's company sections before including it
- When in doubt, DELETE the bullet rather than risk mixing content

REMOVE if:
- Change is no-op (original === suggested)
- Change is cosmetic only (e.g. just capitalization)

ALLOWED:
- Qualitative improvements IF impact was in original (e.g. "improved" → "improved significantly")
- Reordering bullets WITHIN the same company (but bullets cannot move between companies)
- Language lifting (tactical → strategic) if ceiling allows

NEVER ALLOWED:
- Moving bullets from one company to another company
- Combining work from multiple companies under one company header
- Any form of cross-company content transfer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4: OUTPUT
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
            "company": "string (MUST match EXACTLY the company name from original resume)",
            "role": "string",
            "dates": "string",
            "bullets": ["string (MUST come from the SAME company in original resume - NO cross-company content)"]
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

    timings.llmStart = Date.now()
    console.log(`[Fast-Mode] 🤖 Calling Sonnet 4.5...`)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 - best available model
      max_tokens: 8000,
      temperature: 0.3, // Lowered from 0.4 for more deterministic output
      messages: [{ role: 'user', content: prompt }]
    })

    timings.llmEnd = Date.now()
    const llmTime = timings.llmEnd - timings.llmStart
    console.log(`[Fast-Mode] ✅ LLM response received (${llmTime}ms)`)

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log(`[Fast-Mode] 📄 Response length: ${responseText.length} chars`)

    const result = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Fast-Mode]'
    })

    timings.parseEnd = Date.now()
    const parseTime = timings.parseEnd - timings.llmEnd
    console.log(`[Fast-Mode] 📝 Parsed JSON (${parseTime}ms)`)

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
      const deterministicId = generateChangeId(
        change.section,
        change.original || '',
        change.suggested || ''
      )
      return {
        ...change,
        id: deterministicId
      }
    })

    timings.total = Date.now() - startTime

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Fast-Mode] ⚡ COMPLETE - Performance Breakdown:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  🤖 LLM Generation:  ${llmTime}ms (${Math.round(llmTime/timings.total*100)}%)`)
    console.log(`  📝 JSON Parsing:    ${parseTime}ms (${Math.round(parseTime/timings.total*100)}%)`)
    console.log(`  ⚙️  Processing:      ${(timings.total - llmTime - parseTime)}ms`)
    console.log(`  ⏱️  TOTAL TIME:      ${timings.total}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  📊 Changes: ${result.changes.length}`)
    console.log(`  📄 Sections: ${result.optimizedResume.sections.length}`)
    console.log(`  ✅ Validation: ${result.honesty_validation?.changes_after_validation || 'N/A'} changes after honesty pass`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

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
        generation_time_ms: timings.total,
        model: 'claude-sonnet-4-5-20250929',
        mode: 'fast',
        job_metadata: {
          title: jobTitle,
          company: companyName
        },
        timings: {
          llm_ms: llmTime,
          parse_ms: parseTime,
          total_ms: timings.total
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
