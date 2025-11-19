/**
 * Generate dynamic, reasoning-based coaching messages using Claude
 * Converts numeric curator scores + context into natural, human feedback
 * Replaces hardcoded templates with personalized, context-aware coaching
 */

import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from './parseJson'

export interface CoachingMessage {
  clarity: string
  relevance: string
  honesty: string
  unified: string
}

export interface JobContext {
  role?: string
  company?: string
  location?: string
}

/**
 * Extract sentences mentioning each trait using hybrid approach:
 * 1. Enhanced regex with broader patterns (fast, cheap)
 * 2. LLM-based classification fallback (accurate, used when regex finds < 2 traits)
 */
async function extractTraitSentences(
  text: string,
  model: string
): Promise<{ clarity: string; relevance: string; honesty: string }> {
  // Helper: Extract sentence around a match index
  const extractSentenceAround = (text: string, matchIndex: number): string => {
    // Find sentence boundaries around the match
    let startIdx = 0
    for (let i = matchIndex - 1; i >= 0; i--) {
      if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
        if (i === text.length - 1 || text[i + 1] === ' ' || text[i + 1] === '\n') {
          startIdx = i + 1
          while (startIdx < text.length && (text[startIdx] === ' ' || text[startIdx] === '\n')) {
            startIdx++
          }
          break
        }
      }
    }
    
    let endIdx = text.length
    for (let i = matchIndex; i < text.length; i++) {
      if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
        if (i === text.length - 1 || text[i + 1] === ' ' || text[i + 1] === '\n') {
          endIdx = i + 1
          break
        }
      }
    }
    
    return text.substring(startIdx, endIdx).trim()
  }

  // STEP 1: Enhanced regex with broader patterns (phrases, synonyms, contextual)
  const clarityPatterns = [
    // Direct keywords
    /\b(clarity|clear|readable|readability|understand|understood|comprehensible)\b/i,
    // Phrases indicating clarity
    /(flowed smoothly|easy to follow|well-organized|well-structured|organized structure|easy to read|well-written|concise|straightforward|easy to scan|scannable)/i,
    // Contextual mentions
    /(makes sense|comes across|gets the point|quick to grasp)/i
  ]
  
  const relevancePatterns = [
    // Direct keywords
    /\b(relevant|relevance|fit|aligned|alignment|apply|applies|matches|matched|tailored|targeted)\b/i,
    // Phrases indicating relevance
    /(specific to|geared toward|speaks to|addresses|connects with|relates to|fits the role|matches the job|aligns with)/i,
    // Contextual mentions
    /(what they're looking for|what they need|right for|suited for|perfect for)/i
  ]
  
  const honestyPatterns = [
    // Direct keywords
    /\b(honest|honesty|authentic|authenticity|genuine|truth|truthful|real|realistic|believable|credible|trustworthy)\b/i,
    // Phrases indicating honesty
    /(felt authentic|sounds genuine|comes across as|rings true|feels real|sounds believable|seems credible|feels trustworthy)/i,
    // Contextual mentions
    /(not inflated|not exaggerated|straightforward|direct|no fluff|no hype)/i
  ]

  // Try to find matches with enhanced patterns
  const findBestMatch = (patterns: RegExp[], text: string): { match: RegExpMatchArray; index: number } | null => {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match.index !== undefined) {
        return { match, index: match.index }
      }
    }
    return null
  }

  const clarityMatch = findBestMatch(clarityPatterns, text)
  const relevanceMatch = findBestMatch(relevancePatterns, text)
  const honestyMatch = findBestMatch(honestyPatterns, text)

  // Extract sentences if found
  const clarityText = clarityMatch ? extractSentenceAround(text, clarityMatch.index) : ''
  const relevanceText = relevanceMatch ? extractSentenceAround(text, relevanceMatch.index) : ''
  const honestyText = honestyMatch ? extractSentenceAround(text, honestyMatch.index) : ''

  // STEP 2: Check if regex found enough (at least 2 out of 3 traits)
  const foundCount = [clarityText, relevanceText, honestyText].filter(t => t.length > 0).length
  
  if (foundCount >= 2) {
    // Regex found enough - return results
    return { clarity: clarityText, relevance: relevanceText, honesty: honestyText }
  }

  // STEP 3: Fallback to LLM-based semantic classification
  // Regex missed context - use Claude to classify sentences semantically
  console.log('[Coaching LLM] Regex found < 2 traits, using LLM semantic classification fallback')
  
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Split text into sentences
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10) // Filter out very short fragments
    
    if (sentences.length === 0) {
      return { clarity: clarityText, relevance: relevanceText, honesty: honestyText }
    }

    const classificationPrompt = `<background_information>
You are analyzing coaching feedback about a resume. The feedback touches on three aspects:
- CLARITY: how clear, readable, or well-organized the writing is
- RELEVANCE: how well the resume fits or aligns with the role
- HONESTY: how authentic, genuine, or truthful the resume sounds

Your goal is to classify each sentence in the feedback according to which aspect(s) it relates to.
</background_information>

<instructions>
For each sentence below, identify which aspect(s) it relates to. A sentence can relate to multiple aspects.

If a sentence doesn't clearly relate to any aspect, omit it.
</instructions>

## Output description

Return JSON mapping sentence numbers to aspects (can be multiple):

{
  "clarity": [1, 3],
  "relevance": [2, 3],
  "honesty": [4]
}

Sentences:
${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`

    const classificationRes = await anthropic.messages.create({
      model,
      max_tokens: 200,
      temperature: 0.1, // Low temperature for consistent classification
      messages: [{ role: 'user', content: classificationPrompt }],
    })

    if (classificationRes.content?.length && classificationRes.content[0].type === 'text') {
      const classificationText = classificationRes.content[0].text.trim()
      
      // Parse classification JSON
      const jsonMatch = classificationText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const classification = JSON.parse(jsonMatch[0])
          
          // Extract sentences for each trait
          const getSentencesForTrait = (indices: number[] | undefined): string => {
            if (!indices || !Array.isArray(indices)) return ''
            const selected = indices
              .map(idx => sentences[idx - 1]) // Convert to 0-based
              .filter(s => s)
              .join(' ')
            return selected || ''
          }

          const llmClarity = getSentencesForTrait(classification.clarity) || clarityText
          const llmRelevance = getSentencesForTrait(classification.relevance) || relevanceText
          const llmHonesty = getSentencesForTrait(classification.honesty) || honestyText

          return {
            clarity: llmClarity,
            relevance: llmRelevance,
            honesty: llmHonesty
          }
        } catch (parseErr) {
          console.warn('[Coaching LLM] Failed to parse classification JSON:', parseErr)
        }
      }
    }
  } catch (llmErr) {
    console.warn('[Coaching LLM] LLM classification fallback failed:', llmErr)
  }

  // Return regex results even if incomplete (better than nothing)
  return { clarity: clarityText, relevance: relevanceText, honesty: honestyText }
}

