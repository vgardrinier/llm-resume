import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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
    
    console.log('[GetCountryFlag] Raw response from Claude:', {
      location,
      responseText,
      responseLength: responseText.length,
      responseChars: Array.from(responseText).map(c => `${c} (U+${c.codePointAt(0)?.toString(16).toUpperCase()})`)
    })
    
    // Extract flag emoji from response
    // Flag emojis are composed of two regional indicator symbols (U+1F1E6 to U+1F1FF)
    // Regional indicator symbols: 🇦 (U+1F1E6) to 🇿 (U+1F1FF)
    const regionalIndicatorStart = 0x1F1E6
    const regionalIndicatorEnd = 0x1F1FF
    
    // Method 1: Try regex with Unicode escape sequence
    // Note: In JavaScript, we need to use \u{...} syntax for Unicode code points > 0xFFFF
    let flag = ''
    try {
      // Use RegExp constructor to avoid TS target version issues with /u flag
      const flagEmojiRegex = new RegExp('[\\u{1F1E6}-\\u{1F1FF}]{2}', 'u')
      const emojiMatch = responseText.match(flagEmojiRegex)
      if (emojiMatch) {
        flag = emojiMatch[0]
      }
    } catch (e) {
      console.warn('[GetCountryFlag] Regex method failed:', e)
    }
    
    // Method 2: Fallback - manually scan for two consecutive regional indicators
    // This handles cases where regex might fail or response has extra characters
    if (!flag) {
      const chars = Array.from(responseText)
      for (let i = 0; i < chars.length - 1; i++) {
        const code1 = chars[i].codePointAt(0) || 0
        const code2 = chars[i + 1].codePointAt(0) || 0
        if (code1 >= regionalIndicatorStart && code1 <= regionalIndicatorEnd &&
            code2 >= regionalIndicatorStart && code2 <= regionalIndicatorEnd) {
          flag = chars[i] + chars[i + 1]
          console.log('[GetCountryFlag] Found flag via manual scan:', {
            flag,
            code1: `U+${code1.toString(16).toUpperCase()}`,
            code2: `U+${code2.toString(16).toUpperCase()}`
          })
          break
        }
      }
    }
    
    console.log('[GetCountryFlag] Extracted flag:', {
      location,
      flag,
      flagLength: flag.length,
      hasFlag: flag.length > 0,
      responsePreview: responseText.substring(0, 50)
    })

    return NextResponse.json({ flag })

  } catch (error) {
    console.error('[GetCountryFlag] Error:', error)
    return NextResponse.json(
      { error: 'Failed to determine country flag', flag: '' },
      { status: 500 }
    )
  }
}



