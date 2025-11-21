import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJobTitleAndLocation, lookupSalary, generateSalaryContext } from '@/lib/utils/salaryMCP'
import { parseClaudeJson } from '@/lib/utils/parseJson'
import type { StructuredResumeResponse, ResumeChange, ResumeAnalysis, StructuredResume, ResumeSection } from '@/types/api'
import { randomUUID } from 'crypto'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      job_description, 
      candidate_resume, 
      creative_mode = 'balanced',
      analysis // Optional: analysis from curator-analyzer with constraints
    } = body

    console.log('[Generator-Structured] Request received', {
      step: 'start',
      hasJob: !!job_description,
      hasResume: !!candidate_resume,
      hasAnalysis: !!analysis,
      jobLength: job_description?.length || 0,
      resumeLength: candidate_resume?.length || 0,
      creativeMode: creative_mode,
    })

    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('[Generator-Structured] Starting structured resume generation with Claude Haiku...')

    // Analysis is now required (generator no longer produces it)
    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis is required - generator requires analysis from upstream analyzer' },
        { status: 400 }
      )
    }

    // Keywords removed from prompt (redundant - can be inferred from semantic transformations)

    // Start salary lookup in parallel (doesn't affect prompt quality)
    // This can run concurrently with prompt building and the main API call
    const salaryLookupPromise = (async () => {
      try {
        const { role, location } = await extractJobTitleAndLocation(job_description)
        const salaryData = await lookupSalary({ role, location })
        console.log('[Generator-Structured] Salary lookup result:', salaryData ? `${salaryData.median.toLocaleString()} median` : 'No data')
        return salaryData
      } catch (error) {
        console.warn('[Generator-Structured] Salary lookup failed, continuing without it:', error)
        return null
      }
    })()

    // Build DSM semantic transformations section (condensed)
    const semanticTransformationsSection = analysis?.semantic_transformations && analysis.semantic_transformations.length > 0 ? `
SEMANTIC TRANSFORMATIONS (apply ONLY when original content supports FROM domain):
${analysis.semantic_transformations.map((t: { from: string; to: string; confidence: number; reasoning: string }) => 
  `- "${t.from}" → "${t.to}" (${(t.confidence * 100).toFixed(0)}%): ${t.reasoning}`
).join('\n')}
` : ''

    // Build constraints section (condensed)
    const constraintsSection = analysis?.constraints ? `
CONSTRAINTS:
Cannot invent: ${analysis.constraints.cannot_invent.join('; ')}
Safe to add: ${analysis.constraints.safe_to_add.join('; ')}
` : ''

    // Build safe rewrites section (condensed)
    const safeRewritesSection = analysis?.safe_rewrites && analysis.safe_rewrites.length > 0 ? `
SAFE REWRITES (for existing content only):
${analysis.safe_rewrites.map((rule: string) => `- ${rule}`).join('\n')}
` : ''

    // Build what's missing section (CRITICAL: generator must address these gaps)
    const whatsMissingSection = analysis?.whatsMissing && analysis.whatsMissing.length > 0 ? `
WHAT'S MISSING (address these gaps where possible using safe_to_add permissions):
${analysis.whatsMissing.map((item: string) => `- ${item}`).join('\n')}
` : ''

    // Build unmet requirements section (requirements that need new facts - use requires_user_input)
    const unmetRequirementsSection = analysis?.unmet_requirements && analysis.unmet_requirements.length > 0 ? `
UNMET REQUIREMENTS (cannot be addressed without new facts - note in changes if relevant):
${analysis.unmet_requirements.map((req: string) => `- ${req}`).join('\n')}
` : ''

    // Build what works section (for context - preserve these strengths)
    const whatWorksSection = analysis?.whatWorks && analysis.whatWorks.length > 0 ? `
WHAT WORKS (preserve and build on these strengths):
${analysis.whatWorks.map((item: string) => `- ${item}`).join('\n')}
` : ''

    // Build strategy section (condensed)
    const strategySection = analysis?.rationaleForChanges ? `STRATEGY: ${analysis.rationaleForChanges}` : ''

    // Ultra-tight prompt - Sonnet 4.0 infers from schema
    const systemPrompt = `Optimize resume for job. Never invent facts.

ANALYSIS:
${whatWorksSection}${whatsMissingSection}${unmetRequirementsSection}${semanticTransformationsSection}${constraintsSection}${safeRewritesSection}${strategySection}

Return valid JSON:

{
  "optimizedResume": {
    "contactInfo": { "name", "email", "phone", "location", "linkedin", "website" },
    "sections": [
      { "type": "summary", "title": "Professional Summary", "content": "..." },
      { "type": "experience", "title": "Experience", "content": [
        { "title", "company", "location", "dates", "bullets": [...] }
      ]},
      { "type": "education", "title": "Education", "content": [...] },
      { "type": "skills", "title": "Skills", "content": [...] }
    ]
  },
  "changes": [
    {
      "id": "change-1",
      "type": "addition|modification|deletion",
      "section": "Summary|Experience|Education|Skills",
      "suggested": "...",
      "original": "...",
      "reason": "Direct, honest explanation in plain English: why this change helps (e.g., 'Adds professional summary highlighting your engineering experience — recruiters expect this' or 'Reframes project coordination to emphasize engineering project management — same skills, better framing')",
      "impactScore": 1-10,
      "position": { "sectionIndex": 0, "bulletIndex": 0 }
    }
  ]
}

Track ALL changes in changes array. Direct, honest reasons (1-2 sentences).

Job Description:
${job_description}

Candidate Resume:
${candidate_resume}`

    // Use Haiku for speed and cost efficiency (structured JSON should work fine)
    // Increased max_tokens to handle full structured resume + changes array
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Upgraded from Haiku - generator needs intelligence for high-quality changes
      max_tokens: 3500, // Reduced but safe for structured output
      temperature: 0, // Deterministic = faster, structured JSON doesn't need creativity
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Generator-Structured] Anthropic API response received, length:', responseText.length)
    
    // Check if response was truncated (Haiku max is 4096 tokens, ~16k chars typically)
    const isLikelyTruncated = responseText.length > 15000 || 
      (message.stop_reason === 'max_tokens' && message.stop_sequence === null)
    
    if (isLikelyTruncated) {
      console.warn('[Generator-Structured] Response may be truncated - max_tokens limit reached')
    }

    // Parse Claude's JSON response (generator no longer returns analysis)
    let result: {
      optimizedResume: StructuredResume
      changes: ResumeChange[]
    }

    try {
      result = parseClaudeJson(responseText, {
        attemptEscapeFix: true,
        errorPrefix: '[Generator-Structured]'
      })

      // Validate required fields (no analysis expected from generator)
      if (!result.optimizedResume || !result.changes) {
        console.error('[Generator-Structured] Invalid response structure:', result)
        throw new Error('Invalid response structure - missing required fields')
      }

      console.log('[Generator-Structured] Successfully generated structured resume')
      
      // Log detailed breakdown of changes
      const changesByType = result.changes.reduce((acc: any, c: any) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
      }, {})
      
      const changesBySection = result.changes.reduce((acc: any, c: any) => {
        const section = c.section || 'unknown'
        acc[section] = (acc[section] || 0) + 1
        return acc
      }, {})
      
      const changesWithPositions = result.changes.filter((c: any) => 
        c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined
      ).length
      
      const changesWithOriginal = result.changes.filter((c: any) => 
        c.original && c.original.trim().length > 0
      ).length

      console.log('[Generator-Structured] Changes breakdown:', {
        total: result.changes.length,
        byType: changesByType,
        bySection: changesBySection,
        withPositions: changesWithPositions,
        withOriginalField: changesWithOriginal,
        modificationsWithoutOriginal: result.changes.filter((c: any) => 
          c.type === 'modification' && (!c.original || c.original.trim().length === 0)
        ).length
      })
      
      // Log each modification to see if they have original field
      const modifications = result.changes.filter((c: any) => c.type === 'modification')
      if (modifications.length > 0) {
        console.log('[Generator-Structured] Modifications detail:', modifications.map((c: any) => ({
          id: c.id,
          section: c.section,
          hasOriginal: !!(c.original && c.original.trim().length > 0),
          hasPosition: !!(c.position?.sectionIndex !== undefined && c.position?.bulletIndex !== undefined),
          position: c.position,
          originalPreview: c.original?.substring(0, 50),
          suggestedPreview: c.suggested?.substring(0, 50)
        })))
      }

      // Always use analyzer's analysis (generator doesn't produce analysis anymore)
      // If analysis is missing, this is an error - generator requires it
      if (!analysis) {
        console.error('[Generator-Structured] Analysis is required but not provided')
        throw new Error('Analysis is required - generator requires analysis from upstream analyzer')
      }
      const finalAnalysis = analysis

      // Wait for salary lookup to complete (should be done by now, but ensure it's finished)
      const salaryData = await salaryLookupPromise
      const { role, location } = salaryData 
        ? { role: salaryData.role, location: salaryData.location }
        : await extractJobTitleAndLocation(job_description) // Fallback if salary lookup failed

      // Return structured response (fit scores will be added by orchestrator)
      return NextResponse.json({
        optimizedResume: result.optimizedResume,
        changes: result.changes,
        analysis: finalAnalysis, // Use curator's analysis if available
        salary_data: salaryData,
        job_metadata: {
          title: role,
          location: location
        }
      })

    } catch (parseError) {
      console.error('[Generator-Structured] Failed to parse Anthropic response:', parseError)
      console.error('[Generator-Structured] Raw response length:', responseText.length)
      console.error('[Generator-Structured] Stop reason:', message.stop_reason)
      console.error('[Generator-Structured] Raw response (first 2000 chars):', responseText.substring(0, 2000))
      console.error('[Generator-Structured] Raw response (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)))
      
      // Check if truncation is the issue
      const isTruncated = message.stop_reason === 'max_tokens' || responseText.length > 15000
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error'
      
      const errorDetails = {
        message: errorMessage,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500),
        hasJsonStart: responseText.includes('{'),
        hasJsonEnd: responseText.includes('}'),
        hasCodeBlock: responseText.includes('```'),
        isTruncated,
        stopReason: message.stop_reason
      }
      
      console.error('[Generator-Structured] Error details:', errorDetails)
      
      // Provide user-friendly error message
      const userMessage = isTruncated 
        ? 'The resume is too long to process in one pass. Please try with a shorter resume or contact support.'
        : 'Failed to parse AI response. Please try again.'
      
      return NextResponse.json(
        { 
          error: userMessage, 
          details: errorMessage,
          debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[Generator-Structured] API error:', error)

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
        error: 'Failed to generate structured resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
