// Import Next.js API utilities for handling HTTP requests/responses
import { NextRequest, NextResponse } from 'next/server'
// Import the Anthropic SDK to call Claude AI
import Anthropic from '@anthropic-ai/sdk'
// Import fit score calculation
import { calculateFitScore, calculateBaselineFitScore, type FitScoreResult } from '@/lib/utils/fitScore'
// Import salary MCP utilities
import { lookupSalary, extractJobTitleAndLocation, generateSalaryContext } from '@/lib/utils/salaryMCP'

// Create an Anthropic client instance using your API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Extract company name from job description
function extractCompanyName(jobDescription: string): string {
  // Look for common patterns
  const patterns = [
    /(?:at|@|Company:|Employer:)\s*([A-Z][a-zA-Z\s&.,]+?)(?:\s|,|\.|$)/i,
    /([A-Z][a-zA-Z\s&.,]+?)\s+(?:Inc|Corp|LLC|Ltd|Technologies|Systems|Solutions|Labs|Group)/i
  ]

  for (const pattern of patterns) {
    const match = jobDescription.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  // Fallback: look for "at Company" pattern
  const atPattern = /at\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+in|\s+located|$|,|\.)/i
  const atMatch = jobDescription.match(atPattern)
  if (atMatch && atMatch[1]) {
    return atMatch[1].trim()
  }

  return 'Company'
}

// AI-powered: Extract job focus themes and keywords dynamically from job description
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

Limit to 6-8 most critical themes.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: extractionPrompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
      console.warn('No JSON array found in theme extraction response, using fallback')
      return ['technical skills', 'product development', 'collaboration', 'problem solving']
    }

    const themes = JSON.parse(jsonMatch[0]) as string[]
    return themes.slice(0, 8) // Ensure max 8 themes

  } catch (error) {
    console.error('AI theme extraction failed:', error)
    // Fallback to generic themes
    return ['technical skills', 'product development', 'collaboration', 'problem solving']
  }
}

// Post-processor: Enhanced sanity check for hallucinated content
function performSanityCheck(generatedResume: string, originalResume: string): { hasConcerns: boolean, concerns: string[] } {
  const concerns: string[] = []
  
  // Extract numbers from both resumes
  const generatedNumbers: string[] = generatedResume.match(/\$[\d,]+|\d+%|\d+[KMB]|\d+\+|\d+\.\d+[KMB]?|\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/g) || []
  const originalNumbers: string[] = originalResume.match(/\$[\d,]+|\d+%|\d+[KMB]|\d+\+|\d+\.\d+[KMB]?|\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/g) || []
  
  // Check for numbers in generated resume that aren't in original
  const newNumbers = generatedNumbers.filter(num => !originalNumbers.includes(num))
  if (newNumbers.length > 0) {
    concerns.push(`Added metrics/dates not in original resume: ${newNumbers.join(', ')}`)
  }
  
  // Enhanced company name detection
  const companyPatterns = [
    /(?:at|@|Company:|Employer:|worked at|joined)\s*([A-Z][a-zA-Z\s&.,]+?)(?:\s|,|\.|$)/g,
    /([A-Z][a-zA-Z\s&.,]+?)\s+(?:Inc|Corp|LLC|Ltd|Company|Technologies|Systems|Solutions|Labs|Group)/g,
    /([A-Z][a-zA-Z\s&.,]+?)\s+(?:Google|Microsoft|Apple|Amazon|Meta|Facebook|Tesla|Netflix|Uber|Airbnb)/g
  ]
  
  const generatedCompanies: string[] = []
  const originalCompanies: string[] = []
  
  // Extract companies from generated resume
  companyPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(generatedResume)) !== null) {
      const company = match[1].trim().replace(/[.,]$/, '')
      if (company.length > 2 && company.length < 50) {
        generatedCompanies.push(company)
      }
    }
  })
  
  // Extract companies from original resume
  companyPatterns.forEach(pattern => {
    pattern.lastIndex = 0 // Reset regex
    let match
    while ((match = pattern.exec(originalResume)) !== null) {
      const company = match[1].trim().replace(/[.,]$/, '')
      if (company.length > 2 && company.length < 50) {
        originalCompanies.push(company)
      }
    }
  })
  
  // Check for hallucinated companies
  const newCompanies = generatedCompanies.filter(company => 
    !originalCompanies.some(orig => 
      orig.toLowerCase().includes(company.toLowerCase()) ||
      company.toLowerCase().includes(orig.toLowerCase()) ||
      // Allow partial matches for common variations
      company.toLowerCase().replace(/\s+/g, '') === orig.toLowerCase().replace(/\s+/g, '')
    )
  )
  
  if (newCompanies.length > 0) {
    concerns.push(`Added companies not in original resume: ${newCompanies.join(', ')}`)
  }
  
  // Check for job title hallucinations
  const titlePattern = /(?:Senior|Lead|Principal|Staff|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Scientist|Architect)\s+[A-Za-z\s]+/g
  const generatedTitles = generatedResume.match(titlePattern) || []
  const originalTitles = originalResume.match(titlePattern) || []
  
  const newTitles = generatedTitles.filter(title => 
    !originalTitles.some(orig => 
      orig.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(orig.toLowerCase())
    )
  )
  
  if (newTitles.length > 0) {
    concerns.push(`Added job titles not in original resume: ${newTitles.join(', ')}`)
  }
  
  // Check for technology/tool hallucinations
  const techPattern = /(?:React|Angular|Vue|Node\.js|Python|Java|JavaScript|TypeScript|AWS|Azure|Docker|Kubernetes|MongoDB|PostgreSQL|Redis|GraphQL|REST|API|iOS|Android|Swift|Kotlin|TensorFlow|PyTorch|Pandas|NumPy|Scikit-learn|Jupyter|Git|GitHub|GitLab|Jenkins|CI\/CD|Agile|Scrum|Kanban)/g
  const generatedTechs = generatedResume.match(techPattern) || []
  const originalTechs = originalResume.match(techPattern) || []
  
  const newTechs = generatedTechs.filter(tech => 
    !originalTechs.some(orig => 
      orig.toLowerCase().includes(tech.toLowerCase()) ||
      tech.toLowerCase().includes(orig.toLowerCase())
    )
  )
  
  if (newTechs.length > 0) {
    concerns.push(`Added technologies not in original resume: ${newTechs.join(', ')}`)
  }
  
  return {
    hasConcerns: concerns.length > 0,
    concerns
  }
}

