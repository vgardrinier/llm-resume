// Salary MCP Integration
// Provides salary context for resume generation and paywall messaging

interface SalaryData {
  low: number
  median: number
  high: number
  source: string
  role: string
  location: string
}

interface SalaryLookupRequest {
  role: string
  location: string
  company?: string
}

// Extract job title and location using AI-powered extraction
export async function extractJobTitleAndLocation(jobDescription: string): Promise<{ role: string; location: string }> {
  try {
    // Use Anthropic API to extract job title and location intelligently
    const anthropic = new (await import('@anthropic-ai/sdk')).default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: `Extract the job title and location from this job description. Return ONLY a JSON object with "role" and "location" fields.

Job Description: "${jobDescription}"

Examples:
- "Senior Software Engineer at Google in Mountain View, CA" → {"role": "Senior Software Engineer", "location": "Mountain View, CA"}
- "Product Manager, ChatGPT Growth at OpenAI in San Francisco" → {"role": "Product Manager", "location": "San Francisco"}
- "Project Manager Real Estate Developments, March 2018 in Düsseldorf, Germany" → {"role": "Project Manager", "location": "Düsseldorf, Germany"}

Return only the JSON, no other text.`
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const extracted = JSON.parse(content.text.trim())
      console.log(`AI Extracted: "${extracted.role}" in "${extracted.location}" from job description`)
      return extracted
    }
  } catch (error) {
    console.error('AI extraction failed, falling back to pattern matching:', error)
  }

  // Fallback to simple pattern matching if AI fails
  const text = jobDescription.toLowerCase()
  
  // Simple role extraction
  let detectedRole = 'Software Engineer'
  if (text.includes('product manager') || text.includes('pm ')) {
    detectedRole = 'Product Manager'
  } else if (text.includes('project manager')) {
    detectedRole = 'Project Manager'
  } else if (text.includes('senior')) {
    detectedRole = 'Senior ' + detectedRole
  }
  
  // Simple location extraction
  let detectedLocation = 'San Francisco'
  if (text.includes('düsseldorf') || text.includes('dusseldorf')) {
    detectedLocation = 'Düsseldorf, Germany'
  } else if (text.includes('berlin')) {
    detectedLocation = 'Berlin, Germany'
  } else if (text.includes('london')) {
    detectedLocation = 'London, UK'
  } else if (text.includes('mountain view')) {
    detectedLocation = 'Mountain View, CA'
  } else if (text.includes('new york') || text.includes('nyc')) {
    detectedLocation = 'New York, NY'
  }
  
  console.log(`Fallback extracted: "${detectedRole}" in "${detectedLocation}" from job description`)
  return { role: detectedRole, location: detectedLocation }
}

// Search for salary data using web search
async function searchSalaryData(role: string, location: string): Promise<SalaryData | null> {
  try {
    console.log(`Searching for salary data: ${role} in ${location}`)
    
    // Use Anthropic API to search for salary information
    const anthropic = new (await import('@anthropic-ai/sdk')).default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: `Based on your knowledge of current salary data, provide realistic salary ranges for this role and location. Return ONLY a JSON object with "low", "median", "high" fields (numbers only, no currency symbols).

Role: "${role}"
Location: "${location}"

Consider:
- Cost of living in the location
- Market rates for this role type
- Seniority level if mentioned
- Industry standards

Examples:
- "Software Engineer" in "San Francisco" → {"low": 120000, "median": 150000, "high": 180000}
- "Product Manager" in "Berlin, Germany" → {"low": 60000, "median": 80000, "high": 100000}
- "Project Manager" in "Düsseldorf, Germany" → {"low": 50000, "median": 65000, "high": 80000}

Return only the JSON, no other text.`
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const salaryData = JSON.parse(content.text.trim())
      
      return {
        low: salaryData.low,
        median: salaryData.median,
        high: salaryData.high,
        source: 'AI Market Analysis',
        role,
        location
      }
    }
  } catch (error) {
    console.error('Salary search failed:', error)
  }
  
  return null
}

