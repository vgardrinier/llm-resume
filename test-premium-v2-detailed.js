// Detailed test to view premium v2 output

const fs = require('fs')

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
  console.log('[Test] Starting detailed premium v2 test...\n')
  const start = Date.now()

  try {
    const response = await fetch('http://localhost:3000/api/premium-orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_resume: RESUME,
        job_description: JD,
        generation_id: 'test-detailed',
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

    // Save full response to file
    fs.writeFileSync('premium-output.json', JSON.stringify(result, null, 2))
    console.log('✅ Full response saved to premium-output.json\n')

    console.log(`[Test] ✅ Complete in ${(duration/1000).toFixed(1)}s\n`)

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

    console.log('\n=== RESULTS SUMMARY ===')
    console.log(`Changes: ${result.changes?.length}`)
    console.log(`Fit Before: ${result.analysis?.fitScoreBefore}`)
    console.log(`Fit After: ${result.analysis?.fitScoreAfter}`)
    console.log(`Improvement: +${result.analysis?.fitScoreAfter - result.analysis?.fitScoreBefore}`)

    console.log('\n=== OPTIMIZED RESUME STRUCTURE ===')
    if (result.optimizedResume?.sections) {
      console.log(`Total Sections: ${result.optimizedResume.sections.length}`)
      result.optimizedResume.sections.forEach((section, idx) => {
        console.log(`  ${idx + 1}. ${section.title} (${section.type})`)
      })
    } else {
      console.log('⚠️ No sections found in optimizedResume')
    }

    console.log('\n=== SUGGESTED CHANGES (First 5) ===')
    if (result.changes && result.changes.length > 0) {
      result.changes.slice(0, 5).forEach((change, idx) => {
        console.log(`\n${idx + 1}. [${change.type.toUpperCase()}] ${change.section}`)
        console.log(`   Impact: ${change.impactScore}/10`)
        console.log(`   Reason: ${change.reason}`)
        if (change.original) {
          console.log(`   Original: "${change.original.substring(0, 80)}${change.original.length > 80 ? '...' : ''}"`)
        }
        if (change.suggested) {
          console.log(`   Suggested: "${change.suggested.substring(0, 80)}${change.suggested.length > 80 ? '...' : ''}"`)
        }
        if (change.altitude_shift) {
          console.log(`   Altitude: ${change.altitude_shift}`)
        }
      })

      if (result.changes.length > 5) {
        console.log(`\n... and ${result.changes.length - 5} more changes`)
      }
    } else {
      console.log('⚠️ No changes found')
    }

    console.log('\n=== STRATEGIC ANALYSIS ===')
    if (result.analysis?.culture) {
      console.log(`Culture Type: ${result.analysis.culture.culture_type}`)
      console.log(`Detected Company: ${result.analysis.culture.detected_company}`)
      console.log(`Themes: ${result.analysis.culture.themes?.join(', ')}`)
    }

    if (result.analysis?.competitive) {
      console.log(`\nCompetitive Analysis:`)
      console.log(`  Before Score: ${result.analysis.competitive.before_score}/10`)
      console.log(`  After Potential: ${result.analysis.competitive.after_potential}/10`)
      console.log(`  Target Level: ${result.analysis.competitive.realistic_target_level}`)
      console.log(`  Feedback: ${result.analysis.competitive.honest_feedback}`)
    }

    // Check if we hit our target
    const totalSecs = duration / 1000
    if (totalSecs > 80) {
      console.log(`\n⚠️  SLOWER THAN TARGET (${totalSecs.toFixed(1)}s > 80s)`)
    } else {
      console.log(`\n✅ Within target (<80s)`)
    }

  } catch (error) {
    console.error('[Test] ❌ Error:', error.message)
  }
}

test()
