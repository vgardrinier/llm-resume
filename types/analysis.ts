// ANALYSIS TYPE DEFINITIONS
// Strict, shallow schemas for fast parsing and validation

export type StructuralScope = {
  throughput: string[]
  complexity: string[]
  ownership: string[]
  industry: string
  seniority: 'junior' | 'mid' | 'senior' | 'lead'
}

export type StructuralAltitudeRole = {
  index: number
  title: string
  current_level: 1 | 2 | 3 | 4 | 5
  ceiling_level: 1 | 2 | 3 | 4 | 5
  can_lift: boolean
}

export type StructuralAltitude = {
  overall_level: 1 | 2 | 3 | 4 | 5
  roles: StructuralAltitudeRole[]
  fallback_mode: 'normal' | 'clarity_only'
}

export type ExperienceRole = {
  index: number
  title: string
  relevance: number
  recency: number
  seniority: number
  impact_potential: number
  total_score: number
  strategy: 'EXPAND' | 'COMPRESS' | 'MINIMIZE'
}

export type RedFlagType =
  | 'junior_tools'
  | 'soft_skills'
  | 'repetitive'
  | 'scope_ambiguity'
  | 'narrative_conflict'

export type RedFlagSeverity = 'low' | 'medium' | 'high' | 'critical'

export type RedFlag = {
  type: RedFlagType
  message: string
  location: string
  severity: RedFlagSeverity
}

export type StructuralAnalysis = {
  scope: StructuralScope
  altitude: StructuralAltitude
  experience: ExperienceRole[]
  red_flags: RedFlag[]
}

// STRATEGIC TYPES

export type CultureType =
  | 'amazon_lp'
  | 'google_innovation'
  | 'startup'
  | 'enterprise'

export type CultureThemeMapping = {
  theme: string
  role_index: number
  bullet_hint: string
}

export type StrategicCulture = {
  detected_company: string
  culture_type: CultureType
  themes: string[]
  mappable_resume_signals: CultureThemeMapping[]
}

export type MetricType =
  | 'team_size'
  | 'revenue'
  | 'users'
  | 'throughput'
  | 'quality'
  | 'time'
  | 'other'

export type StrategicMetricQuestion = {
  role_index: number
  question: string
  metric_type: MetricType
  reason: string
}

export type StrategicSummary = {
  industry_lens: string
  tone: string
  draft_summary: string
}

export type StrategicCompetitive = {
  before_score: number
  realistic_target_level: string
  after_potential: number
  honest_feedback: string
}

export type StrategicAnalysis = {
  culture: StrategicCulture
  metrics: StrategicMetricQuestion[]
  summary: StrategicSummary
  competitive: StrategicCompetitive
}
