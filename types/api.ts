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

// ============================================
// STRUCTURED DIFF TYPES (Grammarly-style)
// ============================================

export type ChangeType = 'addition' | 'deletion' | 'modification'

export interface ResumeChange {
  id: string // Unique ID for tracking accept/reject state
  type: ChangeType
  section: string // "Summary", "Experience", "Skills", "Education", etc.
  original?: string // Text being replaced/removed (for deletions and modifications)
  suggested: string // New text (for additions and modifications)
  reason: string // Why this change improves fit (shown on hover)
  impactScore: number // 1-10, importance of this change
  position?: {
    // Optional: helps with precise rendering
    sectionIndex?: number // Which section (e.g., 2nd experience entry)
    bulletIndex?: number // Which bullet point
  }
}

export interface ResumeSection {
  type: 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'other'
  title: string
  content: string | ExperienceEntry[] | EducationEntry[] | string[]
}

export interface ExperienceEntry {
  title: string
  company: string
  location?: string
  dates: string
  bullets: string[]
}

export interface EducationEntry {
  degree: string
  institution: string
  location?: string
  date: string
  details?: string[]
}

export interface StructuredResume {
  contactInfo: {
    name: string
    email?: string
    phone?: string
    location?: string
    linkedin?: string
    website?: string
  }
  sections: ResumeSection[]
}

// Analysis data for "The Brain" (left pane)
export interface ResumeAnalysis {
  fitScoreBefore: number
  fitScoreAfter: number
  subscores: {
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
  whatWorks: string[] // Bullet points of existing strengths
  whatsMissing: string[] // Bullet points of gaps the job wants
  keywordsToTarget: {
    verbs: string[] // "Led", "Architected", "Scaled"
    nouns: string[] // "microservices", "REST APIs"
    concepts: string[] // "cross-functional collaboration"
    techStack: string[] // "Python", "AWS", "Docker"
    softSkills: string[] // "leadership", "communication"
    compliance: string[] // "security clearance", "GDPR"
  }
  rationaleForChanges: string // Paragraph explaining the overall strategy
}

// New structured response format
export interface StructuredResumeResponse {
  // The optimized resume structure
  optimizedResume: StructuredResume

  // Individual changes with diffs
  changes: ResumeChange[]

  // Analysis for "The Brain" (left pane)
  analysis: ResumeAnalysis

  // Salary data (if available)
  salary?: {
    median: number
    range: [number, number]
    location: string
    role: string
    comment: string
  }

  // Metadata
  metadata: {
    generation_id: string
    session_id: string
    job_metadata: {
      title: string
      company: string
      location: string
    }
    timing: {
      total_ms: number
      generator_ms: number
      curator_ms: number
    }
  }
}

// Legacy response format (deprecated - will be replaced)
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
