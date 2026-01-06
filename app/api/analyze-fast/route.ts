import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeJson } from '@/lib/utils/parseJson'
import crypto from 'crypto'

export const maxDuration = 120

/**
 * FAST MODE - Single-pass resume optimization
 *
 * Goal: 20-30s total time, tight diffs, built-in validation
 * Trade-off: No separate diagnostic panel, curator, or fit scoring
 */

function generateChangeId(section: string, originalText: string, suggestedText: string): string {
  const input = `${section}\n${originalText.trim()}\n${suggestedText.trim()}`
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  return `${section}_${hash.substring(0, 10)}`
}

/**
 * CONTACT INFO VALIDATION & SANITIZATION
 * 
 * PDF parsing and LLM extraction often produce garbage in contact fields.
 * This uses a two-layer approach:
 * 1. Rule-based sanitization (fast, handles common cases)
 * 2. AI validation (focused LLM call for edge cases)
 */
interface ContactInfo {
  name?: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  website?: string
}

/**
 * AI-POWERED CONTACT INFO VALIDATION
 * Uses a fast, focused LLM call to extract clean contact info from messy input.
 * This handles edge cases that rule-based validation misses.
 */
async function validateContactInfoWithAI(
  rawContactInfo: ContactInfo,
  originalResume: string,
  anthropic: Anthropic
): Promise<ContactInfo> {
  const prompt = `Extract ONLY the contact information from this resume header. Be strict and precise.

RAW PARSED DATA (may contain errors):
Name: ${rawContactInfo.name || 'NOT FOUND'}
Email: ${rawContactInfo.email || 'NOT FOUND'}
Phone: ${rawContactInfo.phone || 'NOT FOUND'}
Location: ${rawContactInfo.location || 'NOT FOUND'}

ORIGINAL RESUME (first 500 chars):
${originalResume.substring(0, 500)}

RULES:
1. NAME: Extract ONLY the person's full name (first + last, maybe middle). NO locations, dates, titles, or other text.
2. EMAIL: Must be a valid email format (user@domain.com). If not found or invalid, return null.
3. PHONE: Must contain 7-15 digits. Date ranges like "2013-2017" are NOT phones. If invalid, return null.
4. LOCATION: City, Country or City, State format. NO dates, job titles, or company names. If not clearly a location, return null.

Return ONLY valid JSON (no markdown):
{
  "name": "First Last",
  "email": "email@example.com or null",
  "phone": "+1 234 567 8900 or null",
  "location": "City, Country or null"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Return validated contact info, converting "null" strings to undefined
    return {
      name: parsed.name && parsed.name !== 'null' ? parsed.name : undefined,
      email: parsed.email && parsed.email !== 'null' ? parsed.email : undefined,
      phone: parsed.phone && parsed.phone !== 'null' ? parsed.phone : undefined,
      location: parsed.location && parsed.location !== 'null' ? parsed.location : undefined
    }
  } catch (error) {
    console.warn('[Fast-Mode] AI contact validation failed, using rule-based fallback:', error)
    return rawContactInfo // Fall back to the raw input if AI fails
  }
}

// Words that should NEVER appear in a person's name
const BLOCKED_NAME_WORDS = new Set([
  // Section headers
  'skills', 'experience', 'education', 'summary', 'projects', 'certifications',
  'languages', 'interests', 'achievements', 'objective', 'profile', 'contact',
  'phone', 'email', 'address', 'linkedin', 'github', 'portfolio', 'references',
  'professional', 'technical', 'work', 'history', 'employment', 'career',
  'personal', 'information', 'details', 'about', 'me', 'resume', 'cv',
  'curriculum', 'vitae', 'present', 'current',
  // Months
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  // Locations
  'spain', 'usa', 'uk', 'france', 'germany', 'canada', 'australia', 'india',
  'nyc', 'sf', 'la', 'london', 'paris', 'berlin', 'remote', 'hybrid',
  'california', 'texas', 'florida', 'massachusetts', 'washington',
  'barcelona', 'madrid', 'munich', 'amsterdam', 'dublin', 'singapore',
  'seattle', 'boston', 'chicago', 'austin', 'europe', 'asia', 'americas', 'emea', 'apac'
])

function sanitizeContactInfo(raw: ContactInfo, originalResume: string): ContactInfo {
  const sanitized: ContactInfo = {}
  
  // STEP 1: Clean the name field with comprehensive filtering
  let name = raw.name || ''
  
  // Remove email addresses
  name = name.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
  // Remove phone numbers
  name = name.replace(/[\+]?[\d\s\-().]{7,}/g, '')
  // Remove URLs
  name = name.replace(/https?:\/\/[^\s]+/gi, '')
  name = name.replace(/www\.[^\s]+/gi, '')
  name = name.replace(/linkedin\.com[^\s]*/gi, '')
  // Remove dates
  name = name.replace(/\b\d{4}\s*[-–]\s*\d{4}\b/g, '')
  name = name.replace(/\b(19|20)\d{2}\b/g, '')
  // Remove garbage characters
  name = name.replace(/[()•|/\\@#:;,.\-_]/g, ' ')
  
  // Filter out blocked words
  const nameWords = name.split(/\s+/).filter(word => {
    const lower = word.toLowerCase().replace(/[,.]$/g, '')
    return lower.length > 1 && !BLOCKED_NAME_WORDS.has(lower)
  })
  // Take only first 3 words (a real name is typically 2-3 words)
  name = nameWords.slice(0, 3).join(' ').trim()
  
  // If name is still too long or suspicious, extract from original resume
  if (name.length > 50 || name.length < 2 || !/^[A-Za-zÀ-ÿ\s\-'.]+$/.test(name)) {
    const resumeLines = originalResume.split('\n').filter(l => l.trim().length > 0)
    const firstLine = resumeLines[0]?.trim() || ''
    
    // Try to extract name from first line (usually "JOHN DOE" or "John Doe")
    const potentialName = firstLine.split(/[|•,@\d]/)[0].trim()
    const cleanPotential = potentialName
      .split(/\s+/)
      .filter(w => !LOCATION_WORDS.has(w.toLowerCase().replace(/[,.]$/g, '')))
      .slice(0, 3) // Max 3 words for a name
      .join(' ')
      .trim()
    
    if (cleanPotential.length >= 2 && cleanPotential.length <= 50 && /^[A-Za-zÀ-ÿ\s\-'.]+$/.test(cleanPotential)) {
      name = cleanPotential
    }
  }
  
  // Final cleanup: capitalize properly
  name = name.replace(/\s+/g, ' ').trim()
  sanitized.name = name || 'Candidate'
  
  // STEP 2: Validate email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (raw.email && emailPattern.test(raw.email.trim())) {
    sanitized.email = raw.email.trim()
  } else {
    // Try to extract email from original resume
    const emailMatch = originalResume.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
    if (emailMatch) {
      sanitized.email = emailMatch
    }
  }
  
  // STEP 3: Validate phone (REJECT if it looks like a date range)
  let phone = raw.phone || ''
  
  // Detect and reject date-like patterns in phone
  const isDatePattern = /\b(19|20)\d{2}\s*[-–]\s*(19|20)?\d{2,4}\b/.test(phone) || // "2013-2017" or "2013 - 2017"
                       /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(phone) || // Month names
                       /\bpresent\b/i.test(phone) // "Present" like in date ranges
  
  if (!isDatePattern && phone.length > 0) {
    // Clean phone: keep only digits, spaces, dashes, parens, plus
    const cleanPhone = phone.replace(/[^\d\s\-+()]/g, '').trim()
    // Valid phone should have at least 7 digits
    const digitCount = (cleanPhone.match(/\d/g) || []).length
    if (digitCount >= 7 && digitCount <= 15) {
      sanitized.phone = cleanPhone
    }
  }
  
  // If no valid phone, try to extract from original resume
  if (!sanitized.phone) {
    const phoneMatch = originalResume.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/)?.[0]
    if (phoneMatch && !/\b(19|20)\d{2}\s*[-–]\s*(19|20)?\d{2,4}\b/.test(phoneMatch)) {
      sanitized.phone = phoneMatch.trim()
    }
  }
  
  // STEP 4: Validate location (clean it up, reject dates)
  let location = raw.location || ''
  
  // Remove dates from location
  location = location.replace(/\b\d{4}\s*[-–]\s*\d{4}\b/g, '').trim()
  location = location.replace(/\b(19|20)\d{2}\b/g, '').trim()
  location = location.replace(/[()•|]/g, '').trim()
  
  // Location should be short and contain mostly letters
  if (location.length > 0 && location.length <= 50 && /[A-Za-z]/.test(location)) {
    sanitized.location = location
  } else if (!sanitized.location) {
    // Try to find location from original resume (look for common patterns)
    const locationPatterns = [
      /(?:based in|located in|location:?\s*)([A-Za-z\s,]+)/i,
      /([A-Z][a-z]+,\s*[A-Z]{2})\b/, // "City, ST" format
      /\b(remote|hybrid)\b/i
    ]
    for (const pattern of locationPatterns) {
      const match = originalResume.match(pattern)
      if (match) {
        sanitized.location = match[1]?.trim() || match[0]?.trim()
        break
      }
    }
  }
  
  // STEP 5: Copy linkedin/website if present and valid
  if (raw.linkedin && /linkedin\.com|linkedin/i.test(raw.linkedin)) {
    sanitized.linkedin = raw.linkedin.replace(/^https?:\/\//, '')
  }
  if (raw.website && /\.[a-z]{2,}$/i.test(raw.website)) {
    sanitized.website = raw.website.replace(/^https?:\/\//, '')
  }
  
  return sanitized
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { originalResume, jobDescription } = body

    // Extract job metadata from URL extraction (if available)
    const jobTitle = body.job_title || body.jobTitle || 'Position'
    const companyName = body.company || body.companyName || null

    if (!originalResume || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Fast-Mode] ⚡ Starting single-pass optimization...')
    const startTime = Date.now()
    const timings = {
      start: startTime,
      llmStart: 0,
      llmEnd: 0,
      parseEnd: 0,
      total: 0
    }

    const prompt = `You are an EXPERT RESUME OPTIMIZER working in FAST MODE.

Your job: Parse the resume, apply strategic transformations, output optimized CV + changes.

ORIGINAL RESUME:
${originalResume}

TARGET JOB:
${jobDescription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1: PARSE + TRANSFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PARSE STRUCTURE
Extract:
- contactInfo (name, email, phone, location)
- sections array (Summary, Experience, Education, Skills, etc.)
- CRITICAL: PRESERVE ALL SECTIONS from original resume (Summary, Experience, Education, Skills, etc.)
- NEVER delete entire sections - only modify content within them

2. ANALYZE STRATEGICALLY (lightweight, inline)
- Role relevance: Which roles are HIGH/MEDIUM/LOW match to job?
- Language altitude: Current level (2-4), can we lift it?
- Metric gaps: Find 3 max bullets where impact is CLAIMED but NO number exists
- Key themes: What does the job prioritize? (ownership, scale, innovation, etc.)

3. APPLY TRANSFORMATIONS
Based on inline analysis:

EXPERIENCE - CRITICAL WORKFLOW:

For EACH company in the original resume, follow this exact process:

1. Read ONLY that company's section from the original
2. Note what work was done AT THAT SPECIFIC COMPANY
3. Write improved bullets using ONLY information from THAT company's section
4. Move to next company and repeat

Example workflow (generic):

Step 1 - Process Company A:
  Read original bullets under "Company A"
  Output: {
    "company": "Company A",
    "bullets": [improved versions of ONLY Company A's work]
  }

Step 2 - Process Company B:
  Read original bullets under "Company B"
  Output: {
    "company": "Company B",
    "bullets": [improved versions of ONLY Company B's work]
  }

ABSOLUTE RULES:
- Each company in output JSON MUST contain ONLY bullets derived from that same company in the original resume
- NEVER take a bullet from Company A in the original and put it under Company B in the output
- If you see "Company X: built product Y" in original → "built product Y" MUST appear under Company X in output, nowhere else
- Content isolation is MORE important than making the resume sound impressive

ALTITUDE:
- Lift language where possible (respect ceiling)
- Level 2→3: "coordinated" → "owned", "assisted" → "led"
- Level 3→4: add strategic framing, business context

METRICS (cap at 3 opportunities total):
- Only flag bullets where impact CLAIMED but NO metric exists
- For each: generate TWO variants
  1. suggested: neutral fallback (e.g. "improved performance measurably")
  2. suggested_with_metric: placeholder (e.g. "improved performance by [X]%")
- NEVER invent numbers

SUMMARY:
- Rewrite to emphasize job's key themes
- Match tone (technical depth vs leadership vs innovation)

4. TRACK CHANGES
For each modification, create change object with:
- section, original, suggested, suggested_with_metric (if metric opportunity)
- reason (1 sentence, strategic value)
- impactScore (1-10)
- evidence (SHORT QUOTE from original text this change is based on, or null if pure rewrite)
- metric_opportunity (only if applicable, with question + placeholder_format + neutral_fallback)

CHANGE LIMITS:
- Cap at 12-15 changes total. Quality over quantity.
- EXACTLY ONE suggestion per bullet - NO alternatives (users prefer simple choices)
- Each line gets AT MOST one modification suggestion

5. NEW BULLET ADDITIONS (important for job fit)
For the 1-2 MOST relevant experience entries, consider adding 1-2 NEW bullets that:
- Highlight skills/responsibilities that exist in the original but aren't prominent
- Restructure existing content to better match job requirements
- Use type: "addition" with empty original field
- Position them strategically (e.g., first bullet for high-impact additions)

Example addition:
{
  "type": "addition",
  "section": "Experience",
  "original": "",
  "suggested": "Led cross-functional initiatives to improve system reliability",
  "reason": "Adds visibility to leadership theme required by job",
  "impactScore": 7,
  "position": { "sectionIndex": 0, "bulletIndex": 0 }
}

ADDITION RULES:
- Only add bullets that can be INFERRED from existing content (don't invent)
- Max 2-3 additions total across all experiences
- Additions must align with job's top priorities

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2: CONTENT ISOLATION CHECK (critical - prevents mixing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: For each company in original resume, identify 2-3 unique domain keywords
Example: If Company A worked on "solar energy systems" → keywords: ["solar", "energy"]
         If Company B worked on "venture investments" → keywords: ["venture", "investment"]

Step 2: Cross-reference validation
For EACH company in your output:
- Verify every bullet uses keywords that appeared under THAT SAME company in the original
- If a bullet mentions keywords from a different company → DELETE that bullet immediately
- Better to have fewer bullets than to mix company content

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: HONESTY PASS (critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before final output, scan EVERY change:

REMOVE if change invents:
- Numbers not in original (e.g. adding "35%" when no % exists)
- Technologies not in original (e.g. adding "React" when only "JavaScript" mentioned)
- Companies/projects not in original
- Facts not supported (e.g. "led team of 5" when no team size mentioned)
- Impact claims not in original (e.g. "increased revenue" when original says "supported sales")

REMOVE if change mixes content between companies:
- CRITICAL: For EACH bullet in optimizedResume.sections[Experience].content[i].bullets, verify it came from the SAME company in the original resume
- Example of VIOLATION: If Solarmente's bullets mention "solar energy" or "smart contracts", but Front Row Ventures' bullets now contain those phrases → DELETE those Front Row bullets
- Example of VIOLATION: If original resume shows Front Row Ventures doing "venture capital" work, but optimized resume shows them doing "solar energy" → DELETE those bullets
- YOU MUST cross-reference EVERY bullet with the original resume's company sections before including it
- When in doubt, DELETE the bullet rather than risk mixing content

REMOVE if:
- Change is no-op (original === suggested)
- Change is cosmetic only (e.g. just capitalization)

ALLOWED:
- Qualitative improvements IF impact was in original (e.g. "improved" → "improved significantly")
- Reordering bullets WITHIN the same company (but bullets cannot move between companies)
- Language lifting (tactical → strategic) if ceiling allows

NEVER ALLOWED:
- Moving bullets from one company to another company
- Combining work from multiple companies under one company header
- Any form of cross-company content transfer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4: OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return valid JSON (no markdown, no wrapper):

{
  "optimizedResume": {
    "contactInfo": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "location": "string"
    },
    "sections": [
      {
        "title": "Summary",
        "type": "summary",
        "content": "string"
      },
      {
        "title": "Experience",
        "type": "experience",
        "content": [
          {
            "company": "string (MUST match EXACTLY the company name from original resume)",
            "role": "string",
            "dates": "string",
            "bullets": ["string (MUST come from the SAME company in original resume - NO cross-company content)"]
          }
        ]
      },
      {
        "title": "Skills",
        "type": "skills",
        "content": "string or array"
      }
    ]
  },
  "changes": [
    {
      "id": "temp-N",
      "type": "addition|modification",
      "section": "Summary|Experience|Skills|Education",
      "original": "REQUIRED for modifications: exact original bullet text being replaced. Empty string ONLY for additions.",
      "suggested": "improved text (always valid, uses fallback if needed)",
      "suggested_with_metric": "version with placeholder (only if metric_opportunity exists)",
      "evidence": "short quote from original this is based on, or null",
      "metric_opportunity": {
        "question": "What % did you improve performance by?",
        "placeholder_format": "[X]%",
        "neutral_fallback": "measurably"
      },
      "reason": "Why this change matters strategically",
      "impactScore": 8,
      "position": {
        "sectionIndex": 0,
        "bulletIndex": 0
      }
    }
  ],
  "honesty_validation": {
    "changes_before_validation": 0,
    "changes_after_validation": 0,
    "removed_changes": []
  }
}

CRITICAL:
- optimizedResume MUST have contactInfo AND sections array
- sections array MUST be complete
- Each change MUST have evidence field
- For modifications: "original" field MUST contain the EXACT original bullet text (needed for undo/reject)
- No invented facts
- 6000-8000 token output max (tight diffs, not prose)`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    timings.llmStart = Date.now()
    console.log(`[Fast-Mode] 🤖 Calling Sonnet 4.5...`)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 - best available model
      max_tokens: 8000,
      temperature: 0.3, // Lowered from 0.4 for more deterministic output
      messages: [{ role: 'user', content: prompt }]
    })

    timings.llmEnd = Date.now()
    const llmTime = timings.llmEnd - timings.llmStart
    console.log(`[Fast-Mode] ✅ LLM response received (${llmTime}ms)`)

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log(`[Fast-Mode] 📄 Response length: ${responseText.length} chars`)

    const result = parseClaudeJson(responseText, {
      attemptEscapeFix: true,
      errorPrefix: '[Fast-Mode]'
    })

    timings.parseEnd = Date.now()
    const parseTime = timings.parseEnd - timings.llmEnd
    console.log(`[Fast-Mode] 📝 Parsed JSON (${parseTime}ms)`)

    if (!result.optimizedResume || !result.changes) {
      throw new Error('Invalid fast mode response structure')
    }

    // Validate required structure
    if (!result.optimizedResume.sections || !Array.isArray(result.optimizedResume.sections)) {
      console.error('[Fast-Mode] Missing sections array')
      result.optimizedResume.sections = []
    }

    // CRITICAL FIX: Two-layer contact info validation
    // Layer 1: Rule-based sanitization (fast)
    // Layer 2: AI validation (handles edge cases)
    if (result.optimizedResume.contactInfo) {
      const rawContactInfo = result.optimizedResume.contactInfo
      console.log('[Fast-Mode] 🔍 Raw contactInfo from LLM:', JSON.stringify(rawContactInfo, null, 2))
      
      // Layer 1: Rule-based sanitization
      const ruleSanitized = sanitizeContactInfo(rawContactInfo, originalResume)
      console.log('[Fast-Mode] 📋 Rule-sanitized contactInfo:', JSON.stringify(ruleSanitized, null, 2))
      
      // Layer 2: AI validation (only if rule-based output looks suspicious)
      const needsAIValidation = 
        !ruleSanitized.name || 
        ruleSanitized.name === 'Candidate' ||
        ruleSanitized.name.length < 3 ||
        (rawContactInfo.name && rawContactInfo.name.length > 30 && rawContactInfo.name !== ruleSanitized.name)
      
      if (needsAIValidation) {
        console.log('[Fast-Mode] 🤖 Running AI contact validation (suspicious data detected)...')
        const aiValidated = await validateContactInfoWithAI(rawContactInfo, originalResume, anthropic)
        console.log('[Fast-Mode] 🤖 AI-validated contactInfo:', JSON.stringify(aiValidated, null, 2))
        
        // Merge AI results with rule-based results (AI takes precedence for name)
        result.optimizedResume.contactInfo = {
          name: aiValidated.name || ruleSanitized.name || 'Candidate',
          email: ruleSanitized.email || aiValidated.email,
          phone: ruleSanitized.phone || aiValidated.phone,
          location: aiValidated.location || ruleSanitized.location,
          linkedin: ruleSanitized.linkedin,
          website: ruleSanitized.website
        }
      } else {
        result.optimizedResume.contactInfo = ruleSanitized
      }
      
      console.log('[Fast-Mode] ✅ Final contactInfo:', JSON.stringify(result.optimizedResume.contactInfo, null, 2))
    }

    // ALWAYS regenerate deterministic change IDs (never trust model output)
    result.changes = result.changes.map((change: any) => {
      const deterministicId = generateChangeId(
        change.section,
        change.original || '',
        change.suggested || ''
      )
      return {
        ...change,
        id: deterministicId
      }
    })

    timings.total = Date.now() - startTime

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Fast-Mode] ⚡ COMPLETE - Performance Breakdown:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  🤖 LLM Generation:  ${llmTime}ms (${Math.round(llmTime/timings.total*100)}%)`)
    console.log(`  📝 JSON Parsing:    ${parseTime}ms (${Math.round(parseTime/timings.total*100)}%)`)
    console.log(`  ⚙️  Processing:      ${(timings.total - llmTime - parseTime)}ms`)
    console.log(`  ⏱️  TOTAL TIME:      ${timings.total}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  📊 Changes: ${result.changes.length}`)
    console.log(`  📄 Sections: ${result.optimizedResume.sections.length}`)
    console.log(`  ✅ Validation: ${result.honesty_validation?.changes_after_validation || 'N/A'} changes after honesty pass`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Create minimal analysis object that satisfies ResumeAnalysis type
    // Fast mode doesn't compute fit scores - these are placeholder values
    const analysis = {
      fitScoreBefore: 0,
      fitScoreAfter: 0,
      subscores: {
        before: {
          keywordMatch: 0,
          themeAlignment: 0,
          experienceRelevance: 0,
          skillOverlap: 0
        },
        after: {
          keywordMatch: 0,
          themeAlignment: 0,
          experienceRelevance: 0,
          skillOverlap: 0
        }
      },
      whatWorks: [],
      whatsMissing: [],
      keywordsToTarget: {
        verbs: [],
        concepts: [],
        techStack: []
      },
      rationaleForChanges: 'Fast Mode focuses on quick, high-impact optimizations without deep diagnostic analysis. Use Deep Mode for detailed fit scoring and analysis.'
    }

    return NextResponse.json({
      optimizedResume: result.optimizedResume,
      changes: result.changes,
      analysis,
      metadata: {
        generation_time_ms: timings.total,
        model: 'claude-sonnet-4-5-20250929',
        mode: 'fast',
        job_metadata: {
          title: jobTitle,
          company: companyName
        },
        timings: {
          llm_ms: llmTime,
          parse_ms: parseTime,
          total_ms: timings.total
        }
      }
    })

  } catch (error) {
    console.error('[Fast-Mode] Error:', error)
    return NextResponse.json(
      {
        error: 'Fast optimization failed',
        details: error instanceof Error ? error.message : 'Unknown'
      },
      { status: 500 }
    )
  }
}