// Auto-patch validator: Replace hallucinated numbers with neutral qualifiers
function autoPatchHallucinations(generatedResume: string, originalResume: string): string {
  let patchedResume = generatedResume
  
  // Extract all numeric patterns from both resumes
  const numericPattern = /\$[\d,]+|\d+%|\d+[KMB]|\d+\+|\d+\.\d+[KMB]?|\d+[,\d]*/g
  const originalNumbers = (originalResume.match(numericPattern) || []) as string[]
  
  // Find numeric values in generated resume
  const generatedNumbers = (generatedResume.match(numericPattern) || []) as string[]
  
  // Replace numbers not in original with plain adjectives only
  generatedNumbers.forEach((num: string) => {
    if (!originalNumbers.includes(num)) {
      // Choose appropriate plain adjective based on context
      let qualifier = 'significant'
      if (num.includes('$')) qualifier = 'substantial'
      else if (num.includes('%')) qualifier = 'notable'
      else if (num.includes('K') || num.includes('M') || num.includes('B')) qualifier = 'strong'
      else if (num.includes('+')) qualifier = 'notable'
      else if (num.match(/^\d+$/)) qualifier = 'multiple'
      
      patchedResume = patchedResume.replace(num, qualifier)
    }
  })
  
  return patchedResume
}

