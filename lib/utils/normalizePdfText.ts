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
