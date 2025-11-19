import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJobTitleAndLocation, lookupSalary, generateSalaryContext } from '@/lib/utils/salaryMCP'
import { parseClaudeJson, parseClaudeJsonArray } from '@/lib/utils/parseJson'

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
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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
      console.warn('[Generator] Keyword extraction failed, using fallback:', error)
      // Fallback: extract common keywords via simple pattern matching
      const text = jobDescription.toLowerCase()
      const fallbackKeywords: string[] = []
      if (text.includes('data-driven') || text.includes('data driven')) fallbackKeywords.push('data-driven')
      if (text.includes('stakeholder')) fallbackKeywords.push('stakeholder management')
      if (text.includes('cross-functional') || text.includes('cross functional')) fallbackKeywords.push('cross-functional collaboration')
      if (text.includes('agile')) fallbackKeywords.push('agile')
      if (text.includes('user research') || text.includes('user experience')) fallbackKeywords.push('user research')
      return fallbackKeywords.length > 0 ? fallbackKeywords : ['collaboration', 'problem solving', 'communication']
    }
  } catch (error) {
    console.error('Keyword extraction failed:', error)
    return ['collaboration', 'problem solving', 'communication']
  }
}

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
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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
    const { job_description, candidate_resume, creative_mode = 'balanced', revision_goals } = body

    // Debug: Log start with input validation
    console.log('[Generator] Request received', {
      step: 'start',
      hasJob: !!job_description,
      hasResume: !!candidate_resume,
      jobLength: job_description?.length || 0,
      resumeLength: candidate_resume?.length || 0,
      creativeMode: creative_mode,
      hasRevisionGoals: !!revision_goals,
    })

    if (!job_description || !candidate_resume) {
      console.error('[Generator] Missing required inputs', {
        step: 'validation_failed',
        hasJob: !!job_description,
        hasResume: !!candidate_resume,
        jobType: typeof job_description,
        resumeType: typeof candidate_resume,
      })
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

    // Extract explicit keywords for ATS matching
    console.log('[Generator] Extracting explicit keywords...')
    const explicitKeywords = await extractKeywords(job_description)
    console.log('[Generator] Extracted keywords:', explicitKeywords)

    // Extract job focus themes
    console.log('[Generator] Extracting themes...')
    const jobFocusKeywords = await extractJobFocus(job_description)
    console.log('[Generator] AI-extracted job focus:', jobFocusKeywords)

    // Lookup salary data for context
    console.log('[Generator] Looking up salary data...', {
      jobDescriptionLength: job_description?.length || 0,
      jobDescriptionPreview: job_description?.substring(0, 200) || 'N/A'
    })
    const { role, location } = await extractJobTitleAndLocation(job_description)
    console.log('[Generator] Extracted role/location:', { role, location, jobDescriptionLength: job_description?.length || 0 })
    const salaryData = await lookupSalary({ role, location })
    const salaryContext = salaryData ? generateSalaryContext(salaryData) : ''
    console.log('[Generator] Salary lookup result:', salaryData ? `${salaryData.median.toLocaleString()} median for ${role} in ${location}` : 'No data found')

    // Log full job description length before building prompt
    console.log('[Generator] Building system prompt with full job description', {
      jobDescriptionLength: job_description?.length || 0,
      resumeLength: candidate_resume?.length || 0
    })
    
    // Build the system prompt
    const systemPrompt = `<background_information>
You are a professional résumé optimizer specializing in technical and product roles. Your role is to rewrite a candidate's résumé so it fits a specific job description WITHOUT inventing ANY untrue facts.

You will receive:
- A job description (the target role)
- A candidate's original résumé
${salaryContext ? `- Salary context: ${salaryContext}` : ''}
${revision_goals ? `- Revision goals: ${revision_goals}` : ''}

Your goal is to make the résumé feel tailor-made for the role, truthful, and impressive while maintaining complete honesty.
</background_information>

<instructions>
ETHICS & CONSTRAINTS:
- You may reword, emphasize, or generalize existing achievements, but NEVER add details not implied by the candidate's background
- CRITICAL: NEVER invent company names, job titles, or specific projects that aren't in the original resume
- CRITICAL: NEVER add specific metrics, numbers, or achievements that aren't clearly implied in the original
- CRITICAL: NEVER invent dates, years, or time periods not mentioned in the original
- CRITICAL: NEVER invent specific technologies, tools, or platforms not mentioned in the original
- You may emphasize scale or impact using relative phrasing ("significant", "double-digit", "multi-country") instead of inventing numbers
- Preserve the candidate's writing style and personality - do not genericize
- Tone: concise, confident, metric-oriented

STRUCTURE REQUIREMENTS:
- CRITICAL: One-page résumé targeting 500-650 words MAX. Keep it tight and impactful.
- Match or slightly reduce the length of the original résumé - never make it significantly longer
- Clean Markdown format (no columns, tables, or images)
- Start with candidate's name, title, and contact info
- PROFESSIONAL SUMMARY: Include a 2-3 sentence professional summary that connects the candidate's experience to the target role. Only skip this if:
  a) The existing résumé already includes a clear, relevant summary, OR
  b) The role is highly technical (e.g., engineering, research, data science) where a summary would feel redundant
- Use strong action verbs and quantify results where possible
- End every experience section with a concise "impact sentence" summarizing results or vision
- Prioritize covering these job themes: ${jobFocusKeywords.join(', ')}
- If you must cut content, prioritize recency and relevance over exhaustive history

KEYWORD REQUIREMENTS:
- Incorporate these explicit keywords naturally throughout the resume: ${explicitKeywords.join(', ')}
- Aim for at least 80% keyword coverage - use them where relevant and authentic
- Do not force keywords if they're irrelevant to the candidate's actual experience
- Weave keywords into natural, readable sentences - avoid keyword stuffing

CREATIVE MODE: ${creative_mode}
${creative_mode === 'assertive' ? '- You may elevate tone and reframe generic achievements as outcomes, still truthful\n- Use vivid, impactful adjectives: "transformative", "exceptional", "outstanding", "remarkable", "pioneering", "breakthrough"\n- Emphasize scale and impact with strong descriptors while staying factual' : ''}
${creative_mode === 'conservative' ? '- Maintain conservative tone, focus on factual accuracy over impact' : ''}

${revision_goals ? `REVISION GOALS (incorporate these improvements):
${revision_goals}

When rewriting the resume, make sure to address these specific suggestions while maintaining all factual accuracy.` : ''}
</instructions>

## Output description

Return only valid JSON with this structure:

{
  "resume_md": "markdown resume text with escaped newlines",
  "fit_summary": "3-line explanation of why candidate fits + what was emphasized",
  "changes_made": ["rewrote phrasing for clarity", "reordered experience", "emphasized growth metrics"],
  "keywords_used": ["keyword1", "keyword2", "keyword3"],
  "themes_covered": ["growth", "experimentation", "analytics"]
}

CRITICAL: All newlines in string values must be escaped as \\n (not literal newlines).

Job Description:
${job_description}

Candidate Resume:
${candidate_resume}`

    // Map temperature dynamically based on creative mode
    // Conservative: 0.2 (more deterministic, factual)
    // Balanced: 0.4 (moderate creativity)
    // Assertive: 0.55 (more creative, impactful phrasing while maintaining consistency)
    const temperature = creative_mode === 'assertive' ? 0.55 : creative_mode === 'conservative' ? 0.2 : 0.4
    
    console.log(`[Generator] Using temperature: ${temperature} for mode: ${creative_mode}`)

    // Call Claude Haiku for initial generation
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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

      // Merge extracted keywords with generator's reported keywords (avoid duplicates)
      const allKeywords = Array.from(new Set([...explicitKeywords, ...result.keywords_used]))
      
      console.log('[Generator] Successfully generated resume')
      console.log('[Generator] Themes:', result.themes_covered)
      console.log('[Generator] Keywords (extracted + used):', allKeywords)

      return NextResponse.json({
        resume_md: result.resume_md,
        fit_summary: result.fit_summary,
        changes_made: result.changes_made,
        keywords_used: allKeywords, // Include both extracted and generator-reported keywords
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