// Parse different salary API response formats
function parseSalaryResponse(data: any, role: string, location: string): SalaryData | null {
  // Glassdoor format
  if (data.response && data.response.salaries) {
    const salaries = data.response.salaries
    if (salaries.length > 0) {
      const salary = salaries[0]
      return {
        low: salary.salaryLow || salary.salaryMin,
        median: salary.salaryMedian || salary.salaryMean,
        high: salary.salaryHigh || salary.salaryMax,
        source: 'Glassdoor',
        role,
        location
      }
    }
  }

  // Levels.fyi format
  if (data.data && Array.isArray(data.data)) {
    const levels = data.data.filter((item: any) => 
      item.title?.toLowerCase().includes(role.toLowerCase()) ||
      role.toLowerCase().includes(item.title?.toLowerCase())
    )
    
    if (levels.length > 0) {
      const level = levels[0]
      return {
        low: level.min || level.low,
        median: level.median || level.mid,
        high: level.max || level.high,
        source: 'Levels.fyi',
        role,
        location
      }
    }
  }

  return null
}

// Fallback salary estimation (only used if AI search fails)
function generateFallbackEstimate(role: string, location: string): SalaryData {
  // Very basic fallback - just return reasonable defaults
  const baseSalary = 100000 // Base salary
  
  // Simple location adjustment
  let multiplier = 1.0
  const locationLower = location.toLowerCase()
  
  if (locationLower.includes('san francisco') || locationLower.includes('mountain view')) {
    multiplier = 1.3
  } else if (locationLower.includes('new york') || locationLower.includes('manhattan')) {
    multiplier = 1.2
  } else if (locationLower.includes('seattle') || locationLower.includes('boston')) {
    multiplier = 1.1
  } else if (locationLower.includes('düsseldorf') || locationLower.includes('berlin')) {
    multiplier = 0.7 // European market
  } else if (locationLower.includes('london')) {
    multiplier = 0.9
  }
  
  return {
    low: Math.round(baseSalary * multiplier * 0.8),
    median: Math.round(baseSalary * multiplier),
    high: Math.round(baseSalary * multiplier * 1.2),
    source: 'Fallback Estimate',
    role,
    location
  }
}

export async function lookupSalary(request: SalaryLookupRequest): Promise<SalaryData | null> {
  try {
    // Use AI to search for current salary data
    const salaryData = await searchSalaryData(request.role, request.location)
    if (salaryData) {
      return salaryData
    }

    // If AI search fails, use fallback estimate
    return generateFallbackEstimate(request.role, request.location)
  } catch (error) {
    console.error('Salary lookup error:', error)
    // Fallback to basic estimate
    return generateFallbackEstimate(request.role, request.location)
  }
}

// Legacy function for backward compatibility
export function extractRoleAndLocation(jobDescription: string): { role: string; location: string } {
  const text = jobDescription.toLowerCase()
  
  // Simple pattern matching as fallback
  const rolePatterns = [
    'product manager', 'pm', 'product marketing manager',
    'software engineer', 'swe', 'sde', 'senior software engineer',
    'data scientist', 'data engineer', 'machine learning engineer',
    'product designer', 'ux designer', 'ui designer',
    'engineering manager', 'devops engineer',
    'technical writer', 'sales engineer'
  ]
  
  const locationPatterns = [
    'san francisco', 'sf', 'bay area',
    'new york', 'nyc', 'manhattan',
    'seattle', 'austin', 'boston', 'chicago',
    'los angeles', 'la', 'denver', 'portland',
    'remote', 'hybrid', 'distributed'
  ]
  
  let detectedRole = 'Software Engineer'
  let detectedLocation = 'San Francisco'
  
  for (const pattern of rolePatterns) {
    if (text.includes(pattern)) {
      detectedRole = pattern
      break
    }
  }
  
  for (const pattern of locationPatterns) {
    if (text.includes(pattern)) {
      detectedLocation = pattern
      break
    }
  }
  
  return { role: detectedRole, location: detectedLocation }
}

