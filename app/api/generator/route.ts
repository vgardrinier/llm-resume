import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJobTitleAndLocation, lookupSalary, generateSalaryContext } from '@/lib/utils/salaryMCP'
import { parseClaudeJson, parseClaudeJsonArray } from '@/lib/utils/parseJson'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Extract job focus themes using AI
async function extractJobFocus(jobDescription: string): Promise<string[]> {
  const extractionPrompt = `Analyze this job description and extract the 6-8 most important themes, focus areas, and key skills.

Job Description:
${jobDescription}

Return themes that capture:
- Core responsibilities (e.g., "growth", "product strategy", "technical architecture")
- Key technical skills (e.g., "React", "Python", "AWS")
- Soft skills emphasized (e.g., "leadership", "collaboration", "data-driven decision making")
- Domain expertise (e.g., "fintech", "healthcare", "e-commerce")

Be specific and prioritize what this role ACTUALLY requires. Return ONLY a JSON array of strings:
["theme1", "theme2", "theme3", ...]

Limit to 5-7 most critical themes.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: extractionPrompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    try {
      const themes = parseClaudeJsonArray<string>(responseText)
      return themes.slice(0, 8)
    } catch (error) {
      console.warn('[Generator] Theme extraction failed, using fallback:', error)
      return ['technical skills', 'product development', 'collaboration', 'problem solving']
    }
  } catch (error) {
    console.error('AI theme extraction failed:', error)
    return ['technical skills', 'product development', 'collaboration', 'problem solving']
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_description, candidate_resume, creative_mode = 'balanced' } = body

    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('[Generator] Starting resume generation with Claude Haiku...')

    // Extract job focus themes
    console.log('[Generator] Extracting themes and keywords...')
    const jobFocusKeywords = await extractJobFocus(job_description)
    console.log('[Generator] AI-extracted job focus:', jobFocusKeywords)

    // Lookup salary data for context
    console.log('[Generator] Looking up salary data...')
    const { role, location } = await extractJobTitleAndLocation(job_description)
    const salaryData = await lookupSalary({ role, location })
    const salaryContext = salaryData ? generateSalaryContext(salaryData) : ''
    console.log('[Generator] Salary lookup result:', salaryData ? `${salaryData.median.toLocaleString()} median for ${role} in ${location}` : 'No data found')

    // Build the system prompt
    const systemPrompt = `You are a professional résumé optimizer specializing in technical and product roles.

IDENTITY & ETHICS:
- Your job is to rewrite the candidate's résumé so it fits a specific job description WITHOUT inventing ANY untrue facts
- You may reword, emphasize, or generalize existing achievements, but NEVER add details not implied by the candidate's background
- CRITICAL: NEVER invent company names, job titles, or specific projects that aren't in the original resume
- CRITICAL: NEVER add specific metrics, numbers, or achievements that aren't clearly implied in the original
- CRITICAL: NEVER invent dates, years, or time periods not mentioned in the original
- CRITICAL: NEVER invent specific technologies, tools, or platforms not mentioned in the original
- You may emphasize scale or impact using relative phrasing ("significant", "double-digit", "multi-country") instead of inventing numbers
- Preserve the candidate's writing style and personality - do not genericize
- Tone: concise, confident, metric-oriented
- Goal: make the résumé feel tailor-made for the role, truthful, and impressive

STRUCTURE REQUIREMENTS:
- CRITICAL: One-page résumé targeting 500-650 words MAX. Keep it tight and impactful.
- Match or slightly reduce the length of the original résumé - never make it significantly longer
- Clean Markdown format (no columns, tables, or images)
- Start with candidate's name, title, and contact info
- Use strong action verbs and quantify results where possible
- End every experience section with a concise "impact sentence" summarizing results or vision
- Prioritize covering these job themes: ${jobFocusKeywords.join(', ')}
- If you must cut content, prioritize recency and relevance over exhaustive history

OUTPUT FORMAT:
Return only valid JSON with this structure:
{
  "resume_md": "markdown resume text with escaped newlines",
  "fit_summary": "3-line explanation of why candidate fits + what was emphasized",
  "changes_made": ["rewrote phrasing for clarity", "reordered experience", "emphasized growth metrics"],
  "keywords_used": ["keyword1", "keyword2", "keyword3"],
  "themes_covered": ["growth", "experimentation", "analytics"]
}

CRITICAL: All newlines in string values must be escaped as \\n (not literal newlines).

CREATIVE MODE: ${creative_mode}
${creative_mode === 'assertive' ? '- You may elevate tone and reframe generic achievements as outcomes, still truthful\n- Use vivid, impactful adjectives: "transformative", "exceptional", "outstanding", "remarkable", "pioneering", "breakthrough"\n- Emphasize scale and impact with strong descriptors while staying factual' : ''}
${creative_mode === 'conservative' ? '- Maintain conservative tone, focus on factual accuracy over impact' : ''}

Job Description:
${job_description}

Candidate Resume:
${candidate_resume}

${salaryContext ? `${salaryContext}\n\n` : ''}`

    // Map temperature dynamically based on creative mode
    // Conservative: 0.2 (more deterministic, factual)
    // Balanced: 0.4 (moderate creativity)
    // Assertive: 0.55 (more creative, impactful phrasing while maintaining consistency)
    const temperature = creative_mode === 'assertive' ? 0.55 : creative_mode === 'conservative' ? 0.2 : 0.4
    
    console.log(`[Generator] Using temperature: ${temperature} for mode: ${creative_mode}`)

    // Call Claude Haiku for initial generation
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      temperature: temperature,
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Generator] Anthropic API response received, length:', responseText.length)

    // Parse Claude's JSON response
    let result
    try {
      // Use utility with escape-fixing fallback (generator had this, keeping for safety)
      result = parseClaudeJson(responseText, {
        attemptEscapeFix: true,
        errorPrefix: '[Generator]'
      })

      // Validate required fields
      if (!result.resume_md || !result.fit_summary) {
        console.error('[Generator] Invalid response structure:', result)
        throw new Error('Invalid response structure')
      }

      // Ensure arrays exist with defaults
      result.changes_made = result.changes_made || []
      result.keywords_used = result.keywords_used || []
      result.themes_covered = result.themes_covered || []

      console.log('[Generator] Successfully generated resume with themes:', result.themes_covered)

      return NextResponse.json({
        resume_md: result.resume_md,
        fit_summary: result.fit_summary,
        changes_made: result.changes_made,
        keywords_used: result.keywords_used,
        themes_covered: result.themes_covered,
        salary_data: salaryData,
        job_metadata: {
          title: role,
          location: location
        }
      })

    } catch (parseError) {
      console.error('[Generator] Failed to parse Anthropic response:', parseError)
      console.error('[Generator] Raw response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[Generator] API error:', error)

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
        error: 'Failed to generate resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

