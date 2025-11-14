import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { location } = body

    if (!location || typeof location !== 'string') {
      return NextResponse.json(
        { error: 'Location is required and must be a string' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const prompt = `Given a location string, determine the country and return ONLY the country flag emoji.

Location: "${location}"

Rules:
- If the location is a city (e.g., "Madrid", "Paris", "New York"), determine which country that city is in
- If the location is a country name (e.g., "Spain", "France", "United States"), use that country
- If the location contains both city and country (e.g., "Madrid, Spain"), use the country
- Return ONLY the flag emoji, nothing else
- If you cannot determine the country, return an empty string

Examples:
- "Madrid" → 🇪🇸
- "Madrid, Spain" → 🇪🇸
- "Paris, France" → 🇫🇷
- "New York, NY" → 🇺🇸
- "Barcelona" → 🇪🇸
- "London, UK" → 🇬🇧
- "San Francisco, CA" → 🇺🇸

Return only the emoji, no text, no explanation.`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Use Haiku for speed and cost
      max_tokens: 10, // We only need the emoji
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    
    // Extract emoji from response (in case there's any extra text)
    const emojiMatch = responseText.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)
    const flag = emojiMatch ? emojiMatch[0] : ''

    return NextResponse.json({ flag })

  } catch (error) {
    console.error('[GetCountryFlag] Error:', error)
    return NextResponse.json(
      { error: 'Failed to determine country flag', flag: '' },
      { status: 500 }
    )
  }
}


