// API response types for PDF parsing
export interface ParseResumeResponse {
  text: string
  pageCount: number
  byteSize: number
}

export interface ParseResumeError {
  error: string
  details?: string
}

// New insights response for generate API
export interface GenerateInsightsResponse {
  insights: {
    salary?: {
      median: number
      range: [number, number]
      location: string
      role: string
      comment: string
    }
    fit: {
      score_before: number
      score_after: number
      subscores?: {
        before: {
          keywordMatch: number
          themeAlignment: number
          experienceRelevance: number
          skillOverlap: number
        }
        after: {
          keywordMatch: number
          themeAlignment: number
          experienceRelevance: number
          skillOverlap: number
        }
      }
      summary: string
    }
    keywords: string[]
    themes: string[]
    optimizations: string[]
    review_notes?: string[]
    auto_optimized?: string[]
    evaluation?: {
      // Raw scores (for backend/analytics)
      clarity: number
      relevance: number
      honesty: number
      // Technical feedback (for debugging)
      feedback: string
      // Human-friendly coaching messages (for user-facing chat)
      // Generated dynamically by LLM for personalized, context-aware feedback
      coaching: {
        clarity: string
        relevance: string
        honesty: string
        unified: string // Single message combining all aspects
      }
    }
  }
  optimized_resume: string
  raw_resume: string
}
