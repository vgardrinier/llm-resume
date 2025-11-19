import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'
import type { ResumeChange, ResumeSection, StructuredResume } from '@/types/api'

// Utility: Check if a section has content
function hasSectionContent(section: ResumeSection): boolean {
  if (typeof section.content === 'string') {
    return section.content.trim().length > 0
  }
  if (Array.isArray(section.content)) {
    if (section.type === 'experience' || section.type === 'projects') {
      return section.content.length > 0 && section.content.some((entry: any) => 
        entry.bullets && Array.isArray(entry.bullets) && entry.bullets.length > 0
      )
    }
    if (section.type === 'education') {
      return section.content.length > 0 && section.content.some((entry: any) => 
        entry.degree && entry.institution
      )
    }
    return section.content.length > 0
  }
  return false
}

// Utility: Filter out empty sections from resume
function filterEmptySections(resume: StructuredResume): StructuredResume {
  return {
    ...resume,
    sections: resume.sections.filter(hasSectionContent)
  }
}

// Analysis mode: Generate analysis with DSM (Dynamic Semantic Mapping)
async function runAnalysisMode(originalResume: string, jobDescription: string) {
  const analysisPrompt = `<background_information>
You are a résumé analysis expert performing Dynamic Semantic Mapping (DSM) to identify how a candidate's experience can be reinterpreted to match job requirements WITHOUT inventing facts.

You will analyze:
- An original candidate résumé
- A job description

Your goal is to identify safe transformation opportunities, constraints, and optimization strategies while maintaining complete honesty.
</background_information>

<instructions>
Perform the following analysis steps:

1. Extract candidate_domains[] (5-12 themes from résumé: "project coordination", "stakeholder communication", etc.)

2. Extract job_requirement_domains[] (5-12 themes from job: "engineering project management", "risk tracking", etc.)

3. Compute semantic_transformations[] (FROM candidate domain → TO job domain, with confidence 0-1 and reasoning)

4. Identify unmet_requirements[] (job domains requiring new facts)

5. Define safe_rewrites[] (one sentence per rule: how to reframe existing content)

6. Define cannot_invent[] (categories forbidden: metrics, technologies, tasks not in résumé)

7. Define requires_user_input[] (specific questions for unmet requirements)

8. Extract keywordsToTarget {verbs, nouns, concepts, techStack, softSkills, compliance}

9. Identify whatWorks[] and whatsMissing[]

10. Provide rationaleForChanges (strategy summary)

RULES:
- Only create transformations if relationship is genuine and safe
- Never invent tasks/metrics/technologies
- Be explicit about constraints
- If no safe mapping exists, don't force one
</instructions>

## Output description

Return valid JSON with this structure:

{
  "candidate_domains": [...],
  "job_requirement_domains": [...],
  "semantic_transformations": [{"from": "...", "to": "...", "confidence": 0.88, "reasoning": "..."}],
  "unmet_requirements": [...],
  "safe_rewrites": [...],
  "cannot_invent": [...],
  "requires_user_input": [...],
  "whatWorks": [...],
  "whatsMissing": [...],
  "keywordsToTarget": {"verbs": [...], "nouns": [...], "concepts": [...], "techStack": [...], "softSkills": [...], "compliance": []},
  "rationaleForChanges": "...",
  "constraints": {"cannot_invent": [...], "safe_to_add": [...], "requires_user_input": [...]}
}

Original Resume:
${originalResume}

Job Description:
${jobDescription}`

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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

    // Validate required fields (keep existing fields required for backward compatibility)
    if (!result.whatWorks || !result.whatsMissing || !result.keywordsToTarget || !result.constraints) {
      throw new Error('Invalid analysis response: missing required fields')
    }

    // Ensure DSM fields are properly structured (they're optional but should be arrays if present)
    if (result.semantic_transformations && !Array.isArray(result.semantic_transformations)) {
      console.warn('[Curator-Structured] semantic_transformations is not an array, converting')
      result.semantic_transformations = []
    }
    if (result.candidate_domains && !Array.isArray(result.candidate_domains)) {
      console.warn('[Curator-Structured] candidate_domains is not an array, converting')
      result.candidate_domains = []
    }
    if (result.job_requirement_domains && !Array.isArray(result.job_requirement_domains)) {
      console.warn('[Curator-Structured] job_requirement_domains is not an array, converting')
      result.job_requirement_domains = []
    }
    if (result.unmet_requirements && !Array.isArray(result.unmet_requirements)) {
      console.warn('[Curator-Structured] unmet_requirements is not an array, converting')
      result.unmet_requirements = []
    }
    if (result.safe_rewrites && !Array.isArray(result.safe_rewrites)) {
      console.warn('[Curator-Structured] safe_rewrites is not an array, converting')
      result.safe_rewrites = []
    }

    // Keep safe_rewrites and constraints.safe_to_add SEPARATE - they serve different purposes:
    // - safe_rewrites: Rewrite patterns/transformations (how to reframe existing content)
    // - constraints.safe_to_add: New content that can be added (keywords, structure, clarity improvements)
    // Do NOT merge them - this preserves semantic clarity and prevents generator confusion

    console.log('[Curator-Structured] Analysis complete', {
      whatWorksCount: result.whatWorks?.length || 0,
      whatsMissingCount: result.whatsMissing?.length || 0,
      cannotInventCount: result.constraints?.cannot_invent?.length || 0,
      requiresInputCount: result.constraints?.requires_user_input?.length || 0,
      semanticTransformationsCount: result.semantic_transformations?.length || 0,
      candidateDomainsCount: result.candidate_domains?.length || 0,
      jobRequirementDomainsCount: result.job_requirement_domains?.length || 0
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
    const curatorPrompt = `<background_information>
You are a résumé quality curator. Your job is to validate proposed changes AND the optimized resume structure to ensure they are:
1. HONEST - No invented facts, metrics, companies, or technologies
2. RELEVANT - Actually improve fit for the job
3. CLEAR - Well-written and professional
4. COMPLETE - All sections have complete, valid content

You will receive:
- Original resume (the truth)
- Proposed changes array (from generator)
- Optimized resume structure (from generator)
- Job description (the target)
- Original analysis with constraints (changes MUST follow these)
</background_information>

<instructions>
Your task is to validate each change against the original resume AND the original analysis constraints:

1. Validate changes for honesty:
   - Check if changes properly use semantic transformations (FROM → TO mappings) when applicable
   - Remove changes that invent facts not in the original (check against analysis.constraints.cannot_invent)
   - If a change adds a metric/number not in original → REMOVE IT
   - If a change adds a technology not in original → REMOVE IT
   - If a change adds a company/project not in original → REMOVE IT

2. Validate changes follow analysis patterns:
   - Distinguish between rewrite patterns and addable content:
     * analysis.safe_rewrites = rewrite patterns (for transforming existing content)
     * analysis.constraints.safe_to_add = addable content (keywords, structure, clarity)
   - Ensure rewrite changes follow analysis.safe_rewrites patterns
   - Ensure addition changes follow analysis.constraints.safe_to_add permissions
   - Verify changes respect semantic_transformations: they should reframe existing experience, not invent new content

3. Validate semantic transformations (if analysis.semantic_transformations exist):
   - Changes should reframe existing experience using FROM → TO mappings, not invent new content
   - Transformations should ONLY be applied when the original content clearly supports the FROM domain
   - If a change applies a transformation to unrelated content → REMOVE IT
   - If a change claims to use a transformation but invents content → REMOVE IT
   - Do NOT allow over-application: not every bullet needs transformation - preserve authenticity when transformation doesn't fit
   - If a transformation seems illogical → REMOVE the change even if it claims to use the transformation
   - Trust your judgment: if a FROM → TO mapping doesn't make logical sense given the actual resume content, reject changes that use it

4. Refine change reasons:
   - Refine change reasons to be direct, honest, and conversational — use plain English, no technical jargon
   - For ADDITIONS: Explain why we're adding new content (never mention "semantic transformation" — there's nothing to transform!)
   - For MODIFICATIONS: Explain the improvement in plain language (avoid technical terms like "semantic transformation")
   - Generic reasons like "improves clarity" → make specific: "Job requires X, this highlights your Y experience"
   - NEVER use technical terms like "semantic transformation" — explain in plain English what changed and why it helps
   - TONE: Direct, honest, conversational (like a helpful coach), 1-2 sentences max
   - Keep reasons concise (1-2 sentences), specific, and helpful

5. Validate optimized resume structure:
   - Education entries MUST match the original resume exactly - do not modify, add, or remove education entries
   - Education entries must have: degree AND institution (at minimum)
   - CRITICAL: If an education entry has a location but NO institution, the location should be moved to institution field
   - CRITICAL: If education entry shows ", [location]" with no institution, parse it correctly - the location IS the institution
   - If education in optimized resume differs from original, replace it with the original education data
   - If education is incomplete in original, keep it as-is (do not invent missing information)
   - All sections should have valid, non-empty content

6. Adjust impactScores if needed

7. Return the validated changes array AND validated optimized resume

CRITICAL RULES:
- Do not confuse safe_rewrites (rewrite patterns) with safe_to_add (addable content). Rewrite patterns apply to modifications, addable content applies to additions.
- SUMMARY VALIDATION: Do NOT remove summary changes unless they invent facts. Summary optimization (adding keywords, improving clarity) is safe and should be preserved. Only remove summary changes that add untrue facts.
- EDUCATION VALIDATION: Compare education section in optimized resume with original resume. If they differ, use the ORIGINAL education data. Never modify education entries - they must match the original exactly.
- EDUCATION PARSING FIX: If an education entry has location but no institution, move location to institution. If original shows "Degree, Location" format, parse Location as Institution.
- If education entry is incomplete in original (missing degree or institution), keep it as-is - do not invent information
</instructions>

## Output description

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
`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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

      // Filter empty sections from validated resume if provided
      if (result.validatedOptimizedResume) {
        const filteredResume = filterEmptySections(result.validatedOptimizedResume)
        const removedSectionsCount = result.validatedOptimizedResume.sections?.length - filteredResume.sections.length
        if (removedSectionsCount > 0) {
          console.log(`[Curator-Structured] Removed ${removedSectionsCount} empty section(s) from validated resume`)
        }
        result.validatedOptimizedResume = filteredResume
      }

      // Log detailed breakdown of validated changes
      const validatedByType = result.validatedChanges.reduce((acc: any, c: any) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
      }, {})
      
      const validatedBySection = result.validatedChanges.reduce((acc: any, c: any) => {
        const section = c.section || 'unknown'
        acc[section] = (acc[section] || 0) + 1
        return acc
      }, {})
      
      const validatedWithPositions = result.validatedChanges.filter((c: any) => 
        c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined
      ).length
      
      const validatedWithOriginal = result.validatedChanges.filter((c: any) => 
        c.original && c.original.trim().length > 0
      ).length

      console.log('[Curator-Structured] Validation complete', {
        originalCount: changes.length,
        validatedCount: result.validatedChanges.length,
        removed: result.changesRemoved || 0,
        modified: result.changesModified || 0,
        clarity: result.clarity,
        relevance: result.relevance,
        honesty: result.honesty,
        validatedByType,
        validatedBySection,
        validatedWithPositions,
        validatedWithOriginalField: validatedWithOriginal,
        modificationsWithoutOriginal: result.validatedChanges.filter((c: any) => 
          c.type === 'modification' && (!c.original || c.original.trim().length === 0)
        ).length
      })
      
      // Log modifications that might be missing original field
      const validatedModifications = result.validatedChanges.filter((c: any) => c.type === 'modification')
      if (validatedModifications.length > 0) {
        console.log('[Curator-Structured] Validated modifications detail:', validatedModifications.map((c: any) => ({
          id: c.id,
          section: c.section,
          hasOriginal: !!(c.original && c.original.trim().length > 0),
          hasPosition: !!(c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined),
          position: c.position,
          originalPreview: c.original?.substring(0, 50),
          suggestedPreview: c.suggested?.substring(0, 50)
        })))
      }

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

      // Fallback: return original changes and resume with warning (filter empty sections)
      const filteredFallbackResume = filterEmptySections(optimizedResume)
      return NextResponse.json({
        validatedChanges: changes,
        validatedOptimizedResume: filteredFallbackResume, // Return filtered original as fallback
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
