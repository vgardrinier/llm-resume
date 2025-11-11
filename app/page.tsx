'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Link2 } from 'lucide-react'
import { ParseResumeResponse, GenerateInsightsResponse } from '@/types/api'
import { ChatNarrator } from '@/app/components/ChatNarrator'
import { UploadingNarrative } from '@/app/components/UploadingNarrative'
import { InsightCard } from '@/app/components/InsightCard'
import { ResumeModal } from '@/app/components/ResumeModal'
import { HeroTitle } from '@/app/components/HeroTitle'
import { Navbar } from '@/app/components/Navbar'
import { Button } from '@/app/components/Button'
import { AnimatePresence, motion } from 'framer-motion'

export default function Home() {
  const [jobDescription, setJobDescription] = useState('')
  const [currentResume, setCurrentResume] = useState('')
  const [creativeMode, setCreativeMode] = useState<'conservative' | 'balanced' | 'assertive'>('balanced')
  const [result, setResult] = useState<GenerateInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [showResume, setShowResume] = useState(false)
  const [phase, setPhase] = useState<'input' | 'output'>('input')
  // PDF upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Job URL state
  const [jobUrl, setJobUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlFetchSuccess, setUrlFetchSuccess] = useState(false)
  const [manualJobTitle, setManualJobTitle] = useState('')
  const [isJobPlatform, setIsJobPlatform] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  // Known job platforms that require vision extraction (slower)
  const JOB_PLATFORMS = [
    'linkedin.com',
    'indeed.com',
    'glassdoor.com',
    'monster.com',
    'careerbuilder.com',
    'ziprecruiter.com',
    'simplyhired.com',
  ]

  const checkIfJobPlatform = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return JOB_PLATFORMS.some(platform => hostname.includes(platform))
    } catch {
      return false
    }
  }

  // Update job platform detection when URL changes
  useEffect(() => {
    if (jobUrl.trim()) {
      setIsJobPlatform(checkIfJobPlatform(jobUrl))
    } else {
      setIsJobPlatform(false)
    }
    // Reset URL fetch state when URL changes to prevent stale success/error messages
    setUrlFetchSuccess(false)
    setUrlError(null)
    setManualJobTitle('') // Clear manual entry when URL changes
  }, [jobUrl])

  const generateResume = async () => {
    setPhase('output')
    setLoading(true)
    setShowResume(false) // Reset resume visibility
    try {
      // Debug: Log inputs before API call
      console.log('[Frontend] Starting resume generation', {
        step: 'start',
        hasJob: !!jobDescription,
        hasResume: !!currentResume,
        jobLength: jobDescription?.length || 0,
        resumeLength: currentResume?.length || 0,
        creativeMode,
      })

      const response = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_description: jobDescription,
          candidate_resume: currentResume,
          creative_mode: creativeMode,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Frontend] API error response', {
          step: 'api_error',
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        })
        throw new Error('Failed to generate resume')
      }

      const data: GenerateInsightsResponse = await response.json()
      
      // Debug: Log API response
      console.log('[Frontend] API response received', {
        step: 'api_response',
        hasInsights: !!data.insights,
        hasFitScore: !!data.insights?.fit,
        fitScoreBefore: data.insights?.fit?.score_before,
        fitScoreAfter: data.insights?.fit?.score_after,
        hasOptimizedResume: !!data.optimized_resume,
        optimizedResumeLength: data.optimized_resume?.length || 0,
      })
      
      setResult(data)
    } catch (error) {
      console.error('Error generating resume:', error)
      alert('Failed to generate resume. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const startOver = () => {
    setPhase('input')
    setLoading(false)
    setShowResume(false)
    setResult(null)
    setCompanyName(null)
    setJobDescription('')
    setJobUrl('')
    setUrlError(null)
    setUrlLoading(false)
    setUrlFetchSuccess(false)
    setManualJobTitle('')
    setUploadedFile(null)
    setCurrentResume('')
    setParseError(null)
    setParseLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    try {
      const { pathname, search } = window.location
      window.history.replaceState(null, '', pathname + search)
    } catch {}
  }

  // Listen for resume reveal event from ChatNarrator
  useEffect(() => {
    const handleRevealResume = () => {
      setShowResume(true)
    }
    window.addEventListener('reveal-resume', handleRevealResume)
    return () => window.removeEventListener('reveal-resume', handleRevealResume)
  }, [])

  const downloadMarkdown = () => {
    if (!result) return

    const blob = new Blob([result.optimized_resume], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tailored_resume.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // PDF upload functions
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Clear previous errors
    setParseError(null)

    // Client-side validation
    if (file.size > 1024 * 1024) { // 1MB
      setParseError('File too large. Please use a PDF under 1MB.')
      return
    }

    if (file.type !== 'application/pdf') {
      setParseError('Invalid file type. Please upload a PDF file.')
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Invalid file type. Please upload a PDF file.')
      return
    }

    setUploadedFile(file)
    setParseLoading(true)

    try {
      // Send file to parse API
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to parse PDF')
      }

      const data: ParseResumeResponse = await response.json()
      
      // Auto-fill the textarea with extracted text
      setCurrentResume(data.text)
      
    } catch (error) {
      console.error('PDF parsing error:', error)
      setParseError(error instanceof Error ? error.message : 'Failed to extract text from PDF. Please try another PDF file.')
    } finally {
      setParseLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setCurrentResume('')
    setParseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
    return Math.round(bytes / (1024 * 1024)) + ' MB'
  }

  // Job URL fetching
  const handleFetchJobFromUrl = async () => {
    if (!jobUrl.trim()) {
      setUrlError('Please enter a valid URL')
      return
    }

    setUrlError(null)
    setUrlLoading(true)
    setUrlFetchSuccess(false)
    setManualJobTitle('') // Clear manual entry when starting a new URL fetch

    try {
      const response = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: jobUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch job description')
      }

      const data = await response.json()

      // Store extracted job description and company
      if (data.companyName) setCompanyName(data.companyName)
      
      // If jobTitle and location were extracted, prepend them to job description for better extraction downstream
      // Set job description once with the final value (either with or without prepended metadata)
      let finalJobDescription = data.jobDescription
      if (data.jobTitle || data.location) {
        const prefixParts: string[] = []
        if (data.jobTitle) prefixParts.push(`Job Title: ${data.jobTitle}`)
        if (data.location) prefixParts.push(`Location: ${data.location}`)
        if (prefixParts.length > 0) {
          finalJobDescription = `${prefixParts.join('\n')}\n\n${data.jobDescription}`
        }
      }
      setJobDescription(finalJobDescription)
      
      setUrlFetchSuccess(true)
      setManualJobTitle('') // Clear manual entry on successful URL fetch

      // Store company info if needed (for display later)
      if (data.companyName) {
        console.log('Company detected:', data.companyName)
      }

    } catch (error) {
      console.error('URL fetching error:', error)
      const message = error instanceof Error ? error.message : ''
      const friendly = message.includes('not contain a job posting')
        ? "That page doesn't look like a job posting. Try another link."
        : message.includes('Failed to fetch content from URL')
        ? "Couldn't load that page. Some sites block scraping—try a different link."
        : "Couldn't extract the job details from that link. Please try another URL."
      setUrlError(friendly)
    } finally {
      setUrlLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
      <Navbar jobUrl={jobUrl} uploadedFileName={uploadedFile?.name} />

      {/* Main content - centered vertically and horizontally */}
      {/* Gradient background transition for main content */}
      <motion.div
        className="flex-1 w-full flex flex-col justify-center items-center overflow-y-auto"
        initial={false}
        animate={
          phase === 'input'
            ? { background: 'white', opacity: 1 }
            : {
                background:
                  'linear-gradient(to bottom, rgba(245,176,65,0.10), rgba(166,134,234,0.10) 50%, rgba(62,123,250,0.10) 100%)',
                opacity: 1,
              }
        }
        transition={{
          background: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
          opacity: { duration: 0.4 },
        }}
        style={{
          minHeight: '100vh',
          width: '100%',
        }}
      >
        <div className="w-full max-w-3xl flex flex-col items-center">
          {/* Hero Title with AnimatePresence for smooth fade-out */}
          <AnimatePresence>
            {phase === 'input' && (
              <motion.div
                key="hero-title"
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="mb-5 lg:mb-6 w-full flex justify-center"
              >
                <HeroTitle isInputFocused={isInputFocused} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main content area */}
          <div className="w-full flex flex-col justify-start">
            <AnimatePresence mode="wait">
              {phase === 'input' ? (
                <motion.div
                  key="input-phase"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  className="w-full"
                >
                  {/* Floating capsule */}
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-6 py-5 lg:px-8 lg:py-6 space-y-3">
                    {/* Row 1: Job URL and Resume Upload - Horizontal on desktop, stacked on mobile */}
                    <div className="flex flex-col lg:flex-row gap-3">
                      {/* Job URL Input */}
                      <div className="flex-1">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={jobUrl}
                            onChange={(e) => setJobUrl(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            placeholder="Paste job link here"
                            className="flex-1 h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-gray-300 bg-white/80 placeholder:text-gray-400 text-sm"
                            disabled={urlLoading}
                          />
                          {jobUrl.trim() && !urlLoading ? (
                            <motion.div
                              className="inline-block flex-shrink-0"
                              style={{
                                background: 'var(--gradient-brand)',
                                padding: '2px',
                                borderRadius: '12px',
                              }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <button
                                type="button"
                                onClick={handleFetchJobFromUrl}
                                disabled={urlLoading}
                                className="h-12 w-12 rounded-xl bg-white text-gray-900 flex items-center justify-center transition-all"
                                title="Fetch job description"
                              >
                                {urlLoading ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                                ) : (
                                  <Link2 className="h-4 w-4" />
                                )}
                              </button>
                            </motion.div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleFetchJobFromUrl}
                              disabled={urlLoading || !jobUrl.trim()}
                              className="h-12 w-12 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 flex items-center justify-center transition-all flex-shrink-0"
                              title="Fetch job description"
                            >
                              {urlLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                              ) : (
                                <Link2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Resume Upload */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleUploadClick}
                          disabled={parseLoading}
                          className="h-12 w-12 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 border border-gray-200 flex items-center justify-center transition-all flex-shrink-0"
                          title="Upload Resume (PDF)"
                        >
                          {parseLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600"></div>
                          ) : (
                            <Upload className="h-5 w-5" />
                          )}
                        </button>
                        
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        
                        {/* File status display */}
                        <div className="flex-1 min-w-0 flex items-center">
                          {uploadedFile && currentResume && !parseLoading ? (
                            <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200 truncate w-full">
                              ✓ {uploadedFile.name}
                            </div>
                          ) : parseError ? (
                            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200 truncate w-full">
                              {parseError}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Upload résumé (PDF)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Helper text and status messages */}
                    <div className="space-y-2 -mt-1">
                      {!urlError && !urlFetchSuccess && (
                        <p className="text-xs text-gray-400">
                          LinkedIn, Indeed, Glassdoor, or any company career page
                        </p>
                      )}

                      {/* Job platform delay warning */}
                      {isJobPlatform && !urlLoading && !urlFetchSuccess && !urlError && (
                        <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          ⏱️ LinkedIn/Indeed require advanced extraction. This may take 10-15 seconds.
                        </div>
                      )}

                      {/* Success message */}
                      {urlFetchSuccess && !urlLoading && (
                        <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                          ✓ Job description extracted successfully ({jobDescription.length} characters)
                        </div>
                      )}

                      {/* Error message with manual fallback */}
                      {urlError && (
                        <div className="space-y-3">
                          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                            {urlError}
                          </div>

                          {/* Manual job description fallback */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-900 mb-2">
                              Paste the full job description manually (including responsibilities, qualifications, and requirements) — I'll optimize your résumé intelligently.
                            </p>
                            <textarea
                              value={manualJobTitle}
                              onChange={(e) => {
                                setManualJobTitle(e.target.value)
                                setJobDescription(e.target.value)
                              }}
                              onFocus={() => setIsInputFocused(true)}
                              onBlur={() => setIsInputFocused(false)}
                              placeholder="Paste the complete job description here..."
                              rows={6}
                              className="w-full p-3 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA Button - Centered, elegant design */}
                    <div className="flex justify-center pt-2">
                      <Button
                        onClick={generateResume}
                        disabled={!jobDescription || !currentResume || loading}
                        variant={jobDescription && currentResume && !loading ? 'gradient' : 'primary'}
                        loading={loading}
                        loadingText="Analyzing..."
                        className="text-base px-8 py-4"
                      >
                        Analyze My Résumé
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="output-phase"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  className="w-full flex justify-center"
                >
                  <div className="w-full max-w-3xl px-0 sm:px-4 py-6 sm:py-8 mx-auto my-8">
                    {/* Loading state */}
                    {loading && !result && (
                      <UploadingNarrative jobDescription={jobDescription} companyNameHint={companyName ?? undefined} />
                    )}

                    {/* Results */}
                    {result && (
                      <div className="space-y-6">
                        <ChatNarrator insights={result.insights} />

                        {/* Start Over button */}
                        <div className="pt-6 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={startOver}
                            className="w-full text-center text-gray-600 hover:text-gray-800 underline text-sm transition-colors"
                          >
                            Start over
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Resume Modal */}
      {result && result.optimized_resume && (
        <ResumeModal
          isOpen={showResume}
          onClose={() => setShowResume(false)}
          optimized={result.optimized_resume}
        />
      )}
    </div>
  )
}
