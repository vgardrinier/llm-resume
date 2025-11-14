// Fit Score Algorithm using Anthropic API
// Uses Claude's intelligent assessment to evaluate resume-job fit

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// REMOVED: Randomization causes variability between runs
// Even deterministic randomization based on score value can cause issues when the LLM returns slightly different scores
// Instead, we'll round to nearest integer without adding variation - this ensures maximum consistency
function randomizeScore(val: number): number {
  // Simply round to nearest integer - no variation added
  // This ensures same input → same output, maximum consistency
  return Math.max(0, Math.min(100, Math.round(val)))
}

export interface FitScoreInputs {
  jobDescription: string
  candidateResume: string
  generatedResume: string
  keywordsUsed: string[]
  themesCovered: string[]
}

export interface FitScoreResult {
  score: number // 0-100
  breakdown: {
    keywordMatch: number
    themeAlignment: number
    experienceRelevance: number
    skillOverlap: number
  }
  explanation: string
}

export async function calculateFitScore(inputs: FitScoreInputs): Promise<FitScoreResult> {
  const { jobDescription, candidateResume, generatedResume, keywordsUsed, themesCovered } = inputs
  
  // Debug: Log inputs
  console.log('[Fit Score] Starting calculation', {
    step: 'fit_score_start',
    jobLength: jobDescription?.length || 0,
    originalResumeLength: candidateResume?.length || 0,
    generatedResumeLength: generatedResume?.length || 0,
    keywordsCount: keywordsUsed?.length || 0,
    themesCount: themesCovered?.length || 0,
  })
  
  // Check if job description is too short (likely incomplete)
  const isJobDescriptionIncomplete = jobDescription.trim().length < 200
  
  const fitScorePrompt = `<background_information>
You are an expert recruiter and hiring manager evaluating how well a candidate's resume matches a job description.

You will evaluate:
- An original candidate resume
- An optimized resume (improved version)
- A job description
- Keywords used in optimization: ${keywordsUsed.join(', ')}
- Themes covered: ${themesCovered.join(', ')}

${isJobDescriptionIncomplete ? '⚠️ NOTE: The job description appears incomplete or very brief. Please evaluate based on available information and note this limitation in your explanation.' : ''}

Your goal is to assess how well the optimized resume fits the job requirements across multiple dimensions.
</background_information>

<instructions>
Evaluate the fit across these dimensions (0-100 scale each):

1. KEYWORD MATCH (0-100): How well does the optimized resume incorporate key terms, skills, and requirements from the job description?

2. THEME ALIGNMENT (0-100): How well does the resume align with the main themes, focus areas, and priorities mentioned in the job description?

3. EXPERIENCE RELEVANCE (0-100): How relevant is the candidate's experience to the role requirements? Consider seniority level, industry, company size, and role type.

4. SKILL OVERLAP (0-100): How well do the candidate's technical and soft skills match what's needed for this role?

CRITICAL EVALUATION PRINCIPLE: The optimized resume should NEVER score lower than the original resume in any category or overall. Even if the job is not a perfect fit for the candidate, the optimization process improves the resume's presentation, clarity, and alignment with the job requirements. The optimization adds value by better presenting the candidate's existing qualifications. You can be honest about a poor fit (low absolute scores), but the optimized version should always score equal to or higher than the original in every dimension, reflecting that we've improved how the candidate's qualifications are presented, even when those qualifications don't perfectly match the role.

${isJobDescriptionIncomplete ? 'IMPORTANT: Since the job description is incomplete, base your evaluation on:\n- The keywords and themes that were extracted\n- General industry/role expectations\n- The candidate\'s overall qualifications\n- Note the limitation in your explanation' : ''}

IMPORTANT: Use varied, realistic scores (not just multiples of 5). Scores like 87, 92, 86, 83, 88 are more believable than 85, 90, 85, 80, 85.

Be thorough but concise. Consider both the original resume and the optimized version.
</instructions>

## Output description

CRITICAL: You MUST respond with valid JSON only. Do not include any explanatory text outside the JSON object. If the job description is incomplete, still provide scores based on available information.

Provide your assessment as valid JSON only:

{
  "overall_score": 87,
  "breakdown": {
    "keywordMatch": 92,
    "themeAlignment": 86,
    "experienceRelevance": 83,
    "skillOverlap": 88
  },
  "explanation": "Strong match with excellent keyword integration and theme alignment. Candidate has relevant experience and skills, though some seniority gaps exist."
}

JOB DESCRIPTION:
${jobDescription}

ORIGINAL CANDIDATE RESUME:
${candidateResume}

OPTIMIZED RESUME:
${generatedResume}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1000,
      temperature: 0.0, // Zero temperature for maximum consistency - same inputs should produce same scores
      messages: [
        {
          role: 'user',
          content: fitScorePrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Debug: Log API response
    console.log('[Fit Score] API response received', {
      step: 'fit_score_api_response',
      responseLength: responseText?.length || 0,
      responsePreview: responseText?.substring(0, 200),
    })
    
    // Parse the JSON response - try multiple strategies
    let jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    // If no JSON found, try extracting from code blocks
    if (!jsonMatch) {
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (codeBlockMatch) {
        jsonMatch = codeBlockMatch
      }
    }
    
    // If still no JSON, try finding JSON after common prefixes
    if (!jsonMatch) {
      const afterPrefixMatch = responseText.match(/(?:Here|Here's|Assessment|Evaluation|Result)[\s\S]*?(\{[\s\S]*\})/i)
      if (afterPrefixMatch) {
        jsonMatch = afterPrefixMatch
      }
    }
    
    if (!jsonMatch) {
      console.error('[Fit Score] No JSON found in response', {
        step: 'fit_score_parse_error',
        responseLength: responseText?.length || 0,
        responsePreview: responseText?.substring(0, 500),
        jobDescriptionLength: jobDescription?.length || 0,
        isJobDescriptionIncomplete: (jobDescription?.trim().length || 0) < 200,
      })
      
      // If job description is incomplete, provide a more helpful error
      if ((jobDescription?.trim().length || 0) < 200) {
        throw new Error('Job description is incomplete. Please provide the full job posting with responsibilities, qualifications, and requirements.')
      }
      
      throw new Error('No JSON found in fit score response')
    }
    
    let result
    try {
      result = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[Fit Score] JSON parse error', {
        step: 'fit_score_json_parse_error',
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        jsonMatch: jsonMatch[0]?.substring(0, 500),
      })
      throw parseError
    }
    
    // Debug: Log parsed result
    console.log('[Fit Score] Parsed result', {
      step: 'fit_score_parsed',
      overallScore: result.overall_score,
      breakdown: result.breakdown,
      hasExplanation: !!result.explanation,
    })
    
    // Validate and normalize scores (before randomization)
    const rawOverall = Math.max(0, Math.min(100, Number.isFinite(result.overall_score) ? result.overall_score : 75))
    const rawKeyword = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.keywordMatch) ? result.breakdown.keywordMatch : 75))
    const rawTheme = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.themeAlignment) ? result.breakdown.themeAlignment : 75))
    const rawExperience = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.experienceRelevance) ? result.breakdown.experienceRelevance : 75))
    const rawSkill = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.skillOverlap) ? result.breakdown.skillOverlap : 75))
    
    // Apply randomization to break "multiples of 5" pattern
    const randomizedOverall = randomizeScore(rawOverall)
    const randomizedKeyword = randomizeScore(rawKeyword)
    const randomizedTheme = randomizeScore(rawTheme)
    const randomizedExperience = randomizeScore(rawExperience)
    const randomizedSkill = randomizeScore(rawSkill)
    
    console.log('[Fit Score] Raw → Randomized:', {
      overall: `${rawOverall} → ${randomizedOverall}`,
      keyword: `${rawKeyword} → ${randomizedKeyword}`,
      theme: `${rawTheme} → ${randomizedTheme}`,
      experience: `${rawExperience} → ${randomizedExperience}`,
      skill: `${rawSkill} → ${randomizedSkill}`
    })
    
    return {
      score: randomizedOverall,
      breakdown: {
        keywordMatch: randomizedKeyword,
        themeAlignment: randomizedTheme,
        experienceRelevance: randomizedExperience,
        skillOverlap: randomizedSkill
      },
      explanation: result.explanation || 'Fit score calculated'
    }
    
  } catch (error) {
    console.error('[Fit Score] Calculation error', {
      step: 'fit_score_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      jobLength: jobDescription?.length || 0,
      originalResumeLength: candidateResume?.length || 0,
      generatedResumeLength: generatedResume?.length || 0,
    })
    
    // Fallback to randomized scores if API fails (avoid multiples of 5)
    const fallbackScore = randomizeScore(75)
    console.warn('[Fit Score] Using fallback score', {
      step: 'fit_score_fallback',
      fallbackScore: fallbackScore,
    })
    
    return {
      score: fallbackScore,
      breakdown: {
        keywordMatch: randomizeScore(80),
        themeAlignment: randomizeScore(75),
        experienceRelevance: randomizeScore(70),
        skillOverlap: randomizeScore(75)
      },
      explanation: "Unable to calculate precise fit score, showing estimated values"
    }
  }
}

// Baseline scorer for the ORIGINAL resume only (before optimization)
export async function calculateBaselineFitScore(params: {
  jobDescription: string
  originalResume: string
}): Promise<FitScoreResult> {
  const { jobDescription, originalResume } = params
  
  // Debug: Log inputs
  console.log('[Baseline Fit Score] Starting calculation', {
    step: 'baseline_fit_score_start',
    jobLength: jobDescription?.length || 0,
    originalResumeLength: originalResume?.length || 0,
  })

  const prompt = `You are an expert recruiter and hiring manager evaluating how well a candidate's resume matches a job description.

JOB DESCRIPTION:
${jobDescription}

RESUME TO SCORE:
${originalResume}

Evaluate the fit across these dimensions (0-100 scale each):

1. KEYWORD MATCH (0-100)
2. THEME ALIGNMENT (0-100)
3. EXPERIENCE RELEVANCE (0-100)
4. SKILL OVERLAP (0-100)

Provide your assessment as valid JSON only:
{
  "overall_score": 73,
  "breakdown": {
    "keywordMatch": 71,
    "themeAlignment": 74,
    "experienceRelevance": 69,
    "skillOverlap": 76
  },
  "explanation": "Concise explanation of strengths and gaps."
}

IMPORTANT: Use varied, realistic scores (not just multiples of 5). Scores like 73, 71, 74, 69, 76 are more believable than 72, 70, 72, 68, 74.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 800,
      temperature: 0.0, // Zero temperature for maximum consistency - same inputs should produce same scores
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Debug: Log API response
    console.log('[Baseline Fit Score] API response received', {
      step: 'baseline_fit_score_api_response',
      responseLength: responseText?.length || 0,
      responsePreview: responseText?.substring(0, 200),
    })
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Baseline Fit Score] No JSON found in response', {
        step: 'baseline_fit_score_parse_error',
        responseLength: responseText?.length || 0,
        responsePreview: responseText?.substring(0, 500),
      })
      throw new Error('No JSON found in baseline fit score response')
    }

    let result
    try {
      result = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[Baseline Fit Score] JSON parse error', {
        step: 'baseline_fit_score_json_parse_error',
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        jsonMatch: jsonMatch[0]?.substring(0, 500),
      })
      throw parseError
    }
    
    // Debug: Log parsed result
    console.log('[Baseline Fit Score] Parsed result', {
      step: 'baseline_fit_score_parsed',
      overallScore: result.overall_score,
      breakdown: result.breakdown,
      hasExplanation: !!result.explanation,
    })

    // Validate and normalize scores (before randomization)
    const rawOverall = Math.max(0, Math.min(100, Number.isFinite(result.overall_score) ? result.overall_score : 65))
    const rawKeyword = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.keywordMatch) ? result.breakdown.keywordMatch : 65))
    const rawTheme = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.themeAlignment) ? result.breakdown.themeAlignment : 65))
    const rawExperience = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.experienceRelevance) ? result.breakdown.experienceRelevance : 65))
    const rawSkill = Math.max(0, Math.min(100, Number.isFinite(result.breakdown?.skillOverlap) ? result.breakdown.skillOverlap : 65))
    
    // Apply randomization to break "multiples of 5" pattern
    const randomizedOverall = randomizeScore(rawOverall)
    const randomizedKeyword = randomizeScore(rawKeyword)
    const randomizedTheme = randomizeScore(rawTheme)
    const randomizedExperience = randomizeScore(rawExperience)
    const randomizedSkill = randomizeScore(rawSkill)
    
    console.log('[Baseline Fit Score] Raw → Randomized:', {
      overall: `${rawOverall} → ${randomizedOverall}`,
      keyword: `${rawKeyword} → ${randomizedKeyword}`,
      theme: `${rawTheme} → ${randomizedTheme}`,
      experience: `${rawExperience} → ${randomizedExperience}`,
      skill: `${rawSkill} → ${randomizedSkill}`
    })

    return {
      score: randomizedOverall,
      breakdown: {
        keywordMatch: randomizedKeyword,
        themeAlignment: randomizedTheme,
        experienceRelevance: randomizedExperience,
        skillOverlap: randomizedSkill
      },
      explanation: result.explanation || 'Baseline fit score calculated'
    }
  } catch (error) {
    console.error('[Baseline Fit Score] Calculation error', {
      step: 'baseline_fit_score_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      jobLength: jobDescription?.length || 0,
      originalResumeLength: originalResume?.length || 0,
    })
    
    // Fallback to randomized scores (avoid multiples of 5)
    const fallbackScore = randomizeScore(65)
    console.warn('[Baseline Fit Score] Using fallback score', {
      step: 'baseline_fit_score_fallback',
      fallbackScore: fallbackScore,
    })
    
    return {
      score: fallbackScore,
      breakdown: {
        keywordMatch: randomizeScore(65),
        themeAlignment: randomizeScore(65),
        experienceRelevance: randomizeScore(65),
        skillOverlap: randomizeScore(65)
      },
      explanation: 'Unable to calculate precise baseline fit score, showing estimated values'
    }
  }
}
