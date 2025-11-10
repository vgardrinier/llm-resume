/**
 * Post-processing utilities for generated resumes
 * Handles hallucination detection and patching
 */

/**
 * Auto-patch validator: Replace hallucinated numbers with neutral qualifiers
 * Excludes legitimate contexts like "5 years of experience" or "team of 10 people"
 * 
 * @param generatedResume - The generated resume text
 * @param originalResume - The original resume text (source of truth)
 * @returns Patched resume with hallucinated numbers replaced
 */
export function autoPatchHallucinations(
  generatedResume: string,
  originalResume: string
): string {
  let patchedResume = generatedResume
  
  // More specific pattern: only match numbers that look like metrics/quantities
  // Excludes years (4-digit years), phone numbers, dates, etc.
  // Matches: currency ($1,000), percentages (50%), K/M/B suffixes (10K), 
  // plus suffixes (100+), decimals (1.5M), and comma-separated numbers (1,000+)
  // Note: Removed broad \d+[,\d]* pattern to avoid matching years, phone numbers, etc.
  const numericPattern = /\$[\d,]+|\d+%|\d+[KMB]|\d+\+|\d+\.\d+[KMB]?|\d{1,3}(?:,\d{3})+/g
  const originalNumbers = (originalResume.match(numericPattern) || []) as string[]
  const generatedNumbers = (generatedResume.match(numericPattern) || []) as string[]
  
  // Contexts where numbers should NOT be patched (legitimate usage)
  const excludePatterns = [
    /years?\s+of\s+experience/i,
    /\d+\s+people/i,
    /\d+\s+team/i,
    /\d+\s+member/i,
    /team\s+of\s+\d+/i,
    /\d+\s+person/i,
    // Exclude years (4-digit years like 2023, 2024)
    /\b(19|20)\d{2}\b/i,
    // Exclude dates (MM/DD/YYYY, YYYY-MM-DD, etc.)
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i,
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/i,
    // Exclude phone numbers (various formats)
    /\d{3}[\s\-\.]?\d{3}[\s\-\.]?\d{4}/,
    /\(\d{3}\)\s?\d{3}[\s\-]?\d{4}/,
    // Exclude version numbers (v1.0, version 2.0, etc.)
    /version\s+\d+\.?\d*/i,
    /v\d+\.?\d*/i
  ]
  
  generatedNumbers.forEach((num: string) => {
    if (!originalNumbers.includes(num)) {
      // Find ALL occurrences of this number (not just the first)
      const occurrences: number[] = []
      let searchIndex = 0
      while (true) {
        const numIndex = patchedResume.indexOf(num, searchIndex)
        if (numIndex === -1) break
        occurrences.push(numIndex)
        searchIndex = numIndex + 1
      }
      
      // Determine qualifier once (same for all occurrences of this number)
      let qualifier = 'significant'
      if (num.includes('$')) qualifier = 'substantial'
      else if (num.includes('%')) qualifier = 'notable'
      else if (num.includes('K') || num.includes('M') || num.includes('B')) qualifier = 'strong'
      else if (num.includes('+')) qualifier = 'notable'
      else if (num.match(/^\d+$/)) qualifier = 'multiple'
      
      // Process each occurrence individually (check context and replace if needed)
      // Process in reverse order to maintain indices as we replace
      for (let i = occurrences.length - 1; i >= 0; i--) {
        const numIndex = occurrences[i]
        
        // Get surrounding context (50 chars before and after)
        const contextStart = Math.max(0, numIndex - 50)
        const contextEnd = Math.min(patchedResume.length, numIndex + num.length + 50)
        const context = patchedResume.substring(contextStart, contextEnd).toLowerCase()
        
        // Skip if in excluded context
        const shouldExclude = excludePatterns.some(pattern => pattern.test(context))
        if (!shouldExclude) {
          // Replace this occurrence (working backwards preserves indices)
          patchedResume = patchedResume.substring(0, numIndex) + qualifier + patchedResume.substring(numIndex + num.length)
        }
      }
    }
  })
  
  return patchedResume
}