// This function handles POST requests to /api/generate
export async function POST(request: NextRequest) {
  try {
    // Step 1: Extract the data sent from the frontend
    const body = await request.json()
    const { job_description, candidate_resume, creative_mode = 'balanced' } = body

    // Step 2: Validate that required fields are present
    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    // Step 3: Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('Starting resume generation with Anthropic API...')

    // Step 4: Extract job focus themes and keywords using AI (Pre-processor)
    console.log('Extracting themes and keywords with AI...')
    const jobFocusKeywords = await extractJobFocus(job_description)
    console.log('AI-extracted job focus:', jobFocusKeywords)

    // Step 4.5: Lookup salary data for context using AI-powered extraction
    console.log('Looking up salary data...')
    const { role, location } = await extractJobTitleAndLocation(job_description)
    const salaryData = await lookupSalary({ role, location })
    const salaryContext = salaryData ? generateSalaryContext(salaryData) : ''
    console.log('Salary lookup result:', salaryData ? `${salaryData.median.toLocaleString()} median for ${role} in ${location}` : 'No data found')

    // Step 4.6: Extract company name from job description for coach chat
    const companyName = extractCompanyName(job_description)

    // Step 5: Build the system prompt with identity + ethics guardrails
    const systemPrompt = `You are a professional résumé optimizer specializing in technical and product roles.

IDENTITY & ETHICS:
- Your job is to rewrite the candidate's résumé so it fits a specific job description WITHOUT inventing ANY untrue facts
- You may reword, emphasize, or generalize existing achievements, but NEVER add details not implied by the candidate's background
- CRITICAL: NEVER invent company names, job titles, or specific projects that aren't in the original resume
- CRITICAL: NEVER add specific metrics, numbers, or achievements that aren't clearly implied in the original
- CRITICAL: NEVER invent dates, years, or time periods not mentioned in the original
- CRITICAL: NEVER invent specific technologies, tools, or platforms not mentioned in the original
- You may emphasize scale or impact using relative phrasing ("significant", "double-digit", "multi-country") instead of inventing numbers
- If the original mentions "mobile apps", you can say "mobile applications" but NOT "iOS and Android apps"
- If the original mentions "web platforms", you can say "web applications" but NOT "React and Node.js"
- Preserve the candidate's writing style and personality - do not genericize
- Keep their authentic phrasing where possible
- Tone: concise, confident, metric-oriented
- Goal: make the résumé feel tailor-made for the role, truthful, and impressive

STRUCTURE REQUIREMENTS:
- CRITICAL: One-page résumé targeting 500-650 words MAX. Keep it tight and impactful.
- Match or slightly reduce the length of the original résumé - never make it significantly longer
- Clean Markdown format (no columns, tables, or images)
- Start with candidate's name, title, and contact info
- Use strong action verbs and quantify results where possible
- End every experience section with a concise "impact sentence" summarizing results or vision (e.g., "Drove measurable user growth and product adoption across markets")
- Keep impact sentences truthful but high-energy
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

    // Step 6: Call Claude AI with our prompt
    // This sends the prompt to Claude and waits for a response
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',  // Use the latest Claude 3.7 model
      max_tokens: 4000,                     // Maximum length of response
      temperature: 0.3,                     // Lower = more consistent, Higher = more creative
      messages: [
        {
          role: 'user',                     // We're the user asking Claude
          content: systemPrompt             // Our detailed instructions
        }
      ]
    })

    // Step 7: Extract the text response from Claude
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('Anthropic API response received, length:', responseText.length)
    
    // Step 8: Parse Claude's JSON response
    // Claude should return JSON, but sometimes it adds extra text, so we extract just the JSON part
    let result
    try {
      // Clean the response text first - remove any markdown formatting or extra text
      let cleanedResponse = responseText.trim()
      
      // Remove any markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '')
      
      // Try to find and extract the JSON object more carefully
      let jsonString = ''
      
      // Look for the start of JSON object
      const startIndex = cleanedResponse.indexOf('{')
      if (startIndex === -1) {
        console.error('No JSON object found in response. Raw response:', responseText)
        throw new Error('No JSON object found in response')
      }
      
      // Find the matching closing brace by counting braces
      let braceCount = 0
      let endIndex = startIndex
      
      for (let i = startIndex; i < cleanedResponse.length; i++) {
        if (cleanedResponse[i] === '{') {
          braceCount++
        } else if (cleanedResponse[i] === '}') {
          braceCount--
          if (braceCount === 0) {
            endIndex = i
            break
          }
        }
      }
      
      if (braceCount !== 0) {
        console.error('Unmatched braces in JSON. Raw response:', responseText)
        throw new Error('Unmatched braces in JSON')
      }
      
      jsonString = cleanedResponse.substring(startIndex, endIndex + 1)
      
      // Fix the JSON by properly escaping newlines and other characters in string values
      // This is a more robust approach that handles the specific issue we're seeing
      try {
        // First try to parse as-is
        result = JSON.parse(jsonString)
      } catch (firstError) {
        console.log('First parse attempt failed, trying to fix JSON...')
        
        // If that fails, fix the JSON by escaping newlines in string values
        let fixedJson = jsonString
        
        // Find all string values and escape newlines within them
        fixedJson = fixedJson.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match, content) => {
          // Correct escape order: backslash → newline → carriage return → tab → quote
          const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/"/g, '\\"')
          return `"${escaped}"`
        })
        
        // Try parsing the fixed JSON
        result = JSON.parse(fixedJson)
        console.log('Successfully parsed fixed JSON')
      }
      console.log('Successfully parsed JSON response')
      
      // Step 9: Post-processor - Sanity filtering and validation
      // Check that all required fields are present and correct types
      if (!result.resume_md || !result.fit_summary) {
        console.error('Invalid response structure:', result)
        throw new Error('Invalid response structure')
      }
      
      // Post-processor: Auto-patch hallucinations only (sanity check disabled due to false positives)
      const patchedResume = autoPatchHallucinations(result.resume_md, candidate_resume)
      if (patchedResume !== result.resume_md) {
        console.log('Auto-patched hallucinated numbers with neutral qualifiers')
        result.resume_md = patchedResume
        result.auto_patched = true
      }

      // Sanity check disabled - was catching false positives like "VP" from "MVP"
      // Users should review the résumé themselves
      
      // Ensure arrays exist with defaults
      result.changes_made = result.changes_made || []
      result.keywords_used = result.keywords_used || []
      result.themes_covered = result.themes_covered || []
      
      // Calculate fit score using Anthropic API
      console.log('Calculating fit score with Anthropic API...')
      const fitScore = await calculateFitScore({
        jobDescription: job_description,
        candidateResume: candidate_resume,
        generatedResume: result.resume_md,
        keywordsUsed: result.keywords_used,
        themesCovered: result.themes_covered
      })
      
      // Normalize and guard against edge cases (e.g., zero or NaN)
      const normalizedScore = Math.max(1, Math.min(100, Number.isFinite(fitScore.score) ? fitScore.score : 0))
      if (normalizedScore !== fitScore.score) {
        console.warn('Adjusted fit score to normalized range:', { original: fitScore.score, normalized: normalizedScore })
      }
      result.fit_score = { ...fitScore, score: normalizedScore }
      console.log('Fit score calculated:', result.fit_score.score)
      
      // Add salary data to response
      if (salaryData) {
        result.salary_data = salaryData
      }

      // Add metadata for coach chat
      result.job_metadata = {
        title: role,
        company: companyName,
        location: location
      }
    } catch (parseError) {
      // If parsing fails, log the error and return a helpful message to the user
      console.error('Failed to parse Anthropic response:', parseError)
      console.error('Raw response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // Step 10: Reshape to Narrated Insights structure
    const insights: any = {}

    // Salary insight
    if (salaryData) {
      insights.salary = {
        median: salaryData.median,
        range: [salaryData.low, salaryData.high],
        location,
        role,
        comment: `Typical salary in ${location}: $${salaryData.median.toLocaleString()} (range $${salaryData.low.toLocaleString()}–$${salaryData.high.toLocaleString()}).`
      }
    }

    // Fit insight (before/after)
    let baseline: FitScoreResult
    try {
      baseline = await calculateBaselineFitScore({
        jobDescription: job_description,
        originalResume: candidate_resume
      })
    } catch (e) {
      console.warn('Baseline fit score failed, using estimate:', e)
      baseline = {
        score: Math.max(0, (result.fit_score?.score ?? 70) - 10),
        breakdown: result.fit_score?.breakdown ?? {
          keywordMatch: 65,
          themeAlignment: 65,
          experienceRelevance: 65,
          skillOverlap: 65
        },
        explanation: 'Estimated baseline (scoring service unavailable)'
      }
    }

    // Final guard: if score_after somehow ends up falsy, fall back to baseline
    const scoreAfter = result.fit_score?.score ?? baseline.score
    insights.fit = {
      score_before: baseline.score,
      score_after: Math.max(1, Math.min(100, scoreAfter)),
      subscores: {
        before: baseline.breakdown,
        after: result.fit_score?.breakdown ?? {
          keywordMatch: 0,
          themeAlignment: 0,
          experienceRelevance: 0,
          skillOverlap: 0
        }
      },
      summary: result.fit_score?.explanation ?? 'Unable to calculate fit score'
    }

    // Other insights
    insights.keywords = result.keywords_used || []
    insights.themes = result.themes_covered || []
    insights.optimizations = result.changes_made || []
    if (result.sanity_concerns && result.sanity_concerns.length > 0) {
      insights.review_notes = result.sanity_concerns
    }
    if (result.auto_patched) {
      insights.auto_optimized = ['Replaced inflated metrics with neutral phrasing.']
    }

    const responsePayload = {
      insights,
      optimized_resume: result.resume_md || '',
      raw_resume: candidate_resume
    }

    return NextResponse.json(responsePayload)

  } catch (error) {
    // Step 11: Handle any errors that occur during the process
    console.error('API error:', error)
    
    // Handle Anthropic API specific errors (like invalid API key, rate limits, etc.)
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
    
    // Handle any other unexpected errors
    return NextResponse.json(
      {
        error: 'Failed to generate resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}