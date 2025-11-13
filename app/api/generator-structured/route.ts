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
    const { job_description, candidate_resume, creative_mode = 'balanced' } = body

    console.log('[Generator-Structured] Request received', {
      step: 'start',
      hasJob: !!job_description,
      hasResume: !!candidate_resume,
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

    console.log('[Generator-Structured] Starting structured resume generation with Claude Sonnet...')

    // Extract keywords for context
    const explicitKeywords = await extractKeywords(job_description)
    console.log('[Generator-Structured] Extracted keywords:', explicitKeywords)

    // Lookup salary data
    const { role, location } = await extractJobTitleAndLocation(job_description)
    const salaryData = await lookupSalary({ role, location })
    console.log('[Generator-Structured] Salary lookup result:', salaryData ? `${salaryData.median.toLocaleString()} median` : 'No data')

    // Build the system prompt for structured output
    const systemPrompt = `You are a professional résumé optimizer that returns STRUCTURED, GRANULAR changes for a Grammarly-style editor.

IDENTITY & ETHICS:
- Rewrite the candidate's résumé to fit the job description WITHOUT inventing untrue facts
- You may reword, emphasize, or generalize existing achievements, but NEVER add details not implied by the candidate's background
- NEVER invent: company names, job titles, projects, metrics, dates, technologies not in the original
- Preserve the candidate's authenticity and writing style

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
2. Every change must have a "reason" that explains WHY it improves fit
3. "impactScore" (1-10) indicates importance - focus on high-impact changes
4. For "modification" and "deletion" types, include "original" text
5. For "addition" and "modification" types, include "suggested" text
6. Be granular - one change per bullet point or sentence
7. Include position markers (sectionIndex, bulletIndex) when modifying/deleting bullets
8. Target keywords naturally: ${explicitKeywords.join(', ')}

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

      // Return structured response (fit scores will be added by orchestrator)
      return NextResponse.json({
        optimizedResume: result.optimizedResume,
        changes: result.changes,
        analysis: result.analysis,
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
