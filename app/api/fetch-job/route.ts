import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import puppeteer from 'puppeteer'

// Allow up to 60 seconds for job fetching (vision extraction can take 10-20s)
export const maxDuration = 60

// Known job platforms that typically block scraping
const JOB_PLATFORMS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'monster.com',
  'careerbuilder.com',
  'ziprecruiter.com',
  'simplyhired.com',
  'amazon.jobs',
]

function isJobPlatform(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return JOB_PLATFORMS.some(platform => hostname.includes(platform))
  } catch {
    return false
  }
}

// Helper to remove emojis and decorative characters from text
function removeEmojis(text: string | null | undefined): string {
  if (!text) return ''
  // Remove emojis and other Unicode symbols using RegExp constructor to avoid ES5/ES6 target issues
  // This regex matches most emoji ranges including flags, symbols, pictographs, etc.
  // We use new RegExp with the 'u' flag to properly handle unicode ranges
  const ranges = [
    '[\\u{1F300}-\\u{1F9FF}]', // Miscellaneous Symbols and Pictographs
    '[\\u{1F600}-\u{1F64F}]', // Emoticons
    '[\\u{1F680}-\u{1F6FF}]', // Transport and Map Symbols
    '[\\u{2600}-\u{26FF}]',   // Miscellaneous Symbols
    '[\\u{2700}-\u{27BF}]',   // Dingbats
    '[\\u{1F1E0}-\u{1F1FF}]', // Regional Indicator Symbols (flags)
    '[\\u{1F900}-\u{1F9FF}]', // Supplemental Symbols and Pictographs
    '[\\u{1FA00}-\u{1FA6F}]', // Chess Symbols
    '[\\u{1FA70}-\u{1FAFF}]', // Symbols and Pictographs Extended-A
  ].join('|')
  
  try {
    const regex = new RegExp(ranges, 'gu')
    return text.replace(regex, '').replace(/\s+/g, ' ').trim()
  } catch (e) {
    // Fallback for older environments if regex construction fails
    return text.replace(/\s+/g, ' ').trim()
  }
}

// Helper to parse Claude's JSON response (ROBUST - never throws)
function parseClaudeResponse(responseText: string): any {
  try {
    return JSON.parse(responseText)
  } catch {
    // Try extracting from ```json code blocks
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch {
        // Continue to next strategy
      }
    }

    // TOLERANT: Find first { and last }, parse whatever is between
    const firstBrace = responseText.indexOf('{')
    const lastBrace = responseText.lastIndexOf('}')

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(responseText.substring(firstBrace, lastBrace + 1))
      } catch {
        // Still failed, return minimal object
        console.warn('[parseClaudeResponse] Could not parse JSON, returning empty object')
        return {}
      }
    }

    // Absolute fallback
    console.warn('[parseClaudeResponse] No JSON found, returning empty object')
    return {}
  }
}

// DETERMINISTIC EXTRACTION HELPERS

// Extract from __NEXT_DATA__ (Next.js sites)
function extractFromNextData(html: string): { jobTitle?: string; companyName?: string; location?: string; jobDescription?: string } | null {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!nextDataMatch) return null

  try {
    const data = JSON.parse(nextDataMatch[1])
    const result: any = {}

    // Recursively search for job-related fields
    const searchObj = (obj: any, depth = 0): void => {
      if (depth > 8 || !obj || typeof obj !== 'object') return

      // Look for common field names
      if (!result.jobTitle && (obj.jobTitle || obj.title || obj.position)) {
        const val = obj.jobTitle || obj.title || obj.position
        if (typeof val === 'string' && val.length > 3) {
          result.jobTitle = removeEmojis(val.trim())
        }
      }

      if (!result.companyName && (obj.company || obj.companyName || obj.organization)) {
        const val = obj.company || obj.companyName || obj.organization
        if (typeof val === 'string' && val.length > 2) {
          result.companyName = removeEmojis(val.trim())
        }
      }

      if (!result.location && (obj.location || obj.jobLocation || obj.city)) {
        const val = obj.location || obj.jobLocation || obj.city
        result.location = removeEmojis(typeof val === 'string' ? val : JSON.stringify(val))
      }

      if (!result.jobDescription && (obj.description || obj.jobDescription)) {
        const val = obj.description || obj.jobDescription
        if (typeof val === 'string' && val.length > 100) {
          result.jobDescription = removeEmojis(val.trim())
        }
      }

      // Recurse
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          searchObj(obj[key], depth + 1)
        }
      }
    }

    searchObj(data)

    if (result.jobTitle || result.companyName || result.jobDescription) {
      return result
    }
  } catch (e) {
    // Ignore parse errors
  }

  return null
}

