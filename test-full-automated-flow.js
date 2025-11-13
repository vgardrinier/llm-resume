/**
 * Fully automated browser test - fills form and clicks analyze
 * Run with: node test-full-automated-flow.js
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

async function testFullFlow() {
  console.log('🧪 Starting full automated browser test...\n')

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1600, height: 1000 }
  })

  const page = await browser.newPage()

  try {
    // Step 1: Navigate to app
    console.log('📍 Step 1: Navigating to http://localhost:3000')
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' })
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('✅ Page loaded\n')

    // Step 2: Fill job description URL (will trigger manual fallback)
    console.log('📝 Step 2: Entering job URL...')
    const jobInput = await page.$('input[placeholder="Paste job link here"]')
    if (!jobInput) {
      throw new Error('Job input not found')
    }
    await jobInput.type('https://example.com/job')
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('✅ Job URL entered\n')

    // Step 3: Click manual entry button (the clipboard icon button)
    console.log('📋 Step 3: Opening manual job entry...')
    const manualButtons = await page.$$('button')
    let clipboardButton = null
    for (const button of manualButtons) {
      const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label'))
      if (ariaLabel && ariaLabel.includes('manual')) {
        clipboardButton = button
        break
      }
    }

    // If no aria-label, try finding by SVG
    if (!clipboardButton) {
      clipboardButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.find(btn => {
          const svg = btn.querySelector('svg')
          return svg && btn.parentElement?.querySelector('input[placeholder="Paste job link here"]')
        })
      })
    }

    if (clipboardButton && clipboardButton.asElement()) {
      await clipboardButton.asElement().click()
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('✅ Manual entry opened\n')
    }

    // Step 4: Try to find and fill the job description textarea
    console.log('📝 Step 4: Filling job description...')
    const textareas = await page.$$('textarea')
    if (textareas.length > 0) {
      await textareas[0].type(testJob)
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('✅ Job description filled\n')
    } else {
      console.log('⚠️  No textarea found for job description\n')
    }

    // Step 5: Upload/paste resume
    console.log('📄 Step 5: Filling resume...')
    // Try to find file upload button
    const fileInputs = await page.$$('input[type="file"]')

    if (fileInputs.length > 0) {
      console.log('Found file input, looking for manual paste option...')
      // Look for a button to trigger manual paste
      const resumeButtons = await page.$$('button')
      for (const button of resumeButtons) {
        const text = await button.evaluate(el => el.textContent)
        if (text.includes('paste') || text.includes('Paste')) {
          await button.click()
          await new Promise(resolve => setTimeout(resolve, 500))
          break
        }
      }
    }

    // Find resume textarea
    const allTextareas = await page.$$('textarea')
    if (allTextareas.length > 1) {
      await allTextareas[1].type(testResume)
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('✅ Resume filled\n')
    } else {
      console.log('⚠️  Resume textarea not found\n')
    }

    // Step 6: Click "Analyze My Résumé"
    console.log('🔍 Step 6: Clicking "Analyze My Résumé"...')
    const analyzeButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.find(b => b.textContent.includes('Analyze'))
    })

    if (analyzeButton && analyzeButton.asElement()) {
      await analyzeButton.asElement().click()
      console.log('✅ Analyze button clicked\n')

      // Step 7: Wait for results
      console.log('⏳ Step 7: Waiting for analysis to complete...')
      console.log('   (This may take 30-60 seconds)')

      // Wait for either the workspace to appear or an error
      try {
        // Look for TheBrain component (left pane)
        await page.waitForSelector('text/Overall Fit Score', { timeout: 90000 })
        console.log('✅ Results loaded!\n')

        // Take screenshot
        await page.screenshot({ path: 'test-success-results.png', fullPage: true })
        console.log('📸 Screenshot saved to test-success-results.png\n')

        // Step 8: Check if two-pane editor is visible
        console.log('🎨 Step 8: Verifying two-pane editor...')

        const hasBrain = await page.evaluate(() => {
          return document.body.textContent.includes('Overall Fit Score')
        })

        const hasEditor = await page.evaluate(() => {
          return document.body.textContent.includes('Your Optimized Résumé')
        })

        console.log(`   Left Pane (The Brain): ${hasBrain ? '✅' : '❌'}`)
        console.log(`   Right Pane (Editor): ${hasEditor ? '✅' : '❌'}`)

        if (hasBrain && hasEditor) {
          console.log('\n🎉 SUCCESS! Two-pane editor is working!\n')
        } else {
          console.log('\n⚠️  Two-pane editor partially working\n')
        }

        // Keep browser open for inspection
        console.log('Browser will remain open for 5 minutes for inspection...')
        console.log('Press Ctrl+C to close when done\n')
        await new Promise(resolve => setTimeout(resolve, 300000))

      } catch (error) {
        console.error('❌ Timeout waiting for results:', error.message)
        await page.screenshot({ path: 'test-timeout.png', fullPage: true })
        console.log('📸 Screenshot saved to test-timeout.png\n')
      }
    } else {
      console.log('❌ Analyze button not found\n')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    await page.screenshot({ path: 'test-error-automated.png', fullPage: true })
    console.log('📸 Screenshot saved to test-error-automated.png')
  } finally {
    // Don't close automatically - let user inspect
    console.log('\n👋 Test complete. Browser will stay open.')
  }
}

testFullFlow().catch(console.error)