/**
 * Model-generated coaching message
 * Uses Haiku for speed or Sonnet for depth depending on latency tolerance
 */
export async function generateCoachingMessages(
  evaluation: { clarity: number; relevance: number; honesty: number; feedback?: string },
  context: JobContext = {},
  opts: { model?: 'haiku' | 'sonnet'; originalResume?: string } = { model: 'haiku' }
): Promise<CoachingMessage> {
  const { clarity, relevance, honesty, feedback } = evaluation
  const { role, company, location } = context
  const originalResume = opts.originalResume || ''

  const model =
    opts.model === 'sonnet'
      ? 'claude-3-7-sonnet-20250219'
      : 'claude-3-haiku-20240307'

  const prompt = `<background_information>
You are a career coach helping a job seeker improve their resume. You are speaking directly to the job seeker, not writing notes to yourself or the system.

You will receive:
- An original resume (what the candidate actually has)
- Evaluator feedback (may contain suggestions - distinguish from observations)
- Context: Role: ${role || 'unspecified'}, Company: ${company || 'unspecified'}, Location: ${location || 'unspecified'}

Your goal is to provide helpful, conversational feedback about clarity, relevance, and honesty.
</background_information>

<instructions>
CRITICAL RULES - READ CAREFULLY:
1. ONLY reference what is ACTUALLY in the resume. Never mention skills, experiences, or roles that aren't explicitly stated.
2. The evaluator feedback may contain SUGGESTIONS (e.g., "consider adding X") - these are NOT things the candidate has. Only reference what's actually present.
3. If the feedback says "you could add" or "consider emphasizing" - that means it's NOT currently there. Do NOT say "you mention X" if X isn't in the resume.
4. Verify every claim: Before saying "you mention X" or "your experience with Y", check that X or Y actually appears in the resume text below.

When reading evaluator feedback, distinguish between:
- OBSERVATIONS: "The resume mentions X" or "You have Y" → These are things actually in the resume
- SUGGESTIONS: "Consider adding X" or "You could emphasize Y" → These are NOT in the resume, they're recommendations

Only reference observations as facts. Treat suggestions as recommendations, not existing content.

Write short, natural feedback as if chatting in person:
- Speak directly to them
- Never include internal thoughts, evaluations, or hidden commentary
- Don't use JSON or headings. Just write a few short paragraphs in a flowing, conversational style
- Your note should touch on: how clear the writing feels (clarity), how well it fits the role (relevance), whether it sounds authentic (honesty)

Guidelines:
- Sound natural and conversational, not robotic
- Vary your phrasing and rhythm
- Use small, human touches like "I think" or "you might try"
- Never mention scores or evaluation metrics
- Don't repeat the same sentence structures
- 80–120 words total
- One flowing message, not sections
- If role or company context is known, weave it naturally into one sentence, not repeatedly
- Be specific: ONLY reference actual experiences, skills, or details that appear in the resume above
- If suggesting improvements, say "you could consider X" not "you mention X" (unless X is actually in the resume)
</instructions>

ORIGINAL RESUME (what the candidate actually has):
${originalResume || 'Resume not provided - only reference what evaluator confirms exists.'}

Evaluator feedback (may contain suggestions - distinguish from observations):
    ${feedback || 'No specific feedback provided. Base your advice on general resume best practices.'}`

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const res = await anthropic.messages.create({
      model,
      max_tokens: 600,
      temperature: 0.8, // Higher temperature for more natural, varied language
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // JSON extraction hardening - validate response structure
    if (!res.content?.length || res.content[0].type !== 'text') {
      throw new Error('No text content in Claude response')
    }

    // Extract free-form text response
    const rawText = res.content[0].text.trim()
    
    if (!rawText || rawText.length < 20) {
      throw new Error('Response too short or empty')
    }

    // HYBRID SEMANTIC EXTRACTION: Enhanced regex first, LLM classification fallback
    const extracted = await extractTraitSentences(rawText, model)
    
    return {
      clarity: extracted.clarity || rawText.substring(0, Math.min(150, rawText.length)).trim(),
      relevance: extracted.relevance || rawText.substring(0, Math.min(150, rawText.length)).trim(),
      honesty: extracted.honesty || rawText.substring(0, Math.min(150, rawText.length)).trim(),
      unified: rawText
    }
  } catch (err) {
    console.error('[Coaching LLM] Failed to generate coaching messages:', err)
    
    // Natural fallback: retry once with a simpler prompt if first attempt failed
    // This gives us a second chance at natural output rather than canned text
    try {
      const fallbackPrompt = `You're a career coach giving quick feedback on a resume. Write 2-3 short, natural sentences about clarity, relevance, and authenticity. Be conversational and helpful.`
      
      // Initialize new client for fallback to ensure it exists
      const anthropicFallback = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })

      const fallbackRes = await anthropicFallback.messages.create({
        model,
        max_tokens: 300,
        temperature: 0.8,
        messages: [{ role: 'user', content: fallbackPrompt }],
      })

      if (fallbackRes.content?.length && fallbackRes.content[0].type === 'text') {
        const fallbackText = fallbackRes.content[0].text.trim()
        return {
          clarity: fallbackText,
          relevance: fallbackText,
          honesty: fallbackText,
          unified: fallbackText
        }
      }
    } catch (fallbackErr) {
      console.error('[Coaching LLM] Fallback retry also failed:', fallbackErr)
    }
    
    // Last resort: minimal, natural-sounding message (not a template)
    const { role, company } = context
    const contextHint = role && company 
      ? `For ${role} roles at ${company},`
      : role 
      ? `For ${role} roles,`
      : company
      ? `For roles at ${company},`
      : ''
    
    const minimalMessage = `Your resume has potential. ${contextHint ? contextHint + ' ' : ''}A few tweaks to make it clearer and more aligned with what they're looking for will help it stand out.`
    
    return {
      clarity: minimalMessage,
      relevance: minimalMessage,
      honesty: minimalMessage,
      unified: minimalMessage
    }
  }
}

/**
 * Generate unified coaching message only (lighter weight for simple use cases)
 */
export async function generateUnifiedCoachingMessage(
  evaluation: { clarity: number; relevance: number; honesty: number; feedback?: string },
  context: JobContext = {},
  opts: { model?: 'haiku' | 'sonnet' } = { model: 'haiku' }
): Promise<string> {
  const messages = await generateCoachingMessages(evaluation, context, opts)
  return messages.unified
}