// Extract from meta tags
function extractFromMetaTags(html: string): { jobTitle?: string; companyName?: string; location?: string } | null {
  const result: any = {}

  const getMeta = (name: string): string | null => {
    const patterns = [
      new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'),
      new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["']`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  result.jobTitle = getMeta('og:title') || getMeta('twitter:title')
  result.companyName = getMeta('og:site_name') || getMeta('twitter:site')

  if (result.jobTitle || result.companyName) {
    return result
  }

  return null
}

// Clean content for LLM: extract main content, remove nav/footer/scripts, cap to maxChars
function cleanContentForLLM(html: string, maxChars: number = 40000): string {
  let cleaned = html

  // Try to extract main content area first (before removing anything)
  // Look for main, article, or role="main" div
  let mainContentMatch = null

  // Try <main> tag
  const mainTagMatch = html.match(/<main[^>]*>([\s\S]*)<\/main>/i)
  if (mainTagMatch && mainTagMatch[1]) {
    mainContentMatch = mainTagMatch[1]
  }

  // Try <article> tag
  if (!mainContentMatch) {
    const articleMatch = html.match(/<article[^>]*>([\s\S]*)<\/article>/i)
    if (articleMatch && articleMatch[1]) {
      mainContentMatch = articleMatch[1]
    }
  }

  // Try role="main" div (need to count nested divs properly)
  if (!mainContentMatch) {
    const roleMainStart = html.search(/<div[^>]*role=["']main["']/i)
    if (roleMainStart !== -1) {
      // Find the matching closing </div> by counting nested divs
      let depth = 0
      let inTag = false
      let tagName = ''
      let i = roleMainStart

      // Skip to the end of opening tag
      while (i < html.length && html[i] !== '>') i++
      i++ // Move past '>'
      depth = 1

      const contentStart = i

      while (i < html.length && depth > 0) {
        if (html[i] === '<') {
          // Check if opening or closing tag
          if (html[i + 1] === '/') {
            // Closing tag
            if (html.substr(i, 6).toLowerCase() === '</div>') {
              depth--
            }
            // Skip to end of tag
            while (i < html.length && html[i] !== '>') i++
          } else {
            // Opening tag - check if it's a div
            if (html.substr(i, 4).toLowerCase() === '<div') {
              depth++
            }
            // Skip to end of tag
            while (i < html.length && html[i] !== '>') i++
          }
        }
        i++
      }

      if (depth === 0 && i > contentStart) {
        mainContentMatch = html.substring(contentStart, i - 6) // -6 to exclude </div>
      }
    }
  }

  if (mainContentMatch && mainContentMatch.length > 1000) {
    cleaned = mainContentMatch
    console.log(`[cleanContentForLLM] Extracted main content: ${cleaned.length} chars`)
  } else if (mainContentMatch) {
    console.log(`[cleanContentForLLM] Main content too short (${mainContentMatch?.length || 0} chars), using full page`)
  }

  // Remove scripts, styles, noscript
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')

  // Remove nav, footer, header
  cleaned = cleaned.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
  cleaned = cleaned.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
  cleaned = cleaned.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

  // Smart truncation: if still too long, try to find a good breaking point
  if (cleaned.length > maxChars) {
    // Try to break at a closing div/section/article tag near maxChars
    const searchStart = Math.max(0, maxChars - 1000)
    const searchEnd = Math.min(cleaned.length, maxChars + 1000)
    const searchArea = cleaned.substring(searchStart, searchEnd)

    const breakPoints = [
      searchArea.lastIndexOf('</article>'),
      searchArea.lastIndexOf('</section>'),
      searchArea.lastIndexOf('</div>'),
      searchArea.lastIndexOf('</p>'),
    ]

    let bestBreak = -1
    for (const bp of breakPoints) {
      if (bp > 0 && bp < maxChars) {
        bestBreak = searchStart + bp + 10 // +10 to include closing tag
        break
      }
    }

    if (bestBreak > 0) {
      cleaned = cleaned.substring(0, bestBreak)
      console.log(`[cleanContentForLLM] Smart truncation at ${bestBreak} chars`)
    } else {
      // Fallback: dumb truncation
      cleaned = cleaned.substring(0, maxChars)
      console.log(`[cleanContentForLLM] Dumb truncation at ${maxChars} chars`)
    }
  }

  return cleaned.trim()
}

// Extract from JSON-LD structured data
function extractFromJsonLd(html: string): { jobDescription?: string; companyName?: string; jobTitle?: string; location?: string } | null {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []
  for (const script of scripts) {
    const jsonTextMatch = script.match(/<script[^>]*>[\s\S]*?<\/script>/i)
    if (!jsonTextMatch) continue
    const jsonText = jsonTextMatch[0].replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
    try {
      const data = JSON.parse(jsonText)

      // Flatten potential structures: single object, array, or { @graph: [...] }
      const collectNodes = (node: any): any[] => {
        if (!node) return []
        if (Array.isArray(node)) return node.flatMap(collectNodes)
        if (node['@graph']) return collectNodes(node['@graph'])
        return [node]
      }

      const nodes = collectNodes(data)
      for (const item of nodes) {
        const typeVal = item['@type']
        const isJob = typeof typeVal === 'string'
          ? typeVal === 'JobPosting'
          : Array.isArray(typeVal) && typeVal.includes('JobPosting')
        if (!isJob) continue

        // Helper to clean HTML and concatenate text from various fields
        const cleanText = (text: string | any): string => {
          if (!text) return ''
          const str = typeof text === 'object' ? JSON.stringify(text) : text.toString()
          return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }

        // Start with main description
        let descParts: string[] = []
        const mainDesc = cleanText(item.description || '')
        if (mainDesc) descParts.push(mainDesc)

        // Gather from additional fields
        const additionalFields = [
          'responsibilities',
          'qualifications',
          'skills',
          'jobBenefits',
          'educationRequirements',
          'experienceRequirements',
          'jobLocationType',
          'workHours'
        ]

        for (const field of additionalFields) {
          if (item[field]) {
            const fieldText = cleanText(item[field])
            if (fieldText && fieldText.length >= 20) {
              descParts.push(fieldText)
            }
          }
        }

        const fullDesc = descParts.join('\n\n').trim()
        const company = removeEmojis(item.hiringOrganization?.name || item.organization?.name)
        const title = removeEmojis(item.title || item.name)
        // Extract location from JSON-LD structure
        const locationObj = item.jobLocation || item.workLocation
        let location: string | undefined = undefined
        if (locationObj) {
          if (typeof locationObj === 'string') {
            location = locationObj
          } else if (locationObj.address) {
            const addr = locationObj.address
            const city = addr.addressLocality || ''
            const state = addr.addressRegion || ''
            const country = addr.addressCountry || ''
            const parts = [city, state, country].filter(Boolean)
            location = parts.length > 0 ? parts.join(', ') : undefined
          } else if (locationObj.name) {
            location = locationObj.name
          }
        }

        if (fullDesc && fullDesc.length >= 40) {
          return { 
            jobDescription: removeEmojis(fullDesc), 
            companyName: company || undefined, 
            jobTitle: title || undefined, 
            location: location ? removeEmojis(location) : undefined 
          }
        }
      }
    } catch {
      // ignore JSON parse errors and continue
    }
  }
  return null
}

// Quick extraction: Only extract title, company, location (fast)
async function extractQuickMetadata(url: string) {
  let browser
  try {
    console.log('[FetchJob] Quick extraction: Launching browser...')
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1024 })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

    console.log(`[FetchJob] Quick extraction: Navigating to ${url}...`)
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('[FetchJob] Quick extraction: Taking screenshot...')
    const screenshot = await page.screenshot({
      fullPage: false, // Only visible viewport for speed
      type: 'png',
      encoding: 'base64',
    }) as string

    await browser.close()
    browser = null

    console.log('[FetchJob] Quick extraction: Sending to Claude Vision...')
    const screenshotBase64 = screenshot

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Use Haiku for speed
      max_tokens: 1000, // Much smaller since we only need 3 fields
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64,
              },
            },
            {
              type: 'text',
              text: `<background_information>
You are analyzing a screenshot of a job posting webpage. Your goal is to extract basic metadata fields from the job posting.
</background_information>

<instructions>
Extract ONLY these 3 fields:

1. The company name
2. The FULL job title (include all parts like "Associate Product Manager, Recent Grad" not just "Product Manager")
3. The job location (city, state/country - e.g., "Pittsburgh, PA" or "San Francisco, CA" or "Warsaw, Poland")

Instructions:
- For job title: Extract the COMPLETE title as shown
- For location: Look for city and state/country information, often shown near the job title or company name. Extract EXACTLY as written
- If you cannot find certain fields, use null
- DO NOT extract the job description - we only need these 3 fields
- CRITICAL: Do NOT include any emojis, flags, or decorative symbols in any field. Extract only plain text.
</instructions>

## Output description

Please respond in JSON format:

{
  "companyName": "company name",
  "jobTitle": "complete job title including all qualifiers",
  "location": "city, state or city, country"
}`,
            },
          ],
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const extractedData = parseClaudeResponse(responseText)

    // Remove emojis from extracted data
    const cleanedData = {
      companyName: removeEmojis(extractedData.companyName) || null,
      jobTitle: removeEmojis(extractedData.jobTitle) || null,
      location: removeEmojis(extractedData.location) || null,
    }

    console.log(`[FetchJob] Quick extraction result - Job: "${cleanedData.jobTitle}", Company: "${cleanedData.companyName}", Location: "${cleanedData.location}"`)

    return NextResponse.json({
      companyName: cleanedData.companyName,
      jobTitle: cleanedData.jobTitle,
      location: cleanedData.location,
      quick: true, // Flag to indicate this is a quick extraction
    })

  } catch (error) {
    if (browser) {
      try {
        await browser.close()
      } catch (e) {
        console.error('Error closing browser:', e)
      }
    }

    console.error('[FetchJob] Quick extraction error:', error)
    // Fall back to full extraction if quick fails - return null to signal failure
    // The caller (extractWithVision) will handle null and continue with full extraction
    return null
  }
}

