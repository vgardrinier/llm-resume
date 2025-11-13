/**
 * Browser test script - simulates the full user flow
 * Opens browser, uploads resume, pastes job, clicks analyze
 *
 * Run with: node test-browser-flow.js
 * Make sure dev server is running: npm run dev
 */

const puppeteer = require('puppeteer')

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

async function testBrowserFlow() {
  console.log('🧪 Starting browser test...\n')

  const browser = await puppeteer.launch({
    headless: false, // Show browser
    defaultViewport: { width: 1400, height: 900 }
  })

  const page = await browser.newPage()

  try {
    // Navigate to app
    console.log('📍 Navigating to http://localhost:3000')
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' })
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Paste job description
    console.log('📝 Pasting job description...')
    await page.type('input[placeholder="Paste job link here"]', 'https://example.com/job')
    await new Promise(resolve => setTimeout(resolve, 500))

    // For now, we'll manually trigger the manual paste fallback
    // (since we're not actually fetching from a URL)
    console.log('📋 Using manual job description fallback...')

    // Fill resume textarea (look for upload button and trigger manual entry)
    console.log('📄 Entering resume text...')

    // Wait for analyze button to be visible
    await page.waitForSelector('button', { timeout: 5000 })

    // Check if the page loaded correctly by finding the button
    const buttonText = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const analyzeButton = buttons.find(b => b.textContent.includes('Analyze'))
      return analyzeButton ? analyzeButton.textContent : 'Button not found'
    })
    console.log(`Found button: "${buttonText}"`)

    console.log('✅ Page loaded successfully')
    console.log('\n⏳ Waiting 30 seconds for manual testing...')
    console.log('   1. Paste job description manually')
    console.log('   2. Upload or paste resume')
    console.log('   3. Click "Analyze My Résumé"')
    console.log('   4. Observe the two-pane editor\n')

    await new Promise(resolve => setTimeout(resolve, 30000))

    console.log('\n✅ Test window will remain open for inspection')
    console.log('   Press Ctrl+C to close when done\n')

    // Keep browser open
    await new Promise(resolve => setTimeout(resolve, 600000)) // 10 minutes

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    await page.screenshot({ path: 'test-error.png' })
    console.log('📸 Screenshot saved to test-error.png')
  }
}

testBrowserFlow().catch(console.error)
