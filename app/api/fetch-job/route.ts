import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import puppeteer from 'puppeteer'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Known job platforms that typically block scraping
const JOB_PLATFORMS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'monster.com',
  'careerbuilder.com',
  'ziprecruiter.com',
  'simplyhired.com',
]

function isJobPlatform(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return JOB_PLATFORMS.some(platform => hostname.includes(platform))
  } catch {
    return false
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
    const firstBrace = responseText.indexOf('{')
    if (firstBrace === -1) {
      throw new Error('No JSON object found in AI response')
    }

    let braceCount = 0
    let endIndex = -1

    for (let i = firstBrace; i < responseText.length; i++) {
      if (responseText[i] === '{') braceCount++
      if (responseText[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          endIndex = i
          break
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
function extractFromJsonLd(html: string): { jobDescription?: string; companyName?: string; jobTitle?: string } | null {
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
        const company = item.hiringOrganization?.name || item.organization?.name
        const title = item.title || item.name

        if (fullDesc && fullDesc.length >= 40) {
          return { jobDescription: fullDesc, companyName: company || undefined, jobTitle: title || undefined }
        }
      }
    } catch {
      // ignore JSON parse errors and continue
    }
  }
  return null
}

// Vision-based extraction for job platforms (slow but reliable)
async function extractWithVision(url: string) {
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

    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
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
              text: `You are analyzing a screenshot of a job posting webpage. Extract the following information:

1. The complete job description (all relevant text including responsibilities, qualifications, benefits, etc.)
2. The company name
3. The job title

Please respond in JSON format:
{
  "jobDescription": "the full job description text here",
  "companyName": "company name",
  "jobTitle": "job title"
}

Instructions:
- Extract ALL relevant job posting content, not just a summary
- Include responsibilities, qualifications, requirements, benefits, etc.
- Ignore navigation menus, headers, footers, ads, and other page elements
- Keep the job description text clean and readable
- If you cannot find certain fields, use null
- Be thorough and capture as much detail as possible from the job posting`,
            },
          ],
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const extractedData = parseClaudeResponse(responseText)

    console.log(`Vision extraction result - Job: "${extractedData.jobTitle}", Company: "${extractedData.companyName}", Description: ${extractedData.jobDescription?.length || 0} chars`)

    if (!extractedData.jobDescription || extractedData.jobDescription.trim().length < 40) {
      return NextResponse.json(
        { error: 'Could not extract a valid job description from this URL. The page may not contain a job posting.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      jobDescription: extractedData.jobDescription,
      companyName: extractedData.companyName || null,
      jobTitle: extractedData.jobTitle || null,
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

// HTML scraping for company websites (fast)
async function extractWithScraping(url: string) {
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
  } catch (error) {
    console.error('Scraping failed, falling back to vision:', error)
    return await extractWithVision(url)
  }

  // Try JSON-LD extraction first (fastest)
  const jsonLdResult = extractFromJsonLd(htmlContent)
  if (jsonLdResult?.jobDescription) {
    console.log('Successfully extracted from JSON-LD')
    return NextResponse.json({
      jobDescription: jsonLdResult.jobDescription,
      companyName: jsonLdResult.companyName || null,
      jobTitle: jsonLdResult.jobTitle || null,
    })
  }

  // Fallback to Claude HTML parsing
  try {
    console.log('JSON-LD not found, using Claude to parse HTML...')
    const extractionPrompt = `You are a job posting parser. Extract the following information from this HTML content:

1. The complete job description (all relevant text including responsibilities, qualifications, benefits, etc.)
2. The company name
3. The job title (if available)

HTML Content:
${htmlContent.slice(0, 50000)}

Please respond in JSON format:
{
  "jobDescription": "the full job description text here",
  "companyName": "company name",
  "jobTitle": "job title (if found)"
}

Instructions:
- Extract ALL relevant job posting content, not just a summary
- Remove HTML tags, navigation menus, headers, footers, and other page elements
- Keep the job description text clean and readable
- If you cannot find certain fields, use null`

    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const extractedData = parseClaudeResponse(responseText)

    if (!extractedData.jobDescription || extractedData.jobDescription.trim().length < 40) {
      return NextResponse.json(
        { error: 'Could not extract a valid job description from this URL. The page may not contain a job posting.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      jobDescription: extractedData.jobDescription,
      companyName: extractedData.companyName || null,
      jobTitle: extractedData.jobTitle || null,
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
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    let validUrl: URL
    try {
      validUrl = new URL(url)
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format. Please enter a valid URL starting with http:// or https://' },
        { status: 400 }
      )
    }

    // Determine extraction strategy based on URL
    const useVision = isJobPlatform(url)

    if (useVision) {
      console.log(`Detected job platform URL, using vision extraction: ${url}`)
      return await extractWithVision(url)
    } else {
      console.log(`Company website detected, attempting HTML scraping: ${url}`)
      return await extractWithScraping(url)
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
