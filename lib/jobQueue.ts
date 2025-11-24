/**
 * IN-MEMORY JOB QUEUE FOR ASYNC PREMIUM ANALYSIS
 *
 * Simple in-memory storage for long-running premium jobs.
 * For production, replace with Redis/database.
 */

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface PremiumJob {
  jobId: string
  status: JobStatus
  progress?: number // 0-100
  currentStep?: string
  result?: any
  error?: string
  createdAt: number
  completedAt?: number
  baselineFit?: {
    overallScore: number
    breakdown: {
      keywordMatch: number
      themeAlignment: number
      experienceRelevance: number
      skillOverlap: number
    }
  }
}

// In-memory job storage (replace with Redis for production)
// Use globalThis to ensure singleton across Next.js API route hot-reloads
const globalForJobs = globalThis as unknown as { jobs: Map<string, PremiumJob> }

if (!globalForJobs.jobs) {
  globalForJobs.jobs = new Map<string, PremiumJob>()
}

const jobs = globalForJobs.jobs

// Auto-cleanup: remove jobs older than 10 minutes
const CLEANUP_INTERVAL_MS = 60000 // 1 minute
const JOB_EXPIRY_MS = 600000 // 10 minutes

setInterval(() => {
  const now = Date.now()
  for (const [jobId, job] of Array.from(jobs.entries())) {
    if (now - job.createdAt > JOB_EXPIRY_MS) {
      jobs.delete(jobId)
      console.log(`[JobQueue] Cleaned up expired job: ${jobId}`)
    }
  }
}, CLEANUP_INTERVAL_MS)

export function createJob(jobId: string): PremiumJob {
  const job: PremiumJob = {
    jobId,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
  }
  jobs.set(jobId, job)
  console.log(`[JobQueue] Created job: ${jobId}`)
  return job
}

export function getJob(jobId: string): PremiumJob | undefined {
  return jobs.get(jobId)
}

export function updateJob(jobId: string, updates: Partial<PremiumJob>): void {
  const job = jobs.get(jobId)
  if (!job) {
    console.error(`[JobQueue] Job not found: ${jobId}`)
    return
  }

  Object.assign(job, updates)
  jobs.set(jobId, job)
}

export function completeJob(jobId: string, result: any): void {
  updateJob(jobId, {
    status: 'completed',
    progress: 100,
    result,
    completedAt: Date.now(),
  })
  console.log(`[JobQueue] Completed job: ${jobId}`)
}

export function failJob(jobId: string, error: string): void {
  updateJob(jobId, {
    status: 'failed',
    error,
    completedAt: Date.now(),
  })
  console.error(`[JobQueue] Failed job: ${jobId} - ${error}`)
}

export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`
}
