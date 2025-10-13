// Import Next.js API utilities for handling HTTP requests/responses
import { NextRequest, NextResponse } from 'next/server'
// Import the Anthropic SDK to call Claude AI
import Anthropic from '@anthropic-ai/sdk'

// Create an Anthropic client instance using your API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// This function handles POST requests to /api/generate
export async function POST(request: NextRequest) {
  try {
    // Step 1: Extract the data sent from the frontend
    const body = await request.json()
    const { job_description, candidate_resume, company_vision } = body

    // Step 2: Validate that required fields are present
    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    // Step 3: Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    console.log('Starting resume generation with Anthropic API...')

    // Step 4: Build the prompt for Claude AI
    // This is the "instruction manual" that tells Claude exactly what to do
    const prompt = `You are a world-class résumé generator for technical and product talent.
You receive:
1. A job description (plain text)
2. The candidate's résumé text or LinkedIn summary
3. Optional company vision or culture text

Your job:
- Produce a one-page résumé tailored to the role.
- Format in clean Markdown, optimized for LLM/ATS parsing (no columns, no tables, no images).
- Include key measurable achievements and keywords from the job description.
- Ensure it fits a founder/engineer hybrid tone (builder, results-driven, technically fluent).
- Output *only* valid JSON with the following structure:

{
  "resume_md": "markdown resume text",
  "fit_summary": "3-line explanation of why the candidate fits the role",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Follow these rules strictly:
- The résumé must fit one printed page (about 500–700 words).
- Always start with the candidate's name, title, and contact placeholders.
- Use strong action verbs, quantify results, and preserve factual truth.
- Do NOT include any explanations, markdown formatting outside the JSON, or meta-commentary.

Job Description:
${job_description}

Candidate Resume:
${candidate_resume}

${company_vision ? `Company Vision/Culture:
${company_vision}` : ''}`

    // Step 5: Call Claude AI with our prompt
    // This sends the prompt to Claude and waits for a response
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',  // Use the latest Claude model
      max_tokens: 4000,                     // Maximum length of response
      temperature: 0.3,                     // Lower = more consistent, Higher = more creative
      messages: [
        {
          role: 'user',                     // We're the user asking Claude
          content: prompt                   // Our detailed instructions
        }
      ]
    })

    // Step 6: Extract the text response from Claude
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('Anthropic API response received, length:', responseText.length)
    
    // Step 7: Parse Claude's JSON response
    // Claude should return JSON, but sometimes it adds extra text, so we extract just the JSON part
    let result
    try {
      // Look for JSON object in the response (handles cases where Claude adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON found in response. Raw response:', responseText)
        throw new Error('No JSON found in response')
      }
      
      // Convert the JSON string to a JavaScript object
      result = JSON.parse(jsonMatch[0])
      console.log('Successfully parsed JSON response')
      
      // Step 8: Validate that Claude gave us the right structure
      // Check that all required fields are present and correct types
      if (!result.resume_md || !result.fit_summary || !Array.isArray(result.keywords)) {
        console.error('Invalid response structure:', result)
        throw new Error('Invalid response structure')
      }
    } catch (parseError) {
      // If parsing fails, log the error and return a helpful message to the user
      console.error('Failed to parse Anthropic response:', parseError)
      console.error('Raw response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // Step 9: Success! Send the parsed result back to the frontend
    return NextResponse.json(result)

  } catch (error) {
    // Step 10: Handle any errors that occur during the process
    console.error('API error:', error)
    
    // Handle Anthropic API specific errors (like invalid API key, rate limits, etc.)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error: 'Anthropic API error',
          details: error.message,
          status: error.status
        },
        { status: 500 }
      )
    }
    
    // Handle any other unexpected errors
    return NextResponse.json(
      {
        error: 'Failed to generate resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}