import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'

/**
 * PREMIUM ANALYZER
 *
 * What it does: Deep strategic analysis of resume vs job
 * NOT keyword matching - this is TRANSFORMATION planning
 *
 * Returns:
 * - Scope synthesis (hidden seniority signals)
 * - Altitude analysis (current level vs possible lift)
 * - LP mapping (company culture alignment)
 * - Experience architecture (which roles to expand/compress)
 * - Metric opportunities (where to ask for numbers)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { originalResume, jobDescription } = body

    if (!originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: originalResume and jobDescription' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('[Premium-Analyzer] Starting deep analysis...')
    const startTime = Date.now()

    // THE PREMIUM ANALYZER PROMPT
    // This is where the magic happens - we ask Claude to think strategically
    const analysisPrompt = `You are an expert resume strategist performing deep transformation analysis.

INPUT:
- Original Resume (candidate's current state)
- Job Description (target role)

YOUR MISSION:
Analyze this resume to plan a TRANSFORMATION, not just keyword matching.
This is premium-tier strategic coaching.

<original_resume>
${originalResume}
</original_resume>

<job_description>
${jobDescription}
</job_description>

PERFORM 9-LAYER ANALYSIS:

1. SCOPE SYNTHESIS
Extract hidden seniority signals from raw facts:
- Throughput signals (volume, frequency, scale)
- Complexity signals (stakeholders, systems, domains)
- Ownership signals (accountability, end-to-end, initiative)
- Cross-industry taxonomy: map numbers to role-appropriate meaning
  * Tech: users served, systems owned, features shipped
  * Finance: AUM, deal size, investor relationships
  * Operations: throughput, cycle time, efficiency gains
  * Product: customers, features, roadmap items
  * Sales: quota, pipeline, close rate
- Latent product relevance: convert non-product work to product-adjacent signals
  * "investor cadence" → "stakeholder cycle management"
  * "photo production" → "production lifecycle ownership"
  * "task tracking" → "process systems thinking"

Output: inferred_seniority_level, scope_signals, industry_context, product_analogues

2. ALTITUDE ANALYSIS
Detect current altitude and realistic lift potential:
- Level 1: Tasks ("scheduled", "created", "updated")
- Level 2: Coordination ("managed", "coordinated", "organized")
- Level 3: Ownership ("owned", "drove", "led")
- Level 4: Strategic ("defined", "shaped", "architected")
- Level 5: Leadership ("built", "transformed", "pioneered")

For each role and bullet, determine:
- current_altitude
- realistic_ceiling (based on scope evidence)
- can_lift (true if evidence supports 1-2 level increase)

CRITICAL: If scope doesn't support lift, flag fallback_mode = "clarity_only"

3. COMPANY CULTURE MAPPING
Detect target company and map to culture framework:
- Amazon → Leadership Principles (Ownership, Deliver Results, Dive Deep, etc.)
- Google → Innovation + Scale + Technical Depth
- Startup → Scrappy + Generalist + Growth
- Enterprise → Process + Stakeholder Management + Compliance

For each LP/value:
- positive_signals: what to look for
- negative_signals: anti-patterns to remove
- intensity_in_jd: count mentions in job description
- mapping: which bullets can be reframed to show this

4. EXPERIENCE ARCHITECTURE
Score each role for strategic restructuring:
- relevance_to_target (0-10)
- recency (0-10)
- seniority_signal (0-10)
- impact_potential (0-10)
- total_strength (sum)

Then categorize:
- EXPAND (25+): 6-7 bullets, high detail, 60-70% of space
- COMPRESS (15-24): 2-3 bullets, transferable skills only
- MINIMIZE (<15): Title only or remove

5. METRIC OPPORTUNITIES
For each bullet, identify:
- existing_metrics: numbers already present
- inferrable_metrics: can ask user (team size, budget, outcome)
- placeholder_candidates: where estimated improvement makes sense
- questions_for_user: specific, high-value questions

Only flag metrics that add seniority signal (not "emails sent").

6. RED FLAG DETECTION
Identify what hurts competitiveness:
- junior_tools: tools that weaken seniority perception
- soft_skills_fluff: "detail-oriented", "team player" (remove)
- repetitive_phrasing: same verb 3+ times
- scope_ambiguity: no numbers anywhere
- narrative_conflicts: summary claims exceed bullet evidence

7. SUMMARY STRATEGY
Design magnetic 2-liner with industry lens:
- Detect industry: fintech, healthcare, SaaS, creative, etc.
- Industry-appropriate tone and emphasis
- Seniority + domain + scope + capabilities

8. ALTITUDE COHERENCE CHECK
Ensure consistency:
- summary_altitude ≈ top_role_altitude ≈ skills_language_altitude
- Flag if misaligned

9. COMPETITIVE SCORING
Before optimization score:
- overall (0-10)
- critical_gaps
- realistic_target_level (might be lower than job title)

After optimization potential:
- realistic_ceiling (honest max)
- required_user_input
- honest_feedback (if applying too high, say so)

OUTPUT JSON:
{
  "scope_synthesis": {
    "throughput_signals": {...},
    "complexity_signals": {...},
    "ownership_signals": {...},
    "industry_context": "string",
    "inferred_seniority": "string",
    "product_analogues": ["string"],
    "realistic_altitude_ceiling": "Level X"
  },
  "altitude_analysis": {
    "current_altitude": "Level X",
    "can_lift": true/false,
    "target_altitude": "Level X",
    "fallback_mode": null or "clarity_only",
    "coherence_issues": ["string"]
  },
  "company_culture": {
    "detected_company": "string",
    "culture_type": "amazon_lp|google|startup|enterprise",
    "leadership_principles": [
      {
        "name": "Ownership",
        "intensity_in_jd": 8,
        "current_signal": "weak",
        "applicable_bullets": [0, 2, 5],
        "negative_signals_found": ["supported", "assisted"]
      }
    ]
  },
  "experience_architecture": [
    {
      "role_index": 0,
      "role_title": "string",
      "scores": {
        "relevance": 7,
        "recency": 10,
        "seniority": 6,
        "impact": 7,
        "total": 30
      },
      "strategy": "EXPAND|COMPRESS|MINIMIZE",
      "target_bullets": 7,
      "detail_level": "high|medium|low"
    }
  ],
  "metric_opportunities": [
    {
      "bullet_index": 0,
      "current_text": "string",
      "existing_metrics": ["string"],
      "inferrable_metrics": ["team size", "budget"],
      "questions_for_user": ["How many people on the team?"],
      "value_preview": "Adding team size lifts this from 6/10 to 9/10"
    }
  ],
  "red_flags": [
    {
      "type": "junior_tools|soft_skills|repetitive|scope_ambiguity|narrative_conflict",
      "issue": "string",
      "location": "string",
      "fix": "string",
      "severity": "critical|high|medium|low"
    }
  ],
  "summary_strategy": {
    "industry_lens": "fintech|healthcare|saas|creative|enterprise",
    "tone": "string",
    "key_elements": ["seniority", "domain", "scope", "capabilities"],
    "draft_summary": "string"
  },
  "competitive_analysis": {
    "before_score": "6.2/10",
    "critical_gaps": ["string"],
    "realistic_target_level": "PM (not Senior PM)",
    "after_potential": "8.5/10 at realistic level",
    "honest_feedback": "string",
    "required_user_input_count": 7
  }
}

Be thorough. Be honest. This is premium coaching.`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3, // Slightly higher for creative strategic thinking
      messages: [{ role: 'user', content: analysisPrompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const analysisTime = Date.now() - startTime

    console.log(`[Premium-Analyzer] Analysis received (${analysisTime}ms), length: ${responseText.length}`)

    const result = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Premium-Analyzer]'
    })

    // Validate critical fields
    if (!result.scope_synthesis || !result.altitude_analysis || !result.competitive_analysis) {
      throw new Error('Invalid analysis response: missing critical fields')
    }

    console.log('[Premium-Analyzer] Analysis complete:', {
      industry: result.scope_synthesis?.industry_context,
      currentAltitude: result.altitude_analysis?.current_altitude,
      canLift: result.altitude_analysis?.can_lift,
      companyDetected: result.company_culture?.detected_company,
      rolesAnalyzed: result.experience_architecture?.length || 0,
      metricOpportunities: result.metric_opportunities?.length || 0,
      redFlags: result.red_flags?.length || 0,
      competitiveScore: result.competitive_analysis?.before_score
    })

    return NextResponse.json({
      analysis: result,
      metadata: {
        analysis_time_ms: analysisTime,
        model_used: 'claude-sonnet-4-20250514',
        version: 'premium-v1.0'
      }
    })

  } catch (error) {
    console.error('[Premium-Analyzer] Error:', error)
    return NextResponse.json(
      {
        error: 'Premium analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
