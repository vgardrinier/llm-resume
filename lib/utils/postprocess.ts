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
  
  const numericPattern = /\$[\d,]+|\d+%|\d+[KMB]|\d+\+|\d+\.\d+[KMB]?|\d+[,\d]*/g
  const originalNumbers = (originalResume.match(numericPattern) || []) as string[]
  const generatedNumbers = (generatedResume.match(numericPattern) || []) as string[]
  
  // Contexts where numbers should NOT be patched (legitimate usage)
  const excludePatterns = [
    /years?\s+of\s+experience/i,
    /\d+\s+people/i,
    /\d+\s+team/i,
    /\d+\s+member/i,
    /team\s+of\s+\d+/i,
    /\d+\s+person/i
  ]
  
  generatedNumbers.forEach((num: string) => {
    if (!originalNumbers.includes(num)) {
      // Check if number is in an excluded context
      const numIndex = generatedResume.indexOf(num)
      if (numIndex !== -1) {
        // Get surrounding context (50 chars before and after)
        const contextStart = Math.max(0, numIndex - 50)
        const contextEnd = Math.min(generatedResume.length, numIndex + num.length + 50)
        const context = generatedResume.substring(contextStart, contextEnd).toLowerCase()
        
        // Skip if in excluded context
        const shouldExclude = excludePatterns.some(pattern => pattern.test(context))
        if (shouldExclude) {
          return // Skip this number
        }
      }
      
      // Replace with appropriate qualifier
      let qualifier = 'significant'
      if (num.includes('$')) qualifier = 'substantial'
      else if (num.includes('%')) qualifier = 'notable'
      else if (num.includes('K') || num.includes('M') || num.includes('B')) qualifier = 'strong'
      else if (num.includes('+')) qualifier = 'notable'
      else if (num.match(/^\d+$/)) qualifier = 'multiple'
      
      patchedResume = patchedResume.replace(num, qualifier)
    }
  })
  
  return patchedResume
}

