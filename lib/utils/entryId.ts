import crypto from 'crypto'

/**
 * Generate a stable, deterministic ID for a resume entry
 * Based on company, role, dates, and first bullet
 */
export function generateEntryId(entry: {
  company?: string
  role?: string
  title?: string
  dates?: string
  bullets?: string[]
}): string {
  const parts = [
    entry.company || entry.title || '',
    entry.role || '',
    entry.dates || '',
    entry.bullets?.[0] || ''
  ]

  const normalized = parts
    .map(p => p.trim().toLowerCase())
    .join('|')

  const hash = crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex')
    .substring(0, 12)

  return `entry_${hash}`
}

/**
 * Extract distinctive tokens from entry for validation
 * Returns domain-specific terms, numbers, proper nouns
 */
export function extractEntryFingerprint(entry: {
  company?: string
  role?: string
  bullets?: string[]
}): Set<string> {
  const text = [
    entry.company || '',
    entry.role || '',
    ...(entry.bullets || [])
  ].join(' ')

  // Simple stopwords (can be expanded)
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can'
  ])

  // Extract tokens
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter(token =>
      token.length > 2 &&
      !stopwords.has(token)
    )

  // Extract numbers (important for fact checking)
  const numbers = text.match(/\d+[\d,.]*/g) || []

  return new Set([...tokens, ...numbers])
}

/**
 * Extract all numbers from text for fact checking
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+[\d,.%kKmMbB]*/g) || []
  return matches.map(m => m.toLowerCase())
}

/**
 * Calculate overlap between two token sets
 */
export function calculateOverlap(setA: Set<string>, setB: Set<string>): number {
  const arrayA = Array.from(setA)
  const arrayB = Array.from(setB)

  const intersection = new Set(arrayA.filter(x => setB.has(x)))
  const union = new Set([...arrayA, ...arrayB])

  if (union.size === 0) return 0

  return intersection.size / union.size
}
