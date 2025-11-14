import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJobTitleAndLocation, lookupSalary, generateSalaryContext } from '@/lib/utils/salaryMCP'
import { parseClaudeJson, parseClaudeJsonArray } from '@/lib/utils/parseJson'
import type { StructuredResumeResponse, ResumeChange, ResumeAnalysis, StructuredResume } from '@/types/api'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Extract explicit keywords from job description (for ATS matching)
async function extractKeywords(jobDescription: string): Promise<string[]> {
  const extractionPrompt = `Extract 10-15 concrete keywords and phrases from this job description that are critical for ATS matching and role alignment.

Focus on:
- Specific skills and methodologies (e.g., "stakeholder management", "data-driven", "agile", "A/B testing")
- Role-specific terms (e.g., "roadmapping", "user research", "prioritization", "cross-functional collaboration")
- Technical competencies (e.g., "SQL", "Python", "API integration")
- Soft skills emphasized (e.g., "strategic thinking", "influence", "execution")

Job Description:
${jobDescription}

Return ONLY a JSON array of strings (10-15 keywords):
["keyword1", "keyword2", "keyword3", ...]

Be specific and concrete - these will be used to optimize the resume for ATS systems.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      temperature: 0.2,
      messages: [{ role: 'user', content: extractionPrompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    try {
      const keywords = parseClaudeJsonArray<string>(responseText)
      return keywords.slice(0, 15) // Limit to top 15
    } catch (error) {
      console.warn('[Generator-Structured] Keyword extraction failed, using fallback:', error)
      return ['collaboration', 'problem solving', 'communication']
    }
  } catch (error) {
    console.error('Keyword extraction failed:', error)
    return ['collaboration', 'problem solving', 'communication']
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

    // Extract keywords for context (fallback if no analysis provided)
    const explicitKeywords = analysis?.keywordsToTarget 
      ? [
          ...(analysis.keywordsToTarget.verbs || []),
          ...(analysis.keywordsToTarget.nouns || []),
          ...(analysis.keywordsToTarget.techStack || [])
        ]
      : await extractKeywords(job_description)
    console.log('[Generator-Structured] Using keywords:', explicitKeywords.slice(0, 10))

    // Lookup salary data
    const { role, location } = await extractJobTitleAndLocation(job_description)
    const salaryData = await lookupSalary({ role, location })
    console.log('[Generator-Structured] Salary lookup result:', salaryData ? `${salaryData.median.toLocaleString()} median` : 'No data')

    // Build constraints section if analysis provided
    const constraintsSection = analysis?.constraints ? `
CRITICAL CONSTRAINTS (from strategic analysis - FOLLOW THESE EXACTLY):

CANNOT INVENT:
${analysis.constraints.cannot_invent.map(c => `- ${c}`).join('\n')}

SAFE TO ADD:
${analysis.constraints.safe_to_add.map(c => `- ${c}`).join('\n')}

REQUIRES USER INPUT (do NOT invent these - mark for user):
${analysis.constraints.requires_user_input.map(c => `- ${c}`).join('\n')}

STRATEGY: ${analysis.rationaleForChanges || 'Improve resume fit through safe rewrites and keyword integration.'}

ANALYSIS INSIGHTS (use these to guide your changes):
WHAT WORKS (preserve and emphasize these):
${analysis.whatWorks?.map(w => `- ${w}`).join('\n') || '- No specific strengths identified'}

WHAT'S MISSING (address these gaps through safe rewrites):
${analysis.whatsMissing?.map(m => `- ${m}`).join('\n') || '- No gaps identified'}

KEYWORDS TO TARGET (integrate naturally):
- Verbs: ${analysis.keywordsToTarget?.verbs?.join(', ') || 'none'}
- Concepts: ${analysis.keywordsToTarget?.concepts?.join(', ') || 'none'}
- Tech Stack: ${analysis.keywordsToTarget?.techStack?.join(', ') || 'none'}

YOUR CHANGES MUST:
1. Address the "what's missing" gaps through safe rewrites (not invention)
2. Emphasize the "what works" strengths more prominently
3. Integrate the keywords naturally throughout
4. Follow the strategy rationale exactly
` : ''

    // Build the system prompt for structured output
    const systemPrompt = `You are a professional résumé optimizer that returns STRUCTURED, GRANULAR changes for a Grammarly-style editor.

IDENTITY & ETHICS:
- Rewrite the candidate's résumé to fit the job description WITHOUT inventing untrue facts
- You may reword, emphasize, or generalize existing achievements, but NEVER add details not implied by the candidate's background
- NEVER invent: company names, job titles, projects, metrics, dates, technologies not in the original
- Preserve the candidate's authenticity and writing style
${constraintsSection}

YOUR TASK:
1. Parse the original resume into structured sections (contact info, summary, experience, education, skills, etc.)
2. Analyze what the job description wants vs. what the resume shows
3. Generate specific, granular changes (additions, deletions, modifications) with reasons
4. Return a complete structured resume + individual changes array

OUTPUT FORMAT - Return valid JSON with this structure:

{
  "optimizedResume": {
    "contactInfo": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "location": "San Francisco, CA",
      "linkedin": "linkedin.com/in/johndoe",
      "website": "johndoe.com"
    },
    "sections": [
      {
        "type": "summary",
        "title": "Professional Summary",
        "content": "Results-driven software engineer with 5+ years..."
      },
      {
        "type": "experience",
        "title": "Experience",
        "content": [
          {
            "title": "Senior Software Engineer",
            "company": "TechCorp",
            "location": "San Francisco, CA",
            "dates": "Jan 2020 - Present",
            "bullets": [
              "Led migration of monolithic backend to microservices architecture, reducing deployment time by 60%",
              "Architected real-time data pipeline processing 10M+ events/day using Kafka and Spark"
            ]
          }
        ]
      },
      {
        "type": "skills",
        "title": "Skills",
        "content": ["Python", "AWS", "Docker", "Kubernetes", "PostgreSQL"]
      }
    ]
  },

  "changes": [
    {
      "id": "change-1",
      "type": "addition",
      "section": "Summary",
      "suggested": "Results-driven software engineer with 5+ years of experience building scalable distributed systems",
      "reason": "Job description emphasizes 'results-driven' and 'scalable systems' - adding summary to immediately establish fit",
      "impactScore": 9
    },
    {
      "id": "change-2",
      "type": "modification",
      "section": "Experience",
      "original": "Worked on backend infrastructure improvements",
      "suggested": "Led migration of monolithic backend to microservices architecture, reducing deployment time by 60%",
      "reason": "Original was vague. Job requires 'microservices' and 'architecture' - made specific with impact metric",
      "impactScore": 8,
      "position": {
        "sectionIndex": 0,
        "bulletIndex": 0
      }
    },
    {
      "id": "change-3",
      "type": "deletion",
      "section": "Experience",
      "original": "Attended team meetings and provided updates",
      "reason": "Generic filler that wastes space and doesn't demonstrate value - ATS systems skip these",
      "impactScore": 6,
      "position": {
        "sectionIndex": 0,
        "bulletIndex": 3
      }
    }
  ],

  "analysis": {
    "whatWorks": [
      "Strong technical background in Python and distributed systems",
      "Proven track record of leading infrastructure projects",
      "Experience with AWS cloud technologies matches job requirements"
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
    "rationaleForChanges": "The original resume had strong technical content but lacked strategic positioning. The job description emphasizes scalable architecture, cross-functional leadership, and measurable impact. I've restructured the resume to lead with these strengths, quantified achievements where possible, and removed generic filler. The new version positions the candidate as a technical leader who delivers business value, not just writes code."
  }
}

CRITICAL RULES:
1. Every change must have a unique "id" (use "change-1", "change-2", etc.)
2. Every change must have a "reason" that explains WHY it improves fit - reference the analysis insights explicitly
3. "impactScore" (1-10) indicates importance - focus on high-impact changes that address "what's missing"
4. For "modification" and "deletion" types, include "original" text
5. For "addition" and "modification" types, include "suggested" text
6. Be granular - one change per bullet point or sentence
7. Include position markers (sectionIndex, bulletIndex) when modifying/deleting bullets
8. Target keywords naturally: ${explicitKeywords.join(', ')}
9. PROFESSIONAL SUMMARY: Always review and suggest improvements to the summary section if it exists, or add one if missing. The summary is critical for ATS matching and should be optimized with job-relevant keywords. If the summary exists but doesn't align with the job, suggest modifications. If missing, add one.
10. STRATEGIC PRIORITY (if analysis provided, follow this order):
   a) Address "what's missing" gaps through safe rewrites (highest priority)
   b) Emphasize "what works" strengths more prominently
   c) Integrate missing keywords/concepts naturally
   d) Remove irrelevant content that doesn't support the strategy
   e) Improve clarity and specificity (only when it adds value)
