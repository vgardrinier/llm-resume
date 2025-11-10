/**
 * Utility for parsing JSON responses from Claude AI
 * Handles common issues like markdown code blocks, extra text, and braces inside strings
 */

export interface ParseJsonOptions {
  /**
   * Whether to attempt escape-fixing if initial parse fails
   * @default false
   */
  attemptEscapeFix?: boolean
  /**
   * Custom error message prefix for logging
   * @default 'JSON parse'
   */
  errorPrefix?: string
}

/**
 * Parse JSON from Claude's response text
 * Handles:
 * - Markdown code blocks (```json ... ```)
 * - Extra text before/after JSON
 * - Braces inside string values (properly tracks string boundaries)
 * 
 * @param responseText - Raw response text from Claude
 * @param options - Optional configuration
 * @returns Parsed JSON object
 * @throws Error if JSON cannot be parsed
 */
export function parseClaudeJson<T = any>(
  responseText: string,
  options: ParseJsonOptions = {}
): T {
  const { attemptEscapeFix = false, errorPrefix = 'JSON parse' } = options

  // Step 1: Clean markdown code blocks
  let cleaned = responseText.trim()
  cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '')

  // Step 2: Try direct parse first (fastest path)
  try {
    return JSON.parse(cleaned)
  } catch {
    // Continue to extraction logic
  }

  // Step 3: Try extracting from code blocks
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch {
      // Continue to brace counting
    }
  }

  // Step 4: Find JSON object by counting braces (handles braces inside strings)
  const firstBrace = cleaned.indexOf('{')
  if (firstBrace === -1) {
    throw new Error(`${errorPrefix}: No JSON object found in response`)
  }

  let braceCount = 0
  let endIndex = -1
  let inString = false
  let escapeNext = false

  for (let i = firstBrace; i < cleaned.length; i++) {
    const char = cleaned[i]

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

  if (braceCount !== 0 || endIndex === -1) {
    throw new Error(`${errorPrefix}: Incomplete or unmatched braces in JSON`)
  }

  const jsonString = cleaned.substring(firstBrace, endIndex + 1)

  // Step 5: Try parsing extracted JSON
  try {
    return JSON.parse(jsonString)
  } catch (parseError) {
    // Step 6: Optional escape-fixing fallback (rarely needed)
    if (attemptEscapeFix) {
      try {
        let fixedJson = jsonString
        // Fix escaped characters in string values
        fixedJson = fixedJson.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match, content) => {
          const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/"/g, '\\"')
          return `"${escaped}"`
        })
        return JSON.parse(fixedJson)
      } catch {
        // Escape fix failed, throw original error
      }
    }

    throw new Error(
      `${errorPrefix}: Failed to parse JSON. ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
    )
  }
}

/**
 * Parse JSON array from Claude's response (for theme extraction, etc.)
 * 
 * @param responseText - Raw response text from Claude
 * @returns Parsed array
 * @throws Error if array cannot be parsed
 */
export function parseClaudeJsonArray<T = any>(
  responseText: string
): T[] {
  const cleaned = responseText.trim()
  
  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // Continue to extraction
  }

  // Extract array from response
  const arrayMatch = cleaned.match(/\[[\s\S]*?\]/)
  if (!arrayMatch) {
    throw new Error('No JSON array found in response')
  }

  try {
    return JSON.parse(arrayMatch[0])
  } catch (error) {
    throw new Error(`Failed to parse JSON array: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

