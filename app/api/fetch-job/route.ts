import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

    // Fetch the HTML content from the URL
    let htmlContent: string
    try {
      const fetchResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch URL: ${fetchResponse.status} ${fetchResponse.statusText}`)
      }

      htmlContent = await fetchResponse.text()
    } catch (error) {
      console.error('Fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch content from URL. The site may be blocking automated requests or the URL may be invalid.' },
        { status: 500 }
      )
    }

    // Quick fallback 1: try to extract from JSON-LD JobPosting without LLM
    const extractFromJsonLd = (html: string): { jobDescription?: string; companyName?: string; jobTitle?: string } | null => {
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

            const rawDesc = (item.description || '').toString()
            const desc = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const company = item.hiringOrganization?.name || item.organization?.name
            const title = item.title || item.name
            if (desc && desc.length > 80) {
              return { jobDescription: desc, companyName: company || undefined, jobTitle: title || undefined }
            }
          }
        } catch {
          // ignore JSON parse errors and continue
        }
      }
      return null
    }

    const jsonLdResult = extractFromJsonLd(htmlContent)
    if (jsonLdResult?.jobDescription) {
      return NextResponse.json({
        jobDescription: jsonLdResult.jobDescription,
        companyName: jsonLdResult.companyName || null,
        jobTitle: jsonLdResult.jobTitle || null,
      })
    }

    // Use Claude to extract job description and company info from HTML as a robust fallback
    try {
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

      // Parse the JSON response from Claude with robust extraction
      let extractedData: any

      try {
        // First, try parsing the entire response as JSON
        extractedData = JSON.parse(responseText)
      } catch {
        // If that fails, try to extract JSON from code blocks or text
        let jsonString = responseText

        // Try extracting from ```json code blocks
        const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (codeBlockMatch) {
          jsonString = codeBlockMatch[1]
        } else {
          // Find the first complete JSON object by counting braces
          const firstBrace = responseText.indexOf('{')
          if (firstBrace === -1) {
            throw new Error('No JSON object found in AI response')
          }

          let braceCount = 0
          let startIndex = firstBrace
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

          jsonString = responseText.substring(startIndex, endIndex + 1)
        }

        extractedData = JSON.parse(jsonString)
      }

      if (!extractedData.jobDescription || extractedData.jobDescription.trim().length < 50) {
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
      console.error('AI extraction error:', error)
      return NextResponse.json(
        { error: 'Failed to extract job description using AI. The page content may be too complex or not a job posting.' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
