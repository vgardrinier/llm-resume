import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'
import type { ResumeChange } from '@/types/api'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Analysis mode: Generate analysis with explicit constraints
async function runAnalysisMode(originalResume: string, jobDescription: string) {
  const analysisPrompt = `You are a résumé strategist. Your job is to analyze the candidate's resume against the job description and create a strategic plan for optimization.

CRITICAL: You are setting the strategy. The generator will follow your constraints exactly.

Analyze:
1. What works (existing strengths)
2. What's missing (gaps the job wants)
3. What keywords/concepts to target
4. What CANNOT be invented (explicit boundaries)
5. What IS safe to add (rewrites, keywords, structure)
6. What requires user input (questions for missing data)

Original Resume:
${originalResume}

Job Description:
${jobDescription}

Return JSON in this format:
{
  "whatWorks": [
    "Strong technical background in Python and distributed systems",
    "Proven track record of leading infrastructure projects"
  ],
  "whatsMissing": [
    "Job emphasizes 'cross-functional collaboration' - not clearly demonstrated",
    "Need more emphasis on metrics and business impact",
    "Should highlight leadership and mentoring experience"
  ],
  "keywordsToTarget": {
    "verbs": ["Led", "Architected", "Scaled", "Optimized", "Mentored"],
    "nouns": ["microservices", "architecture", "scalability", "distributed systems"],
    "concepts": ["cross-functional collaboration", "technical leadership", "system design"],
    "techStack": ["Python", "AWS", "Kubernetes", "Docker", "PostgreSQL"],
    "softSkills": ["leadership", "communication", "strategic thinking"],
    "compliance": []
  },
  "rationaleForChanges": "The original resume has strong technical content but lacks strategic positioning. The job description emphasizes scalable architecture, cross-functional leadership, and measurable impact. We should restructure to lead with these strengths, improve clarity through passive-to-active voice conversions, and enhance keyword alignment. However, we CANNOT invent metrics, technologies, or projects not in the original.",
  "constraints": {
    "cannot_invent": [
      "Metrics/numbers not explicitly in the resume",
      "Technologies or tools not mentioned in original",
      "Team sizes or headcounts not specified",
      "Company names or projects not in original",
      "Specific dates or time periods not mentioned"
    ],
    "safe_to_add": [
      "Keywords from job description (naturally integrated)",
      "Passive-to-active voice conversions",
      "Structural improvements (reordering, clarity)",
      "Emphasis on existing achievements",
      "Better action verbs from existing content"
    ],
    "requires_user_input": [
      "Do you have metrics for project X? (e.g., performance improvements, user growth)",
      "How many people did you lead/manage?",
      "What was the revenue impact or cost savings?",
      "What was the scale/scope of your projects?"
    ]
  }
}

CRITICAL RULES:
- Be explicit about what CANNOT be invented
- Be clear about what IS safe to add
- Ask specific questions for missing data (don't invent it)
- Focus on gaps that can be addressed through rewrites, not fabrication
- The rationale should explain the strategy, not claim things will be invented`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219', // Use Sonnet for strategic thinking
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{ role: 'user', content: analysisPrompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Curator-Structured] Analysis response received, length:', responseText.length)

    const result = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Curator-Structured-Analyze]'
    })

    // Validate required fields
    if (!result.whatWorks || !result.whatsMissing || !result.keywordsToTarget || !result.constraints) {
      throw new Error('Invalid analysis response: missing required fields')
    }

    console.log('[Curator-Structured] Analysis complete', {
      whatWorksCount: result.whatWorks?.length || 0,
      whatsMissingCount: result.whatsMissing?.length || 0,
      cannotInventCount: result.constraints?.cannot_invent?.length || 0,
      requiresInputCount: result.constraints?.requires_user_input?.length || 0
    })

    return NextResponse.json({
      analysis: result,
      feedback: 'Analysis generated with explicit constraints',
      metadata: {
        evaluation_timestamp: new Date().toISOString(),
        model_used: 'claude-3-7-sonnet-20250219'
      }
    })

  } catch (error) {
    console.error('[Curator-Structured] Analysis mode error:', error)
    return NextResponse.json(
      {
        error: 'Analysis generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export interface StructuredCuratorResult {
  // Validated and possibly refined changes (only in validate mode)
  validatedChanges?: ResumeChange[]

  // Validated and possibly corrected optimized resume structure (only in validate mode)
  validatedOptimizedResume?: any // Optional: if provided, use this instead of original

  // Analysis with constraints (only in analyze mode)
  analysis?: Omit<import('@/types/api').ResumeAnalysis, 'fitScoreBefore' | 'fitScoreAfter' | 'subscores'>

  // Quality scores (only in validate mode)
  clarity?: number // 0-100
  relevance?: number // 0-100
  honesty?: number // 0-100

  // Feedback for logging/debugging (not shown to user)
  feedback: string

  // Metadata
  changesRemoved?: number // How many changes were rejected (only in validate mode)
  changesModified?: number // How many changes were refined (only in validate mode)
  metadata?: {
    evaluation_timestamp?: string
    model_used?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mode = 'validate', // 'analyze' or 'validate'
      changes,
      optimizedResume,
      originalResume,
      jobDescription,
      analysis
    } = body

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // ANALYZE MODE: Generate analysis with constraints
    if (mode === 'analyze') {
      if (!originalResume || !jobDescription) {
        return NextResponse.json(
          { error: 'Missing required fields for analysis: originalResume and jobDescription are required' },
          { status: 400 }
        )
      }

      console.log('[Curator-Structured] Starting analysis mode with Claude Sonnet...')
      return await runAnalysisMode(originalResume, jobDescription)
    }

    // VALIDATE MODE: Validate changes (existing behavior)
    if (!changes || !optimizedResume || !originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields for curator validation' },
        { status: 400 }
      )
    }

    console.log('[Curator-Structured] Starting validation mode with Claude Haiku...')
    console.log('[Curator-Structured] Validating', changes.length, 'changes')

    // Build curator prompt
    const curatorPrompt = `You are a résumé quality curator. Your job is to validate proposed changes AND the optimized resume structure to ensure they are:
1. HONEST - No invented facts, metrics, companies, or technologies
2. RELEVANT - Actually improve fit for the job
3. CLEAR - Well-written and professional
4. COMPLETE - All sections have complete, valid content

You will receive:
- Original resume (the truth)
- Proposed changes array (from generator)
- Optimized resume structure (from generator)
- Job description (the target)

Your task:
- Validate each change against the original resume AND the original analysis constraints
- Remove changes that invent facts not in the original (check against analysis.constraints.cannot_invent)
- Ensure changes follow the analysis strategy (check against analysis.constraints.safe_to_add)
- Refine change reasons to be more specific and actionable
- Adjust impactScores if needed
- VALIDATE the optimized resume structure:
  * Education entries MUST match the original resume exactly - do not modify, add, or remove education entries
  * Education entries must have: degree AND institution (at minimum)
  * CRITICAL: If an education entry has a location but NO institution, the location should be moved to institution field
  * CRITICAL: If education entry shows ", [location]" with no institution, parse it correctly - the location IS the institution
  * If education in optimized resume differs from original, replace it with the original education data
  * If education is incomplete in original, keep it as-is (do not invent missing information)
  * All sections should have valid, non-empty content
- Return the validated changes array AND validated optimized resume

CRITICAL RULES:
1. If a change adds a metric/number not in original → REMOVE IT
2. If a change adds a technology not in original → REMOVE IT
3. If a change adds a company/project not in original → REMOVE IT
4. If a change's reason is generic → REFINE IT to be specific
5. Generic reasons like "improves clarity" → make specific: "Job requires X, this highlights your Y experience"
6. SUMMARY VALIDATION: Do NOT remove summary changes unless they invent facts. Summary optimization (adding keywords, improving clarity) is safe and should be preserved. Only remove summary changes that add untrue facts.
7. EDUCATION VALIDATION: Compare education section in optimized resume with original resume. If they differ, use the ORIGINAL education data. Never modify education entries - they must match the original exactly.
8. EDUCATION PARSING FIX: If an education entry has location but no institution, move location to institution. If original shows "Degree, Location" format, parse Location as Institution.
9. If education entry is incomplete in original (missing degree or institution), keep it as-is - do not invent information

Original Resume:
${originalResume}

Job Description:
${jobDescription}

Original Analysis (with constraints - changes MUST follow these):
${analysis ? JSON.stringify(analysis, null, 2) : 'No analysis provided - validate against original resume only'}

Proposed Changes:
${JSON.stringify(changes, null, 2)}

Optimized Resume Structure:
${JSON.stringify(optimizedResume, null, 2)}

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
  "validatedOptimizedResume": {
    // Same structure as optimizedResume, but with:
    // - Complete education entries (degree AND institution required)
    // - Properly categorized skills
    // - All sections with valid content
  },
  "clarity": 85,
  "relevance": 90,
  "honesty": 95,
  "feedback": "Removed 2 changes that violated constraints. Refined 3 reasons to be more specific. All changes validated against original analysis.",
  "changesRemoved": 2,
  "changesModified": 3
}

IMPORTANT: 
- If you modify the optimizedResume structure (e.g., complete education entries, fix skills), return it in "validatedOptimizedResume"
- If no changes needed to resume structure, return the original optimizedResume as-is in "validatedOptimizedResume"
- Education entries MUST have at minimum: degree and institution. If incomplete, complete from original or remove.

Be strict on honesty. Be helpful on clarity. Focus on high-impact changes.
`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Use Haiku for validation - faster and cheaper, validation is simpler than analysis
      max_tokens: 4000,
      temperature: 0.2, // Lower temperature for consistency
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

      // Fallback: return original changes and resume with warning
      return NextResponse.json({
        validatedChanges: changes,
        validatedOptimizedResume: optimizedResume, // Return original as fallback
        clarity: 75,
        relevance: 75,
        honesty: 75,
        feedback: 'Curator validation failed, using original changes and resume',
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
