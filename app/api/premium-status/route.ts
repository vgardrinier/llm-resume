import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/jobQueue'

export const maxDuration = 5 // Fast polling endpoint

/**
 * CHECK PREMIUM JOB STATUS - Polling Endpoint
 *
 * Returns current job status and result if completed.
 * Client should poll every 1-2 seconds.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      )
    }

    const job = getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', jobId },
        { status: 404 }
      )
    }

    // Return job status
    const response: any = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress || 0,
      currentStep: job.currentStep,
    }

    if (job.status === 'completed' && job.result) {
      response.result = job.result
      response.completedAt = job.completedAt
      response.duration_ms = job.completedAt ? job.completedAt - job.createdAt : 0
    }

    if (job.status === 'failed') {
      response.error = job.error
      response.completedAt = job.completedAt
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Premium-Status] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check status',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}
