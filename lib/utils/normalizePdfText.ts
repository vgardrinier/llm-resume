/**
 * Normalizes PDF extracted text by cleaning whitespace and limiting length
 * @param text - Raw text extracted from PDF
 * @param maxChars - Maximum character limit (default: 10000)
 * @returns Normalized text string
 */
export function normalizePdfText(text: string, maxChars: number = 10000): string {
  if (!text) return ''
  
  // Trim leading and trailing whitespace
  let normalized = text.trim()
  
  // FIX: pdf2json often adds spaces inside numbers/dates (e.g., "2 013" instead of "2013")
  // Fix common date patterns with extra spaces: "2 013" -> "2013", "MAY 201 9" -> "MAY 2019"
  // This regex finds years split with spaces: 1xxx, 2xxx patterns
  normalized = normalized.replace(/\b(1|2)\s+(\d)\s*(\d)\s*(\d)\b/g, '$1$2$3$4')
  
  // Fix month + year patterns like "MAY 201 9" or "JANUARY 2 019"
  normalized = normalized.replace(/\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+((?:\d\s*)+)/gi, 
    (match, month, year) => {
      const fixedYear = year.replace(/\s+/g, '')
      return `${month} ${fixedYear}`
    }
  )
  
  // Fix date ranges like "2013 - 2 017" -> "2013 - 2017" or "2013 – 2 017" (en-dash)
  normalized = normalized.replace(/(\d{4})\s*[-–]\s*((?:\d\s*)+)/g, 
    (match, start, end) => {
      const fixedEnd = end.replace(/\s+/g, '')
      return `${start} - ${fixedEnd}`
    }
  )
  
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ')
  
  // Replace 3 or more consecutive newlines with exactly 2 newlines
  normalized = normalized.replace(/\n{3,}/g, '\n\n')
  
  // Truncate if exceeds maxChars
  if (normalized.length > maxChars) {
    normalized = normalized.substring(0, maxChars) + '...[truncated]'
  }
  
  return normalized
}
