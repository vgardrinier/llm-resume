// Quick test of new premium 2-call architecture

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

async function test() {
  console.log('[Test] Starting premium v2 test...\n')
  const start = Date.now()

  try {
    const response = await fetch('http://localhost:3000/api/premium-orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_resume: RESUME,
        job_description: JD,
        generation_id: 'test-v2',
        session_id: 'test-session'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[Test] ❌ Request failed:', error)
      return
    }

    const result = await response.json()
    const duration = Date.now() - start

    console.log(`\n[Test] ✅ Complete in ${(duration/1000).toFixed(1)}s\n`)

    console.log('=== TIMING BREAKDOWN ===')
    if (result.metadata?.timing) {
      const t = result.metadata.timing
      console.log(`Structural: ${t.structural_ms}ms`)
      console.log(`Strategic: ${t.strategic_ms || 'N/A'}ms`)
      console.log(`Generator: ${t.generator_ms}ms`)
      console.log(`Curator: ${t.curator_ms}ms`)
      console.log(`Fit Score: ${t.fit_score_ms}ms`)
      console.log(`Total: ${t.total_ms}ms (${(t.total_ms/1000).toFixed(1)}s)`)
    }

    console.log('\n=== RESULTS ===')
    console.log(`Changes: ${result.changes?.length}`)
    console.log(`Fit Before: ${result.analysis?.fitScoreBefore}`)
    console.log(`Fit After: ${result.analysis?.fitScoreAfter}`)
    console.log(`Improvement: +${result.analysis?.fitScoreAfter - result.analysis?.fitScoreBefore}`)

    console.log('\n=== ANALYSIS STRUCTURE ===')
    console.log('Structural fields:', Object.keys(result.analysis || {}).filter(k => ['scope', 'altitude', 'experience', 'red_flags'].includes(k)))
    console.log('Strategic fields:', Object.keys(result.analysis || {}).filter(k => ['culture', 'metrics', 'summary', 'competitive'].includes(k)))

    // Check if we hit our target
    const totalSecs = duration / 1000
    if (totalSecs > 80) {
      console.log(`\n⚠️  SLOWER THAN TARGET (${totalSecs.toFixed(1)}s > 80s)`)
      console.log('Trigger conditions to check:')
      if (t.strategic_ms > 35000) console.log(`  - Strategic too slow (${t.strategic_ms}ms > 35s) → compress JD`)
      if (t.structural_ms > 15000) console.log(`  - Structural too slow (${t.structural_ms}ms > 15s) → reduce prompt 30%`)
    } else {
      console.log(`\n✅ Within target (<80s)`)
    }

  } catch (error) {
    console.error('[Test] ❌ Error:', error.message)
  }
}

test()