11. PRIORITIZE SUBSTANTIVE CHANGES over stylistic ones:
   - High impact: Addressing "what's missing", adding missing keywords/concepts, removing irrelevant content, restructuring for clarity, optimizing summary
   - Medium impact: Converting passive to active voice ONLY when it adds impact AND addresses a gap, improving specificity
   - Low impact: Pure stylistic rewrites without adding keywords or improving clarity - AVOID these unless necessary
12. QUALITY STANDARDS:
   - Each change should directly address an analysis insight (what's missing, what works, keywords)
   - Reasons should reference the analysis: "Job emphasizes X (from what's missing), this highlights your Y experience"
   - Don't make changes just for the sake of change - every change must improve fit
   - If analysis provided, your changes MUST align with the strategy rationale

Job Description:
${job_description}

Candidate Resume:
${candidate_resume}

Return ONLY valid JSON. Escape all newlines as \\n (not literal newlines).`

    // Use Haiku for speed and cost efficiency (structured JSON should work fine)
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000, // Haiku max is 4096
      temperature: creative_mode === 'assertive' ? 0.55 : creative_mode === 'conservative' ? 0.2 : 0.4,
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Generator-Structured] Anthropic API response received, length:', responseText.length)

    // Parse Claude's JSON response
    let result: {
      optimizedResume: StructuredResume
      changes: ResumeChange[]
      analysis: Omit<ResumeAnalysis, 'fitScoreBefore' | 'fitScoreAfter' | 'subscores'>
    }

    try {
      result = parseClaudeJson(responseText, {
        attemptEscapeFix: true,
        errorPrefix: '[Generator-Structured]'
      })

      // Validate required fields
      if (!result.optimizedResume || !result.changes || !result.analysis) {
        console.error('[Generator-Structured] Invalid response structure:', result)
        throw new Error('Invalid response structure - missing required fields')
      }

      console.log('[Generator-Structured] Successfully generated structured resume')
      console.log('[Generator-Structured] Changes count:', result.changes.length)
      console.log('[Generator-Structured] Keywords targeted:', result.analysis.keywordsToTarget)

      // Use curator's analysis if provided, otherwise use generator's analysis
      const finalAnalysis = analysis || result.analysis

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
      console.error('[Generator-Structured] Raw response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
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
