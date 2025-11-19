/**
 * Test script for structured API
 * Run with: node test-structured-api.js
 *
 * Make sure dev server is running: npm run dev
 */

const testResume = `John Doe
Software Engineer
john@example.com | +1234567890 | San Francisco, CA

## Experience

### Software Engineer - TechCorp
Jan 2020 - Present

- Worked on backend infrastructure improvements
- Built features for the main application
- Attended team meetings and provided updates

### Junior Developer - StartupInc
Jan 2018 - Dec 2019

- Contributed to various projects
- Helped with bug fixes
- Learned new technologies

## Skills
JavaScript, Python, React, Node.js
`

const testJob = `Senior Software Engineer - Remote

We're looking for a results-driven software engineer to join our team.

Responsibilities:
- Lead migration to microservices architecture
- Build scalable distributed systems processing millions of events
- Mentor junior engineers and provide technical leadership
- Collaborate with cross-functional teams

Requirements:
- 5+ years of software engineering experience
- Strong Python and AWS experience
- Experience with Kubernetes, Docker
- Proven track record of building scalable systems

We value data-driven decision making and technical excellence.
`

async function testStructuredAPI() {
  console.log('🧪 Testing Structured API...\n')

  try {
    const response = await fetch('http://localhost:3000/api/orchestrator-structured', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_description: testJob,
        candidate_resume: testResume,
        creative_mode: 'balanced'
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ API Error:', errorData)
      return
    }

    const data = await response.json()

    console.log('✅ API Response Received!\n')

    // Validate structure
    console.log('📊 Validation:')
    console.log('  ✓ Has optimizedResume:', !!data.optimizedResume)
    console.log('  ✓ Has changes array:', Array.isArray(data.changes))
    console.log('  ✓ Changes count:', data.changes?.length || 0)
    console.log('  ✓ Has analysis:', !!data.analysis)
    console.log('  ✓ Fit score before:', data.analysis?.fitScoreBefore)
    console.log('  ✓ Fit score after:', data.analysis?.fitScoreAfter)
    console.log('')

    // Show sample changes
    if (data.changes && data.changes.length > 0) {
      console.log('📝 Sample Changes:')
      data.changes.slice(0, 3).forEach((change, idx) => {
        console.log(`\n  Change ${idx + 1}:`)
        console.log(`    Type: ${change.type}`)
        console.log(`    Section: ${change.section}`)
        if (change.original) {
          console.log(`    Original: "${change.original.substring(0, 60)}..."`)
        }
        console.log(`    Suggested: "${change.suggested.substring(0, 60)}..."`)
        console.log(`    Reason: ${change.reason.substring(0, 80)}...`)
        console.log(`    Impact Score: ${change.impactScore}/10`)
      })
      console.log('')
    }

    // Show analysis
    if (data.analysis) {
      console.log('🧠 Analysis (The Brain):')
      console.log(`  Score: ${data.analysis.fitScoreBefore} → ${data.analysis.fitScoreAfter}`)
      console.log(`  Improvement: +${data.analysis.fitScoreAfter - data.analysis.fitScoreBefore} points`)
      console.log('')

      if (data.analysis.whatWorks?.length > 0) {
        console.log('  ✅ What Works:')
        data.analysis.whatWorks.slice(0, 2).forEach(item => {
          console.log(`    - ${item}`)
        })
        console.log('')
      }

      if (data.analysis.whatsMissing?.length > 0) {
        console.log('  ⚠️  What\'s Missing:')
        data.analysis.whatsMissing.slice(0, 2).forEach(item => {
          console.log(`    - ${item}`)
        })
        console.log('')
      }

      if (data.analysis.keywordsToTarget) {
        console.log('  🎯 Keywords to Target:')
        console.log(`    Verbs: ${data.analysis.keywordsToTarget.verbs?.join(', ')}`)
        console.log(`    Tech Stack: ${data.analysis.keywordsToTarget.techStack?.join(', ')}`)
        console.log('')
      }
    }

    console.log('✅ Test Complete! Structure looks good.\n')

    // Save full response for inspection
    const fs = require('fs')
    fs.writeFileSync(
      'test-structured-response.json',
      JSON.stringify(data, null, 2)
    )
    console.log('💾 Full response saved to: test-structured-response.json\n')

  } catch (error) {
    console.error('❌ Test Failed:', error.message)
  }
}

testStructuredAPI()
