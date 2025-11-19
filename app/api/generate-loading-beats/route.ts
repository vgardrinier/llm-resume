import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJsonArray } from '@/lib/utils/parseJson'

// Infer seniority from job title (cheap, no API call)
function inferSeniority(jobTitle?: string | null): string | null {
  if (!jobTitle) return null
  const title = jobTitle.toLowerCase()
  if (title.includes('senior') || title.includes('sr.') || title.includes('sr ')) return 'senior'
  if (title.includes('junior') || title.includes('jr.') || title.includes('jr ') || title.includes('entry')) return 'junior'
  if (title.includes('associate') || title.includes('assoc.')) return 'associate'
  if (title.includes('lead') || title.includes('principal') || title.includes('staff')) return 'senior'
  if (title.includes('intern') || title.includes('internship')) return 'intern'
  return null
}

// Extract resume highlights cheaply (3-5 bullets)
async function extractResumeHighlights(resume: string): Promise<string[]> {
  if (!resume || resume.trim().length < 50) {
    return ['Reviewing your experience...', 'Analyzing your background...']
  }

  const prompt = `Extract 3-5 short bullet points (max 15 words each) that highlight key achievements or experiences from this resume.

Resume:
${resume.slice(0, 2000)}${resume.length > 2000 ? '...' : ''}

Return ONLY a JSON array of strings:
["bullet 1", "bullet 2", "bullet 3"]

Focus on concrete achievements, technologies, or roles. Keep it factual and brief.`

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const highlights = parseClaudeJsonArray<string>(responseText)
    return highlights.slice(0, 5) || ['Reviewing your experience...']
  } catch (error) {
    console.warn('[GenerateLoadingBeats] Resume highlights extraction failed:', error)
    return ['Reviewing your experience...', 'Analyzing your background...']
  }
}

// Extract job needs cheaply (3-5 key items)
async function extractJobNeeds(jobDescription: string): Promise<string[]> {
  if (!jobDescription || jobDescription.trim().length < 30) {
    return ['Reviewing job requirements...']
  }

  const prompt = `Extract 3-5 key requirements or expectations from this job description (max 15 words each).

Job Description:
${jobDescription.slice(0, 2000)}${jobDescription.length > 2000 ? '...' : ''}

Return ONLY a JSON array of strings:
["requirement 1", "requirement 2", "requirement 3"]

Focus on concrete skills, technologies, or responsibilities. Keep it factual and brief.`

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const needs = parseClaudeJsonArray<string>(responseText)
    return needs.slice(0, 5) || ['Reviewing job requirements...']
  } catch (error) {
    console.warn('[GenerateLoadingBeats] Job needs extraction failed:', error)
    return ['Reviewing job requirements...']
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      jobTitle,
      company,
      location,
      jobDescription,
      resume
    } = body

    // Validate required fields
    if (!jobDescription || !resume) {
      return NextResponse.json(
        { error: 'Job description and resume are required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // Extract data in parallel (cheap operations)
    const [resumeHighlights, jobNeeds] = await Promise.all([
      extractResumeHighlights(resume),
      extractJobNeeds(jobDescription)
    ])

    // Infer seniority (no API call)
    const seniority = inferSeniority(jobTitle)

    // Build context for beat generation
    const context = {
      jobTitle: jobTitle || null,
      company: company || null,
      location: location || null,
      seniority: seniority,
      resumeHighlights: resumeHighlights,
      jobNeeds: jobNeeds
    }

    // Generate beats with Haiku (cheap model)
    const beatPrompt = `<background_information>
You are narrating your own live analysis process of a résumé and job posting. You are describing what you are currently checking or comparing in real-time.

You will receive context data about:
- Job title, company, location
- Resume content
- Analysis progress

Your goal is to write 4-6 short, factual beats about your analysis process.
</background_information>

<instructions>
Write 4-6 short beats about what you are currently checking or comparing.

CRITICAL STYLE RULES:
- Use simple, direct language: "Scanning...", "Comparing...", "Checking..."
- NO evaluative language like "Evaluating if...", "Assessing whether...", "Determining if..."
- NO conditional phrasing like "if your skills match" or "whether X matches Y"
- NO complex matching statements like "Matching your experience in X to the job's focus on Y"
- Just state what you're doing: "Scanning your resume for [specific thing]..."
- Keep it factual and process-oriented, not judgmental
- Each beat should be clear and meaningful - avoid vague or overly complex statements

Examples of CORRECT style:
- "Scanning your resume for key skills and experience…"
- "Comparing your background with the job requirements…"
- "Checking your technical skills against what this role needs…"
- "Reviewing your work history and achievements…"
- "Analyzing how your experience relates to this position…"

Examples of WRONG style (avoid these):
- "Evaluating if your skills match the job's focus..." ❌
- "Assessing whether your experience aligns..." ❌
- "Matching your experience in driving frugality and continuous improvements to the job's focus on value engineering..." ❌ (too complex, doesn't mean anything)
- "Determining if your background fits..." ❌

CONSTRAINTS:
- Do not invent new facts
- Do not generalize beyond the provided data
- Keep each beat 1 sentence, max 15 words
- Make sure each beat is clear and meaningful - if it sounds vague or confusing, simplify it
</instructions>

## Output description

Output as a JSON array of strings:
["beat 1", "beat 2", "beat 3", ...]

Use ONLY the data provided:
${JSON.stringify(context, null, 2)}`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: 'user', content: beatPrompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const beats = parseClaudeJsonArray<string>(responseText)

    // Ensure we have 4-6 beats
    const finalBeats = beats && beats.length >= 4 ? beats.slice(0, 6) : [
      "Scanning your résumé and the job details now…",
      "Comparing your experience with the role's requirements…",
      "Cross-checking skills and themes against what this position values…",
      "Almost there — writing your personalized insights now."
    ]

    return NextResponse.json({ beats: finalBeats })

  } catch (error) {
    console.error('[GenerateLoadingBeats] Error:', error)

    // Fallback beats
    const fallbackBeats = [
      "Scanning your résumé and the job details now…",
      "Comparing your experience with the role's requirements…",
      "Cross-checking skills and themes against what this position values…",
      "Almost there — writing your personalized insights now."
    ]

    return NextResponse.json({ beats: fallbackBeats })
  }
}

