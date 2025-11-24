#!/usr/bin/env node

const fs = require('fs')

const RESUME_TEXT = `CELINE MARTIN
Paris, France | celine.martin@email.com | +33 6 12 34 56 78

PROFESSIONAL SUMMARY
Detail-oriented professional with 5+ years of experience in project coordination, stakeholder management, and content production. Proven track record of managing complex schedules, supporting high-level negotiations, and delivering results in fast-paced environments.

EXPERIENCE

PERSONAL ASSISTANT AND PROJECT COORDINATOR
Private Investment Firm, Paris | Jan 2020 – Present
• Management of milestone schedules for 4 large-scale projects valued at €100M+
• Discreet support during negotiation rounds with up to 8 stakeholders (investors, legal teams)
• Preparation of 15–30-slide PowerPoint presentations for investor meetings
• Close collaboration with internal and external stakeholders to ensure project alignment

JUNIOR PROJECT COORDINATOR
Creative Agency, Paris | Jun 2018 – Dec 2019
• Development and maintenance of timelines and milestones for 10+ concurrent projects
• Management of cross-departmental communication between design, content, and operations teams
• Contribution to content planning and creation for social media and marketing campaigns

PHOTO PRODUCTION ASSISTANT
Fashion Magazine, Paris | Jan 2017 – May 2018
• Coordination of photo shoot logistics including location, talent, and equipment
• Budget tracking and expense reporting for production costs
• Liaison between photographers, stylists, and editorial team

EDUCATION
Master's Degree in Communication, Sciences Po Paris | 2016
Bachelor's Degree in Literature, Sorbonne University | 2014

SKILLS
• Project Management: MS Project, Trello, Asana
• Communication: PowerPoint, Keynote, Google Slides
• Languages: French (native), English (fluent), Spanish (conversational)
• Software: Microsoft Office Suite, Google Workspace, Adobe Creative Suite (basic)`

const JOB_DESCRIPTION = `Senior Product Manager, Co-Branded Credit Card, Amazon Payments Japan

DESCRIPTION
Amazon is seeking a Senior Product Manager to lead our co-branded credit card program in Japan. This is a high-impact role that will drive product strategy, roadmap, and execution for one of our key payment products in the Japanese market.

BASIC QUALIFICATIONS
• 5+ years of product management experience
• Experience defining product roadmaps and feature requirements
• Strong analytical and quantitative skills
• Experience working with cross-functional teams
• Bachelor's degree required

PREFERRED QUALIFICATIONS
• MBA or advanced technical degree
• Experience with payment products or financial services
• Experience launching products in Japanese market
• Strong understanding of customer needs and market trends
• Excellent communication and stakeholder management skills
• Experience with A/B testing and data-driven decision making
• Proficiency in SQL or other data analysis tools
• Japanese language proficiency is a plus

RESPONSIBILITIES
• Define product vision and strategy for co-branded credit card program
• Own end-to-end product roadmap and prioritization
• Work with engineering, design, marketing, and business teams to deliver features
• Analyze customer data and market trends to identify opportunities
• Drive A/B testing and experimentation to optimize product performance
• Present product updates and recommendations to senior leadership
• Partner with external stakeholders including card issuer and network partners
• Monitor product metrics and drive continuous improvement

Amazon Leadership Principles guide our decisions:
• Customer Obsession: Start with customer and work backwards
• Ownership: Act on behalf of entire company
• Invent and Simplify: Seek new ideas from everywhere
• Learn and Be Curious: Never stop learning
• Hire and Develop the Best: Raise performance bar
• Insist on Highest Standards: Continuously raise the bar
• Think Big: Create bold direction that inspires results
• Bias for Action: Speed matters in business
• Frugality: Accomplish more with less
• Earn Trust: Listen attentively, speak candidly
• Dive Deep: Operate at all levels, stay connected
• Have Backbone; Disagree and Commit: Challenge decisions
• Deliver Results: Focus on key inputs and deliver quality`

async function test() {
  console.log('🚀 Testing Premium Tier (Sonnet 4 for both Analyzer + Generator)\n')
  const start = Date.now()

  try {
    const response = await fetch('http://localhost:3000/api/premium-orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume: RESUME_TEXT,
        jobDescription: JOB_DESCRIPTION,
        generation_id: `final-test-${Date.now()}`,
        session_id: `final-session-${Date.now()}`
      })
    })

    const totalTime = Date.now() - start

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed:', response.status, errorText)
      process.exit(1)
    }

    const result = await response.json()

    console.log('✅ Complete!\n')
    console.log('⏱️  TIMING:', `${(totalTime / 1000).toFixed(1)}s`, totalTime < 50000 ? '' : `(Target: <50s)`)
    console.log('📊 FIT SCORE:', `${result.analysis.fitScoreBefore} → ${result.analysis.fitScoreAfter} (+${result.analysis.fitScoreAfter - result.analysis.fitScoreBefore})`)
    console.log('📝 CHANGES:', result.changes.length)
    console.log('⭐ QUALITY:', `Clarity ${result.clarity}, Relevance ${result.relevance}, Honesty ${result.honesty}`)

    console.log('\n━━━ PREMIUM ANALYSIS ━━━')
    console.log('Seniority:', result.analysis.scope_synthesis?.inferred_seniority)
    console.log('Industry:', result.analysis.scope_synthesis?.industry_context)
    console.log('Altitude:', result.analysis.altitude_analysis?.current_altitude, '→', result.analysis.altitude_analysis?.target_altitude)
    console.log('Can Lift:', result.analysis.altitude_analysis?.can_lift ? '✅' : '❌')
    console.log('Company:', result.analysis.company_culture?.detected_company)
    console.log('Culture:', result.analysis.company_culture?.culture_type)

    console.log('\n━━━ SAMPLE CHANGES ━━━')
    result.changes.slice(0, 5).forEach((c, i) => {
      console.log(`\n${i + 1}. [${c.section}] ${c.type} (Impact: ${c.impactScore}/10)`)
      console.log(`   Reason: ${c.reason.substring(0, 80)}...`)
      if (c.altitude_shift) console.log(`   Altitude: ${c.altitude_shift}`)
      if (c.lp_alignment?.length) console.log(`   LP: ${c.lp_alignment.join(', ')}`)
    })

    // Save full output
    fs.writeFileSync('test-final-result.json', JSON.stringify(result, null, 2))
    console.log('\n📁 Full result saved to: test-final-result.json\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

test()