// Vision-based extraction for job platforms (slow but reliable)
async function extractWithVision(url: string, quick: boolean = false) {
  // If quick mode, use quick extraction
  if (quick) {
    const quickResult = await extractQuickMetadata(url)
    if (quickResult) return quickResult
    // If quick fails, fall through to full extraction
  }

  let browser
  try {
    console.log('[FetchJob] Launching browser...')
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1024 })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

    console.log(`[FetchJob] Navigating to ${url}...`)
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Get HTML content for deterministic extraction
    const htmlContent = await page.content()

    // DETERMINISTIC EXTRACTION FIRST (NO LLM)
    console.log('[FetchJob] Trying deterministic extraction...')

    const jsonLdResult = extractFromJsonLd(htmlContent)
    const nextDataResult = extractFromNextData(htmlContent)
    const metaResult = extractFromMetaTags(htmlContent)

    // Merge results (priority: JSON-LD > NEXT_DATA > meta)
    const deterministicData = {
      jobTitle: jsonLdResult?.jobTitle || nextDataResult?.jobTitle || metaResult?.jobTitle,
      companyName: jsonLdResult?.companyName || nextDataResult?.companyName || metaResult?.companyName,
      location: jsonLdResult?.location || nextDataResult?.location || metaResult?.location,
      jobDescription: jsonLdResult?.jobDescription || nextDataResult?.jobDescription,
    }

    console.log('[FetchJob] Deterministic extraction results:', {
      hasTitle: !!deterministicData.jobTitle,
      hasCompany: !!deterministicData.companyName,
      hasLocation: !!deterministicData.location,
      hasDescription: !!deterministicData.jobDescription,
      descLength: deterministicData.jobDescription?.length || 0,
    })

    // If we have full job description from deterministic extraction, return immediately
    if (deterministicData.jobDescription && deterministicData.jobDescription.length > 200) {
      await browser.close()
      browser = null

      console.log('[FetchJob] ✅ Deterministic extraction succeeded (no LLM needed)')
      return NextResponse.json({
        jobDescription: deterministicData.jobDescription,
        companyName: deterministicData.companyName || null,
        jobTitle: deterministicData.jobTitle || null,
        location: deterministicData.location || null,
      })
    }

    // If quick mode and we have metadata, return early
    if (quick && (deterministicData.jobTitle || deterministicData.companyName)) {
      await browser.close()
      browser = null

      console.log('[FetchJob] ✅ Quick deterministic extraction succeeded')
      return NextResponse.json({
        companyName: deterministicData.companyName || null,
        jobTitle: deterministicData.jobTitle || null,
        location: deterministicData.location || null,
        quick: true,
      })
    }

    // Extract rendered text
    console.log('[FetchJob] Extracting rendered text...')
    const renderedText = await page.evaluate(() => {
      const styleTag = document.createElement('style')
      styleTag.textContent = 'script, style, noscript, [hidden], [aria-hidden="true"] { display: none !important; }'
      document.head.appendChild(styleTag)

      const text = document.body.innerText || document.body.textContent || ''

      styleTag.remove()
      return text
    })

    const renderedTextLength = renderedText.trim().length
    console.log(`[FetchJob] Rendered text length: ${renderedTextLength} chars`)

    // If we got substantial text, use LLM with CLEANED content (max 20k)
    const hasJobKeywords = /job|role|position|responsibilities|qualifications|requirements|experience|skills|apply/i.test(renderedText.slice(0, 2000))

    if (renderedTextLength > 500 && hasJobKeywords) {
      console.log('[FetchJob] Using LLM with cleaned text (max 40k chars)...')

      try {
        // CLEAN TEXT: cap to 40k (not 100k+!)
        const cleanedText = renderedText.slice(0, 40000)

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        // Use tool use for ENFORCED JSON schema (no more parsing failures)
        const textMessage = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 8000,
          tools: [{
            name: 'extract_job_posting',
            description: 'Extract structured job posting data',
            input_schema: {
              type: 'object',
              properties: {
                jobTitle: { type: 'string', description: 'Complete job title' },
                companyName: { type: 'string', description: 'Company name' },
                location: { type: 'string', description: 'Job location (city, state/country)' },
                fullDescription: { type: 'string', description: 'Complete job description with all details' }
              },
              required: ['fullDescription']
            }
          }],
          tool_choice: { type: 'tool', name: 'extract_job_posting' },
          messages: [{
            role: 'user',
            content: `Extract job details from this career page text:

${cleanedText}

Extract:
- jobTitle (exact title as shown)
- companyName
- location (city, state/country format)
- fullDescription (complete job description - responsibilities, qualifications, requirements, benefits, etc.)`
          }]
        })

        // Tool use guarantees valid JSON
        const toolUse = textMessage.content.find(c => c.type === 'tool_use')
        const textResult: any = toolUse && toolUse.type === 'tool_use' ? toolUse.input : {}

        if (textResult && textResult.fullDescription) {
          console.log('[FetchJob] ✅ Claude parse successful for text content')
          await browser.close()
          browser = null

          // Fallback: Extract job title from URL if not found in content
          let jobTitle = textResult.jobTitle
          if (!jobTitle || jobTitle === 'N/A' || jobTitle.length < 3) {
            const urlMatch = url.match(/\/([^/]+)(?:\/?)$/)
            if (urlMatch) {
              // Convert URL slug to title case: "founding-product-engineer" -> "Founding Product Engineer"
              jobTitle = urlMatch[1]
                .split(/[-_]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              console.log(`[FetchJob] Extracted job title from URL: "${jobTitle}"`)
            }
          }

          const jobDesc = textResult.fullDescription || renderedText
          console.log(`[FetchJob] ✅ Text extraction completed: ${jobDesc.length} characters`, {
            jobTitle: jobTitle || 'N/A',
            company: textResult.companyName || 'N/A',
            location: textResult.location || 'N/A',
            method: 'text-after-render'
          })

          return NextResponse.json({
            jobDescription: jobDesc,
            companyName: textResult.companyName || null,
            jobTitle: jobTitle || null,
            location: textResult.location || 'N/A',
          })
        } else {
          console.warn('[FetchJob] Claude returned empty or invalid text result, falling back to vision')
        }
      } catch (textExtractError) {
        console.error('[FetchJob] Text extraction/parsing failed:', textExtractError)
        console.log('[FetchJob] Continuing with vision-based extraction fallback...')
      }
    }

    // Fallback to vision if text extraction didn't work or failed
    console.log('[FetchJob] Text extraction insufficient or failed, falling back to vision')
    console.log('Taking screenshot...')
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
      encoding: 'base64',
    }) as string

    if (browser) {
      await browser.close()
      browser = null
    }

    console.log('Screenshot captured, sending to Claude Vision...')
    const screenshotBase64 = screenshot

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 32000, // Increased to ensure full job description extraction (no truncation)
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64,
              },
            },
            {
              type: 'text',
              text: `<background_information>
You are analyzing a screenshot of a job posting webpage. Your goal is to extract complete job posting information including the full job description and metadata.
</background_information>

<instructions>
Extract the following information:

1. The complete job description (all relevant text including responsibilities, qualifications, benefits, etc.)
2. The company name
3. The FULL job title (include all parts like "Associate Product Manager, Recent Grad" not just "Product Manager")
4. The job location (city, state/country - e.g., "Pittsburgh, PA" or "San Francisco, CA" or "Warsaw, Poland")

Instructions:
- Extract ALL relevant job posting content, not just a summary
- Include responsibilities, qualifications, requirements, benefits, etc.
- Ignore navigation menus, headers, footers, ads, and other page elements
- Keep the job description text clean and readable
- For job title: Extract the COMPLETE title as shown (e.g., "Associate Product Manager, Recent Grad" not just "Product Manager")
- For location: Look for city and state/country information, often shown near the job title or company name. Extract EXACTLY as written (e.g., if it says "Warsaw, Poland", return that exactly - do NOT substitute with "Berlin" or any other city)
- If you cannot find certain fields, use null
- Be thorough and capture as much detail as possible from the job posting
- CRITICAL: The jobDescription field must contain the FULL job description, not a summary. If the description is long, include all of it.
- DO NOT truncate, summarize, or abbreviate the job description. Extract every word, sentence, and paragraph.
- If the job description is 2000+ characters, you MUST include all 2000+ characters in your response.
- Use the full token allowance if needed - completeness is more important than brevity.
- CRITICAL: Do NOT include any emojis, flags, or decorative symbols in any field. Extract only plain text. Remove any emojis you see on the page.
</instructions>

## Output description

Please respond in JSON format:

{
  "jobDescription": "the full job description text here",
  "companyName": "company name",
  "jobTitle": "complete job title including all qualifiers",
  "location": "city, state or city, country"
}`,
            },
          ],
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const extractedData = parseClaudeResponse(responseText)

    // Remove emojis from extracted data
    const cleanedData = {
      jobDescription: removeEmojis(extractedData.jobDescription),
      companyName: removeEmojis(extractedData.companyName) || null,
      jobTitle: removeEmojis(extractedData.jobTitle) || null,
      location: removeEmojis(extractedData.location) || null,
    }

    const jobDescLength = cleanedData.jobDescription?.length || 0
    console.log(`Vision extraction result - Job: "${cleanedData.jobTitle}", Company: "${cleanedData.companyName}", Location: "${cleanedData.location}", Description: ${jobDescLength} chars`)
    
    // Warn if job description seems truncated (less than 500 chars is suspiciously short)
    if (jobDescLength > 0 && jobDescLength < 500) {
      console.warn(`[FetchJob] WARNING: Extracted job description is very short (${jobDescLength} chars). May be truncated.`)
    }

    if (!cleanedData.jobDescription || cleanedData.jobDescription.trim().length < 40) {
      return NextResponse.json(
        { error: 'Could not extract a valid job description from this URL. The page may not contain a job posting.' },
        { status: 422 }
      )
    }

    const jdLength = cleanedData.jobDescription.length
    console.log(`[FetchJob] ✅ Full JD extraction completed: ${jdLength} characters`, {
      jobTitle: cleanedData.jobTitle || 'N/A',
      company: cleanedData.companyName || 'N/A',
      location: cleanedData.location || 'N/A',
      method: 'vision',
    })

    return NextResponse.json({
      jobDescription: cleanedData.jobDescription,
      companyName: cleanedData.companyName,
      jobTitle: cleanedData.jobTitle,
      location: cleanedData.location,
    })

  } catch (error) {
    if (browser) {
      try {
        await browser.close()
      } catch (e) {
        console.error('Error closing browser:', e)
      }
    }

    console.error('Vision extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract job description. The site may be inaccessible or the page may not contain a job posting.' },
      { status: 500 }
    )
  }
}

