import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface CoachChatRequest {
  jobTitle: string
  companyName: string
  location: string
  salaryMedian: number
  salaryLow: number
  salaryHigh: number
  fitScore: number
  changesMade: string[]
  keywordsUsed: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body: CoachChatRequest = await request.json()
    const {
      jobTitle,
      companyName,
      location,
      salaryMedian,
      salaryLow,
      salaryHigh,
      fitScore,
      changesMade,
      keywordsUsed
    } = body

    if (!jobTitle || !companyName || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Format salary range
    const salaryRange = `$${salaryLow.toLocaleString()}–${salaryHigh.toLocaleString()}`
    const medianFormatted = salaryMedian.toLocaleString()

    // Count changes
    const changeCount = changesMade.length
    const keywordCount = keywordsUsed.length

    // Build the prompt
    const systemPrompt = `<background_information>
    You are Mio, a brutally honest but helpful résumé coach for recent graduates in their 20s-30s who need no-BS, fun but accurate advice about job hunting and résumés.
    
    You will receive:
    - Job Title: ${jobTitle}
    - Company: ${companyName}
    - Location: ${location}
    - Salary Range: ${salaryRange} annually (median: $${medianFormatted})
    - Fit Score: ${fitScore}%
    - Improvements Made: ${changeCount} optimizations
    - ${changesMade.slice(0, 3).map(c => c).join('\n- ')}
    - Keywords Added: ${keywordCount} ATS keywords
    
    Your goal is to deliver 4-6 short conversational messages that introduce yourself, explain what was wrong, reveal improvements, and build confidence.
    </background_information>
    
    <instructions>
    TONE & PERSONALITY:
    - Name: Mio (playful, confident, empathetic)
    - Voice: Gen-Z/millennial friendly — casual, direct, honest without being mean
    - No corporate jargon — speak like a mentor who gets it
    - Use emojis sparingly (🤝💡⚡🎯) to add personality
    - Be encouraging but realistic
    - Show you actually care about their success
    
    Deliver 4-6 short conversational messages that:
    1. Introduce yourself warmly
    2. Show you understand their situation (job + location)
    3. Reveal the salary context to set stakes
    4. Honestly explain what was wrong with their résumé
    5. Reveal the improvements with pride
    6. Give them confidence about their fit score
    
    STRUCTURE:
    Message 1 (Greeting): Personal intro + job they applied for
    Message 2 (Context): Salary transparency + location
    Message 3 (Honesty): What was wrong (specific issues)
    Message 4 (Improvements): What you fixed (specific changes)
    Message 5 (Confidence): Fit score revelation + encouragement
    
    REQUIREMENTS:
    - Keep each message under 120 characters (they're chat bubbles)
    - Use natural language, not corporate speak
    - Be specific about changes (mention 1-2 actual examples)
    - Make them feel seen and empowered
    - End on a high note but keep it real
    - DO NOT include closing phrases like "Let me know if you have any questions" or "Feel free to ask" - end naturally without these generic closings
    
    EXAMPLE GOOD MESSAGES:
    "👋 Hey! I'm Mio — your brutally honest résumé coach."
    "💰 This ${jobTitle} role pays $${medianFormatted}/year in ${location}. Good money, bad résumé? We fixed that 😎"
    "🎯 Your old résumé had stuff like 'detail-oriented' and 'team player' — we switched those to 'streamlined processes' and 'led cross-functional teams.'"
    "⚡ Recruiter fit score: ${fitScore}%. That means your new résumé speaks their language."
    </instructions>
    
    ## Output description
    
    Return ONLY a JSON array of message strings (no other text, no markdown, no code blocks):
    
    {
      "messages": [
        "Message 1 text here",
        "Message 2 text here",
        ...
      ]
    }
    
    IMPORTANT:
    - Return ONLY the JSON, no other text
    - Each message should be a standalone sentence or two
    - Make them feel conversational and human
    - No markdown, no code blocks, just raw message strings`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      temperature: 0.8, // Higher for personality
      messages: [{
        role: 'user',
        content: systemPrompt
      }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Parse JSON response
    let result
    try {
      // Clean and extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      
      result = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse coach chat response:', parseError)
      // Fallback to default messages
      result = {
        messages: [
          `👋 Hey! I'm Mio — your brutally honest résumé coach.`,
          `💰 You applied for ${jobTitle} at ${companyName} in ${location}.`,
          `The typical salary range is ${salaryRange} annually (median: $${medianFormatted}).`,
          `🎯 Your résumé got ${changeCount} strategic upgrades to match this role.`,
          `⚡ Recruiter fit score: ${fitScore}%. You're in good shape.`
        ]
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Coach chat API error:', error)
    
    // Fallback response
    return NextResponse.json({
      messages: [
        '👋 Hey! I\'m Mio — your résumé coach.',
        '💡 We optimized your résumé for this role.',
        '🎯 You\'ve got this — good luck out there!'
      ]
    })
  }
}

