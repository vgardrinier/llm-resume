// Fit Score Algorithm using Anthropic API
// Uses Claude's intelligent assessment to evaluate resume-job fit

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface FitScoreInputs {
  jobDescription: string
  candidateResume: string
  generatedResume: string
  keywordsUsed: string[]
  themesCovered: string[]
}

interface FitScoreResult {
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
  
  const fitScorePrompt = `You are an expert recruiter and hiring manager evaluating how well a candidate's resume matches a job description.

JOB DESCRIPTION:
${jobDescription}

ORIGINAL CANDIDATE RESUME:
${candidateResume}

OPTIMIZED RESUME:
${generatedResume}

KEYWORDS USED: ${keywordsUsed.join(', ')}
THEMES COVERED: ${themesCovered.join(', ')}

Evaluate the fit across these dimensions (0-100 scale each):

1. KEYWORD MATCH (0-100): How well does the optimized resume incorporate key terms, skills, and requirements from the job description?

2. THEME ALIGNMENT (0-100): How well does the resume align with the main themes, focus areas, and priorities mentioned in the job description?

3. EXPERIENCE RELEVANCE (0-100): How relevant is the candidate's experience to the role requirements? Consider seniority level, industry, company size, and role type.

4. SKILL OVERLAP (0-100): How well do the candidate's technical and soft skills match what's needed for this role?

Provide your assessment as valid JSON only:
{
  "overall_score": 85,
  "breakdown": {
    "keywordMatch": 90,
    "themeAlignment": 85,
    "experienceRelevance": 80,
    "skillOverlap": 85
  },
  "explanation": "Strong match with excellent keyword integration and theme alignment. Candidate has relevant experience and skills, though some seniority gaps exist."
}

Be thorough but concise. Consider both the original resume and the optimized version.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.2, // Low temperature for consistent scoring
      messages: [
        {
          role: 'user',
          content: fitScorePrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in fit score response')
    }
    
    const result = JSON.parse(jsonMatch[0])
    
    return {
      score: result.overall_score,
      breakdown: {
        keywordMatch: result.breakdown.keywordMatch,
        themeAlignment: result.breakdown.themeAlignment,
        experienceRelevance: result.breakdown.experienceRelevance,
        skillOverlap: result.breakdown.skillOverlap
      },
      explanation: result.explanation
    }
    
  } catch (error) {
    console.error('Fit score calculation error:', error)
    
    // Fallback to a basic score if API fails
    return {
      score: 75,
      breakdown: {
        keywordMatch: 80,
        themeAlignment: 75,
        experienceRelevance: 70,
        skillOverlap: 75
      },
      explanation: "Unable to calculate precise fit score, showing estimated values"
    }
  }
}