// Scrape with JS rendering using Firecrawl API
async function extractWithFirecrawl(url: string, quick: boolean = false) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.log('FIRECRAWL_API_KEY not set, falling back to vision extraction')
    return await extractWithVision(url, quick)
  }

  try {
    console.log(`Using Firecrawl to scrape ${url}...`)
    const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: url,
        pageOptions: {
          waitFor: 3000, // Wait 3s for JS to render
        },
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status}`)
    }

    const data = await response.json()
    const htmlContent = data.data?.markdown || data.data?.content || ''
    
    if (!htmlContent || htmlContent.length < 100) {
      throw new Error('Firecrawl returned insufficient content')
    }

    console.log(`Firecrawl extracted ${htmlContent.length} characters`)

    // Try JSON-LD extraction first
    const jsonLdResult = extractFromJsonLd(data.data?.html || '')
    
    // If quick mode and we have metadata, return early
    if (quick && jsonLdResult && (jsonLdResult.companyName || jsonLdResult.jobTitle || jsonLdResult.location)) {
      console.log('[FetchJob] Quick extraction: Returning metadata from JSON-LD')
      return NextResponse.json({
        companyName: jsonLdResult.companyName || null,
        jobTitle: jsonLdResult.jobTitle || null,
        location: jsonLdResult.location || null,
        quick: true,
      })
    }
    
    if (jsonLdResult?.jobDescription && jsonLdResult.jobDescription.length > 100) {
      console.log('Successfully extracted from JSON-LD via Firecrawl')
      return NextResponse.json({
        jobDescription: jsonLdResult.jobDescription,
        companyName: jsonLdResult.companyName || null,
        jobTitle: jsonLdResult.jobTitle || null,
        location: jsonLdResult.location || null,
      })
    }
    
    // If quick mode, try a fast extraction with smaller prompt
    if (quick) {
      try {
        const quickPrompt = `Extract ONLY these 3 fields from this job posting:

