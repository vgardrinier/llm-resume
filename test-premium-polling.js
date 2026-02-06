// Test polling-based premium flow

const RESUME = `CELINE MARTIN
Paris, France | celine.martin@email.com | +33 6 12 34 56 78

PROFESSIONAL SUMMARY
Detail-oriented professional with 5+ years of experience in project coordination, stakeholder management, and content production.

EXPERIENCE

PERSONAL ASSISTANT AND PROJECT COORDINATOR
Private Investment Firm, Paris | Jan 2020 – Present
• Management of milestone schedules for 4 large-scale projects valued at €100M+
• Close collaboration with internal and external stakeholders to ensure project alignment
• Preparation of 15–30-slide PowerPoint presentations for investor meetings
• Management of cross-departmental communication between design, content, and operations teams
• Tracking and overseeing ongoing tasks and deadlines for compliance and strategic initiatives

SKILLS
• Project Management: MS Project, Trello, Asana
• Communication: PowerPoint, Keynote, Google Slides
• Languages: French (native), English (fluent), Spanish (conversational)`

const JD = `Senior Product Manager, Co-Branded Credit Card, Amazon Payments Japan

DESCRIPTION
Amazon is seeking a Senior Product Manager to lead our co-branded credit card program in Japan.

BASIC QUALIFICATIONS
• 5+ years of product management experience
• Experience defining product roadmaps and feature requirements
• Strong analytical and quantitative skills
• Experience working with cross-functional teams`

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pollForResult(jobId) {
  let attempts = 0
  const maxAttempts = 120 // 2 minutes max (2s interval)

  while (attempts < maxAttempts) {
    attempts++

    const response = await fetch(`http://localhost:3000/api/premium-status?jobId=${jobId}`)

    if (!response.ok) {
      console.error(`[Poll ${attempts}] ❌ Status check failed:`, response.status)
      throw new Error('Status check failed')
    }

    const status = await response.json()

    console.log(`[Poll ${attempts}] Status: ${status.status} | Progress: ${status.progress}% | ${status.currentStep || ''}`)

    if (status.status === 'completed') {
      return status.result
    }

    if (status.status === 'failed') {
      throw new Error(`Job failed: ${status.error}`)
    }

    // Poll every 2 seconds
    await sleep(2000)
  }

  throw new Error('Polling timeout after 2 minutes')
}

async function test() {
  console.log('[Test] Starting polling-based premium flow...\n')
  const start = Date.now()

  try {
    // Step 1: Start the job
    console.log('[Test] Starting job...')
    const startResponse = await fetch('http://localhost:3000/api/premium-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_resume: RESUME,
        job_description: JD,
        generation_id: 'test-polling',
        session_id: 'test-session'
      })
    })

    if (!startResponse.ok) {
      const error = await startResponse.json()
      console.error('[Test] ❌ Failed to start:', error)
      return
    }

    const startData = await startResponse.json()
    console.log(`[Test] ✅ Job started: ${startData.jobId}\n`)
    console.log('[Test] Polling for results...\n')

    // Step 2: Poll for results
    const result = await pollForResult(startData.jobId)
    const duration = Date.now() - start

    console.log(`\n[Test] ✅ Complete in ${(duration/1000).toFixed(1)}s\n`)

    // Show results
    console.log('=== RESULTS ===')
    console.log(`Changes: ${result.changes?.length}`)
    console.log(`Fit Before: ${result.analysis?.fitScoreBefore}`)
    console.log(`Fit After: ${result.analysis?.fitScoreAfter}`)
    console.log(`Improvement: +${result.analysis?.fitScoreAfter - result.analysis?.fitScoreBefore}`)

    console.log('\n=== SAMPLE CHANGES ===')
    if (result.changes && result.changes.length > 0) {
      result.changes.slice(0, 3).forEach((change, idx) => {
        console.log(`\n${idx + 1}. [${change.type.toUpperCase()}] ${change.section} (Impact: ${change.impactScore}/10)`)
        console.log(`   ${change.reason}`)
      })
    }

    console.log('\n✅ Polling flow works perfectly!')

  } catch (error) {
    console.error('\n[Test] ❌ Error:', error.message)
  }
}

test()