// Generate salary-aware messaging for paywall with humor and cheekiness
export function generateSalaryAwareMessage(salary: SalaryData): string {
  const { median, role, location } = salary
  
  const messages = [
    `✨ New opportunity detected!\nThis ${role} role averages **$${median.toLocaleString()}/year** in ${location}.\n$9 to tailor your résumé for it? Seems like good ROI 😎`,
    `👀 A $${median.toLocaleString()} job spotted.\nFor the cost of one overpriced coffee, make sure your résumé looks like it belongs there. ☕`,
    `💰 This ${role} position pays around **$${median.toLocaleString()}** annually.\n$9 to optimize your résumé? That's 0.005% of the salary. Smart investment! 📈`,
    `🎯 Targeting a $${median.toLocaleString()}/year ${role} role?\nYour résumé needs to match that level. $9 gets you there. 🚀`,
    `💡 Pro tip: This ${role} role averages $${median.toLocaleString()}/year.\nFor less than 0.01% of the salary, optimize your résumé. Math checks out! ✅`,
    `🔥 Hot take: This ${role} gig pays $${median.toLocaleString()}/year.\nYour current résumé probably says "hard worker" and "team player." Let's fix that for $9. 😏`,
    `💸 Reality check: This ${role} role = $${median.toLocaleString()}/year.\nYour résumé = probably generic AF.\n$9 = résumé that actually gets you interviews. 🎭`,
    `🚨 PSA: This ${role} position pays $${median.toLocaleString()} annually.\nThat's $${Math.round(median/12).toLocaleString()}/month. Your résumé should reflect that level of excellence. $9 well spent. 💎`,
    `📊 Fun fact: This ${role} role pays $${median.toLocaleString()}/year.\nThat's roughly $${Math.round(median/2000).toLocaleString()}/hour (assuming 2000 work hours/year).\nYour résumé should scream "I'm worth every penny." $9 investment. 💪`,
    `🎪 Plot twist: This ${role} gig averages $${median.toLocaleString()}/year.\nYour résumé probably has "Microsoft Office" listed as a skill.\nLet's upgrade that to "Strategic Leadership" for $9. 🎭`
  ]
  
  return messages[Math.floor(Math.random() * messages.length)]
}

// Generate cheeky salary commentary for the chat area
export function generateCheekySalaryCommentary(salary: SalaryData): string {
  const { median, low, high, role, location, source } = salary
  
  const commentaries = [
    `🎭 The Tea: This ${role} role in ${location} pays $${median.toLocaleString()}/year (range: $${low.toLocaleString()} - $${high.toLocaleString()}). Your résumé probably says "detail-oriented" and "passionate about technology." We can do better. 😏`,
    
    `💸 Reality Check: $${median.toLocaleString()}/year for this ${role} position. That's $${Math.round(median/12).toLocaleString()}/month. Your résumé should reflect that level of compensation. Currently it probably says "hard worker" and "quick learner." 🎯`,
    
    `🔥 Hot Take: This ${role} gig averages $${median.toLocaleString()} annually. Your résumé likely has "Microsoft Office" and "team player" listed. Let's upgrade that to "strategic thinker" and "results-driven leader" for $9. 💪`,
    
    `📊 The Math: $${median.toLocaleString()}/year = $${Math.round(median/2000).toLocaleString()}/hour. Your résumé should scream "I'm worth every penny." Currently it probably whispers "I can use Excel." Let's fix that. 🎪`,
    
    `💎 Plot Twist: This ${role} role pays $${median.toLocaleString()}/year. Your résumé probably mentions "attention to detail" and "strong communication skills." We can make it say "drove 300% growth" and "led cross-functional teams" instead. 🚀`,
    
    `🎪 The Truth: $${median.toLocaleString()}/year for this ${role} position. Your résumé likely has "problem solver" and "self-motivated." Let's change that to "revenue generator" and "market disruptor" for the cost of a fancy coffee. ☕`,
    
    `🎭 Behind the Scenes: This ${role} gig averages $${median.toLocaleString()} annually. Your résumé probably says "collaborative" and "adaptable." We can make it say "innovative" and "transformative" instead. Same person, better words. $9 well spent. 💡`,
    
    `🔥 Spoiler Alert: $${median.toLocaleString()}/year for this ${role} role. Your résumé likely mentions "organized" and "reliable." Let's upgrade that to "strategic" and "visionary" for less than 0.01% of the salary. Math checks out. ✅`
  ]
  
  return commentaries[Math.floor(Math.random() * commentaries.length)]
}

// Generate salary context for resume generation
export function generateSalaryContext(salary: SalaryData): string {
  const { low, median, high, role, location } = salary
  
  return `SALARY CONTEXT: This ${role} role in ${location} typically pays $${low.toLocaleString()} - $${high.toLocaleString()} annually (median: $${median.toLocaleString()}). This is a high-value position worth optimizing for.`
}
