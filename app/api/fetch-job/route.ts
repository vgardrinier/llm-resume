import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import puppeteer from 'puppeteer'

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

// Helper to parse Claude's JSON response
function parseClaudeResponse(responseText: string): any {
  try {
    return JSON.parse(responseText)
  } catch {
    // Try extracting from ```json code blocks
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1])
    }

    // Find the first complete JSON object by counting braces
    // Important: ignore braces inside string values
    const firstBrace = responseText.indexOf('{')
    if (firstBrace === -1) {
      throw new Error('No JSON object found in AI response')
    }

    let braceCount = 0
    let endIndex = -1
    let inString = false
    let escapeNext = false

    for (let i = firstBrace; i < responseText.length; i++) {
      const char = responseText[i]

      // Handle escape sequences
      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        continue
      }

      // Track string boundaries (only count unescaped quotes)
      if (char === '"') {
        inString = !inString
        continue
      }

      // Only count braces when not inside a string
      if (!inString) {
        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            endIndex = i
            break
          }
        }
      }
    }

    if (endIndex === -1) {
      throw new Error('Incomplete JSON object in AI response')
    }

    return JSON.parse(responseText.substring(firstBrace, endIndex + 1))
  }
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
    // Fall back to full extraction if quick fails
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
    console.log('Launching browser for vision extraction...')
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

    console.log(`Navigating to ${url}...`)
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('Taking screenshot...')
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
      encoding: 'base64',
    }) as string

    await browser.close()
    browser = null

    console.log('Screenshot captured, sending to Claude Vision...')
    const screenshotBase64 = screenshot

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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
        console.log('[FetchJob] Quick extraction: Returning metadata from Claude')
        return NextResponse.json({
          companyName: cleanedQuickData.companyName,
          jobTitle: cleanedQuickData.jobTitle,
          location: cleanedQuickData.location,
          quick: true,
        })
      }
    }

    // Use Claude to parse the scraped content
    const extractionPrompt = `<background_information>
You are a job posting parser. Your goal is to extract complete job posting information from scraped webpage content.
</background_information>

<instructions>
Extract the following information:

1. The complete job description (all relevant text including responsibilities, qualifications, benefits, etc.)
2. The company name
3. The FULL job title (include all parts like "Associate Product Manager, Recent Grad" not just "Product Manager")
4. The job location (city, state/country - e.g., "Pittsburgh, PA" or "San Francisco, CA" or "Warsaw, Poland")

Instructions:
- Extract ALL relevant job posting content, not just a summary
- Remove navigation menus, headers, footers, and other page elements
- Keep the job description text clean and readable
- For job title: Extract the COMPLETE title as shown
- For location: Look for city and state/country information. Extract EXACTLY as written (e.g., if it says "Warsaw, Poland", return that exactly - do NOT substitute with "Berlin" or any other city)
- CRITICAL: The jobDescription field must contain the FULL job description, not a summary. If the description is long, include all of it.
- DO NOT truncate, summarize, or abbreviate the job description. Extract every word, sentence, and paragraph.
- If the job description is 2000+ characters, you MUST include all 2000+ characters in your response.
- Use the full token allowance if needed - completeness is more important than brevity.
</instructions>

## Output description

Please respond in JSON format:

{
  "jobDescription": "the full job description text here",
  "companyName": "company name",
  "jobTitle": "complete job title including all qualifiers",
  "location": "city, state or city, country"
}

Webpage Content:
${htmlContent.slice(0, 80000)}`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 32000, // Increased to ensure full job description extraction (no truncation)
      messages: [
        {
          role: 'user',
          content: extractionPrompt,
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

  // Try JSON-LD extraction first (fastest)
  const jsonLdResult = extractFromJsonLd(htmlContent)
  
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
  
  if (jsonLdResult?.jobDescription) {
    const jdLength = jsonLdResult.jobDescription.length
    console.log(`[FetchJob] ✅ Full JD extraction completed: ${jdLength} characters`, {
      jobTitle: jsonLdResult.jobTitle || 'N/A',
      company: jsonLdResult.companyName || 'N/A',
      location: jsonLdResult.location || 'N/A',
      method: 'json-ld',
    })
    // Try to extract location from JSON-LD if available
    const locationFromJsonLd = jsonLdResult.location || null
    return NextResponse.json({
      jobDescription: jsonLdResult.jobDescription,
      companyName: jsonLdResult.companyName || null,
      jobTitle: jsonLdResult.jobTitle || null,
      location: locationFromJsonLd,
    })
  }
  
    // If quick mode, try a fast extraction with smaller prompt
    if (quick) {
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

    try {
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
    }
  }

  // Fallback to Claude HTML parsing
  try {
    console.log('JSON-LD not found, using Claude to parse HTML...')
    // Increase HTML slice limit to ensure we capture full content
    const htmlSlice = htmlContent.slice(0, 200000) // Increased from 50000 to capture more content
    console.log(`[FetchJob] Sending ${htmlSlice.length} chars of HTML to Claude (original: ${htmlContent.length} chars)`)
    
    const extractionPrompt = `<background_information>
You are a job posting parser. Your goal is to extract complete job posting information from HTML content.
</background_information>

<instructions>
Extract the following information:

1. The complete job description (all relevant text including responsibilities, qualifications, benefits, etc.)
2. The company name
3. The FULL job title (include all parts like "Associate Product Manager, Recent Grad" not just "Product Manager")
4. The job location (city, state/country - e.g., "Pittsburgh, PA" or "San Francisco, CA" or "Warsaw, Poland")

Instructions:
- Extract ALL relevant job posting content, not just a summary
- Remove HTML tags, navigation menus, headers, footers, and other page elements
- Keep the job description text clean and readable
- For job title: Extract the COMPLETE title as shown (e.g., "Associate Product Manager, Recent Grad" not just "Product Manager")
- For location: Look for city and state/country information, often shown near the job title or company name. Extract EXACTLY as written (e.g., if it says "Warsaw, Poland", return that exactly - do NOT substitute with "Berlin" or any other city)
- CRITICAL: The jobDescription field must contain the FULL job description, not a summary. If the description is long, include all of it.
- DO NOT truncate, summarize, or abbreviate the job description. Extract every word, sentence, and paragraph.
- If the job description is 2000+ characters, you MUST include all 2000+ characters in your response.
- Use the full token allowance if needed - completeness is more important than brevity.
</instructions>

## Output description

Please respond in JSON format:

{
  "jobDescription": "the full job description text here",
  "companyName": "company name",
  "jobTitle": "complete job title including all qualifiers",
  "location": "city, state or city, country"
}

HTML Content:
${htmlSlice}`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 32000, // Increased to ensure full job description extraction (no truncation)
      messages: [
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log(`[FetchJob] Claude response length: ${responseText.length} chars`)
    
    let extractedData
    try {
      extractedData = parseClaudeResponse(responseText)
    } catch (parseError) {
      console.error('[FetchJob] JSON parse failed, raw response:', responseText.substring(0, 2000))
      console.error('[FetchJob] Parse error details:', parseError)
      
      // Try a more lenient parsing approach
      try {
        // Remove any text before first { and after last }
        const firstBrace = responseText.indexOf('{')
        const lastBrace = responseText.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = responseText.substring(firstBrace, lastBrace + 1)
          extractedData = JSON.parse(jsonStr)
        } else {
          throw new Error('No JSON object found in response')
        }
      } catch (fallbackError) {
        console.error('[FetchJob] Fallback parsing also failed')
        return NextResponse.json(
          { error: 'Failed to parse job description from AI response. The page may not contain valid job posting information.' },
          { status: 500 }
        )
      }
    }

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