1. Company name
2. Full job title
3. Location (city, state/country)

Content:
${htmlContent.slice(0, 5000)}

Respond in JSON:
{
  "companyName": "...",
  "jobTitle": "...",
  "location": "..."
}

CRITICAL: Do NOT include any emojis, flags, or decorative symbols in any field. Extract only plain text.`

        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        })

        const quickMessage = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          messages: [{ role: 'user', content: quickPrompt }],
        })

        const quickResponseText = quickMessage.content[0].type === 'text' ? quickMessage.content[0].text : ''
        const quickData = parseClaudeResponse(quickResponseText)

        // Remove emojis from quick extraction data
        const cleanedQuickData = {
          companyName: removeEmojis(quickData.companyName) || null,
          jobTitle: removeEmojis(quickData.jobTitle) || null,
          location: removeEmojis(quickData.location) || null,
        }

        if (cleanedQuickData.companyName || cleanedQuickData.jobTitle || cleanedQuickData.location) {
          console.log('[FetchJob] Quick extraction: Returning metadata from Claude via Firecrawl')
          return NextResponse.json({
            companyName: cleanedQuickData.companyName,
            jobTitle: cleanedQuickData.jobTitle,
            location: cleanedQuickData.location,
            quick: true,
          })
        }
      } catch (quickError) {
        console.warn('[FetchJob] Quick extraction via Firecrawl failed, falling back to full extraction:', quickError)
        // Fall through to full extraction
      }
    }

    // Use Claude with CLEANED content (max 40k)
    const cleanedContent = htmlContent.slice(0, 40000)

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Use tool use for ENFORCED JSON schema
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 16000,
      tools: [{
        name: 'extract_job_posting',
        description: 'Extract structured job posting data',
        input_schema: {
          type: 'object',
          properties: {
            jobTitle: { type: 'string', description: 'Complete job title' },
            companyName: { type: 'string', description: 'Company name' },
            location: { type: 'string', description: 'Job location (city, state/country)' },
            jobDescription: { type: 'string', description: 'Complete job description with all details' }
          },
          required: ['jobDescription']
        }
      }],
      tool_choice: { type: 'tool', name: 'extract_job_posting' },
      messages: [
        {
          role: 'user',
          content: `Extract job posting from this content:

${cleanedContent}

Extract:
- jobTitle (complete title)
- companyName
- location (city, state/country)
- jobDescription (full description with responsibilities, qualifications, requirements, benefits)`,
        },
      ],
    })

    // Tool use guarantees valid JSON
    const toolUse = message.content.find(c => c.type === 'tool_use')
    const extractedData: any = toolUse && toolUse.type === 'tool_use' ? toolUse.input : {}

    // Remove emojis from extracted data
    const cleanedData = {
      jobDescription: removeEmojis(extractedData.jobDescription),
      companyName: removeEmojis(extractedData.companyName) || null,
      jobTitle: removeEmojis(extractedData.jobTitle) || null,
      location: removeEmojis(extractedData.location) || null,
    }

    if (!cleanedData.jobDescription || cleanedData.jobDescription.trim().length < 40) {
      throw new Error('Could not extract valid job description from Firecrawl content')
    }

    const jobDescLength = cleanedData.jobDescription.length
    console.log(`[FetchJob] ✅ Full JD extraction completed: ${jobDescLength} characters`, {
      jobTitle: cleanedData.jobTitle || 'N/A',
      company: cleanedData.companyName || 'N/A',
      location: cleanedData.location || 'N/A',
      method: 'firecrawl',
    })
    
    // Warn if job description seems truncated
    if (jobDescLength > 0 && jobDescLength < 500) {
      console.warn(`[FetchJob] WARNING: Extracted job description is very short (${jobDescLength} chars). May be truncated.`)
    }
    return NextResponse.json({
      jobDescription: cleanedData.jobDescription,
      companyName: cleanedData.companyName,
      jobTitle: cleanedData.jobTitle,
      location: cleanedData.location,
    })

  } catch (error) {
    console.error('Firecrawl extraction error:', error)
    // Fall back to vision extraction
    return await extractWithVision(url, quick)
  }
}

// HTML scraping for company websites (fast, but limited for JS-rendered content)
async function extractWithScraping(url: string, quick: boolean = false) {
  let htmlContent: string

  try {
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch URL: ${fetchResponse.status}`)
    }

    htmlContent = await fetchResponse.text()
    console.log(`[FetchJob] Fetched HTML content: ${htmlContent.length} chars`)
    
    // Check if we got a minimal HTML shell (likely JS-rendered content)
    // If HTML is too short or doesn't contain job-related keywords, use Firecrawl
    const textContent = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    console.log(`[FetchJob] Extracted text content length: ${textContent.length} chars`)
    
    const hasJobKeywords = htmlContent.toLowerCase().includes('job') || 
                          htmlContent.toLowerCase().includes('position') || 
                          htmlContent.toLowerCase().includes('career') ||
                          htmlContent.toLowerCase().includes('opportunity') ||
                          htmlContent.toLowerCase().includes('responsibilities') ||
                          htmlContent.toLowerCase().includes('qualifications') ||
                          htmlContent.toLowerCase().includes('requirements')
    
    if (textContent.length < 1000 || !hasJobKeywords) {
      console.log(`[FetchJob] Initial HTML too short (${textContent.length} chars) or missing job keywords, likely JS-rendered. Using Firecrawl...`)
      return await extractWithFirecrawl(url, quick)
    }
  } catch (error) {
    console.error('Initial fetch failed, trying Firecrawl:', error)
    return await extractWithFirecrawl(url, quick)
  }

  // DETERMINISTIC EXTRACTION FIRST (NO LLM)
  console.log('[FetchJob] Trying deterministic extraction on HTML...')

  const jsonLdResult = extractFromJsonLd(htmlContent)
  const nextDataResult = extractFromNextData(htmlContent)
  const metaResult = extractFromMetaTags(htmlContent)

  // Merge results
  const deterministicData = {
    jobTitle: jsonLdResult?.jobTitle || nextDataResult?.jobTitle || metaResult?.jobTitle,
    companyName: jsonLdResult?.companyName || nextDataResult?.companyName || metaResult?.companyName,
    location: jsonLdResult?.location || nextDataResult?.location || metaResult?.location,
    jobDescription: jsonLdResult?.jobDescription || nextDataResult?.jobDescription,
  }

  console.log('[FetchJob] Deterministic extraction results:', {
    hasTitle: !!deterministicData.jobTitle,
    hasCompany: !!deterministicData.companyName,
    hasLocation: !!deterministicData.location,
    hasDescription: !!deterministicData.jobDescription,
    descLength: deterministicData.jobDescription?.length || 0,
  })

  // If we have full description, return immediately (no LLM needed)
  if (deterministicData.jobDescription && deterministicData.jobDescription.length > 200) {
    console.log('[FetchJob] ✅ Deterministic extraction succeeded (no LLM needed)')
    return NextResponse.json({
      jobDescription: deterministicData.jobDescription,
      companyName: deterministicData.companyName || null,
      jobTitle: deterministicData.jobTitle || null,
      location: deterministicData.location || null,
    })
  }

  // If quick mode and we have metadata, return early
  if (quick && (deterministicData.jobTitle || deterministicData.companyName)) {
    console.log('[FetchJob] ✅ Quick deterministic extraction succeeded')
    return NextResponse.json({
      companyName: deterministicData.companyName || null,
      jobTitle: deterministicData.jobTitle || null,
      location: deterministicData.location || null,
      quick: true,
    })
  }

  // LLM fallback: use CLEANED HTML (max 40k, not 200k!)
  if (quick) {
      try {
        const htmlSlice = htmlContent.slice(0, 5000)
        const quickPrompt = `Extract ONLY these 3 fields from this HTML:

1. Company name
2. Full job title
3. Location (city, state/country)

HTML:
${htmlSlice}

Respond in JSON:
{
  "companyName": "...",
  "jobTitle": "...",
  "location": "..."
}

CRITICAL: Do NOT include any emojis, flags, or decorative symbols in any field. Extract only plain text.`

        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        })

        const quickMessage = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          messages: [{ role: 'user', content: quickPrompt }],
        })

        const quickResponseText = quickMessage.content[0].type === 'text' ? quickMessage.content[0].text : ''
        const quickData = parseClaudeResponse(quickResponseText)

        // Remove emojis from quick extraction data
        const cleanedQuickData = {
          companyName: removeEmojis(quickData.companyName) || null,
          jobTitle: removeEmojis(quickData.jobTitle) || null,
          location: removeEmojis(quickData.location) || null,
        }

        if (cleanedQuickData.companyName || cleanedQuickData.jobTitle || cleanedQuickData.location) {
          console.log('[FetchJob] Quick extraction: Returning metadata from Claude')
          return NextResponse.json({
            companyName: cleanedQuickData.companyName,
            jobTitle: cleanedQuickData.jobTitle,
            location: cleanedQuickData.location,
            quick: true,
          })
        }
      } catch (quickError) {
        console.warn('[FetchJob] Quick extraction failed, falling back to full extraction:', quickError)
        // Fall through to full extraction
      }
    }

  // Fallback to Claude HTML parsing with CLEANED content
  try {
    console.log('[FetchJob] Using LLM with cleaned HTML (max 40k chars)...')

    // CLEAN HTML: remove nav/footer/scripts, cap to 40k (NOT 200k!)
    const cleanedHtml = cleanContentForLLM(htmlContent, 40000)
    console.log(`[FetchJob] Cleaned HTML: ${cleanedHtml.length} chars (original: ${htmlContent.length} chars)`)
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Use tool use for ENFORCED JSON schema
    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 16000,
      tools: [{
        name: 'extract_job_posting',
        description: 'Extract structured job posting data from HTML',
        input_schema: {
          type: 'object',
          properties: {
            jobTitle: { type: 'string', description: 'Complete job title' },
            companyName: { type: 'string', description: 'Company name' },
            location: { type: 'string', description: 'Job location (city, state/country)' },
            jobDescription: { type: 'string', description: 'Complete job description with all details' }
          },
          required: ['jobDescription']
        }
      }],
      tool_choice: { type: 'tool', name: 'extract_job_posting' },
      messages: [
        {
          role: 'user',
          content: `Extract job posting information from this HTML:

${cleanedHtml}

Extract:
- jobTitle (complete title as shown)
- companyName
- location (city, state/country format)
- jobDescription (full description with responsibilities, qualifications, requirements, benefits)

Remove HTML tags and navigation elements. Keep only job-related content.`,
        },
      ],
    })

    // Tool use guarantees valid JSON
    const toolUse = message.content.find(c => c.type === 'tool_use')
    const extractedData: any = toolUse && toolUse.type === 'tool_use' ? toolUse.input : {}

    // Remove emojis from extracted data
    const cleanedData = {
      jobDescription: removeEmojis(extractedData.jobDescription),
      companyName: removeEmojis(extractedData.companyName) || null,
      jobTitle: removeEmojis(extractedData.jobTitle) || null,
      location: removeEmojis(extractedData.location) || null,
    }

    if (!cleanedData.jobDescription || cleanedData.jobDescription.trim().length < 40) {
      return NextResponse.json(
        { error: 'Could not extract a valid job description from this URL. The page may not contain a job posting.' },
        { status: 422 }
      )
    }

    const jobDescLength = cleanedData.jobDescription.length
    console.log(`[FetchJob] ✅ Full JD extraction completed: ${jobDescLength} characters`, {
      jobTitle: cleanedData.jobTitle || 'N/A',
      company: cleanedData.companyName || 'N/A',
      location: cleanedData.location || 'N/A',
      method: 'html-scraping',
    })
    
    // Warn if job description seems truncated
    if (jobDescLength > 0 && jobDescLength < 1000) {
      console.warn(`[FetchJob] WARNING: Extracted job description is very short (${jobDescLength} chars). May be truncated or page may be JS-rendered.`)
      console.warn(`[FetchJob] Consider using Firecrawl for JS-rendered pages. Falling back to Firecrawl...`)
      // Try Firecrawl as fallback for short extractions
      return await extractWithFirecrawl(url, quick)
    }

    return NextResponse.json({
      jobDescription: cleanedData.jobDescription,
      companyName: cleanedData.companyName,
      jobTitle: cleanedData.jobTitle,
      location: cleanedData.location,
    })

  } catch (error) {
    console.error('HTML extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract job description using AI. The page content may be too complex or not a job posting.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body with better error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[FetchJob] JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with "url" field.' },
        { status: 400 }
      )
    }

    const { url, quick } = body || {}

    if (!url || typeof url !== 'string') {
      console.error('[FetchJob] Missing or invalid URL:', { url, type: typeof url, body })
      return NextResponse.json(
        { error: 'URL is required and must be a string' },
        { status: 400 }
      )
    }

    // Trim and validate URL format
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      console.error('[FetchJob] Empty URL after trimming')
      return NextResponse.json(
        { error: 'URL cannot be empty' },
        { status: 400 }
      )
    }

    // Validate URL format
    let validUrl: URL
    try {
      validUrl = new URL(trimmedUrl)
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch (error) {
      console.error('[FetchJob] URL validation error:', { url: trimmedUrl, error })
      return NextResponse.json(
        { error: 'Invalid URL format. Please enter a valid URL starting with http:// or https://' },
        { status: 400 }
      )
    }

    const quickMode = quick === true
    if (quickMode) {
      console.log(`[FetchJob] Quick extraction mode enabled for: ${trimmedUrl}`)
    }

    // Determine extraction strategy based on URL
    const useVision = isJobPlatform(trimmedUrl)

    if (useVision) {
      console.log(`Detected job platform URL, using vision extraction: ${trimmedUrl}`)
      return await extractWithVision(trimmedUrl, quickMode)
    } else {
      console.log(`Company website detected, attempting HTML scraping: ${trimmedUrl}`)
      return await extractWithScraping(trimmedUrl, quickMode)
    }
  } catch (error) {
    console.error('[FetchJob] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred while fetching the job description',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
