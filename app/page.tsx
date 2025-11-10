'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText, Sparkles, Upload, Link2 } from 'lucide-react'
import { ParseResumeResponse, GenerateInsightsResponse } from '@/types/api'
import { ChatNarrator } from '@/app/components/ChatNarrator'
import { UploadingNarrative } from '@/app/components/UploadingNarrative'
import { InsightCard } from '@/app/components/InsightCard'
import { ResumePreview } from '@/app/components/ResumePreview'
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
        throw new Error('Failed to generate resume')
      }

      const data: GenerateInsightsResponse = await response.json()
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

  const getDisplayHost = (url: string) => {
    try {
      const u = new URL(url)
      return u.hostname.replace('www.', '')
    } catch {
      return url.length > 32 ? url.slice(0, 29) + '…' : url
    }
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
      setJobDescription(data.jobDescription)
      if (data.companyName) setCompanyName(data.companyName)
      
      // If jobTitle and location were extracted, prepend them to job description for better extraction downstream
      if (data.jobTitle || data.location) {
        const prefixParts: string[] = []
        if (data.jobTitle) prefixParts.push(`Job Title: ${data.jobTitle}`)
        if (data.location) prefixParts.push(`Location: ${data.location}`)
        if (prefixParts.length > 0) {
          setJobDescription(`${prefixParts.join('\n')}\n\n${data.jobDescription}`)
        }
      }
      
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
        ? "That page doesn’t look like a job posting. Try another link."
        : message.includes('Failed to fetch content from URL')
        ? "Couldn’t load that page. Some sites block scraping—try a different link."
        : "Couldn’t extract the job details from that link. Please try another URL."
      setUrlError(friendly)
    } finally {
      setUrlLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(236,72,153,0.08),transparent_50%)] bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/40">
        <div className="container mx-auto px-4 lg:px-8 py-2 flex items-center gap-3 text-xs text-gray-700">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <div className="flex-1 truncate">
            {jobUrl ? (
              <span className="truncate">{getDisplayHost(jobUrl)}</span>
            ) : (
              <span className="text-gray-400">Job URL</span>
            )}
            <span className="mx-2 text-gray-300">•</span>
            {uploadedFile ? (
              <span className="truncate">{uploadedFile.name}</span>
            ) : (
              <span className="text-gray-400">Resume PDF</span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-6 lg:py-10">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <div className="flex items-center justify-center mb-3">
            <Sparkles className="h-7 w-7 lg:h-8 lg:w-8 text-indigo-600 mr-2" />
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">LLM Resume Generator</h1>
          </div>
          <p className="text-sm lg:text-base text-gray-600 max-w-2xl mx-auto">
            Generate tailored, ATS-optimized resumes for technical and product roles in seconds
          </p>
        </div>

        {/* Desktop split view */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Input Form */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-5">Input Information</h2>

            <div className="space-y-6">
              {/* Job Description (URL only) */}
              <div>
                <label htmlFor="job-desc" className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description *
                </label>
                {/* URL Input */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        placeholder="https://company.com/jobs/senior-engineer"
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={urlLoading}
                      />
                      <button
                        type="button"
                        onClick={handleFetchJobFromUrl}
                        disabled={urlLoading || !jobUrl.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center text-sm transition-colors whitespace-nowrap"
                      >
                        {urlLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" />
                            Fetch
                          </>
                        )}
                      </button>
                    </div>

                    {/* Job platform delay warning */}
                    {isJobPlatform && !urlLoading && !urlFetchSuccess && !urlError && (
                      <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                        ⏱️ LinkedIn/Indeed require advanced extraction. This may take 10-15 seconds.
                      </div>
                    )}

                    {/* Success message */}
                    {urlFetchSuccess && !urlLoading && (
                      <div className="text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">
                        ✓ Job description extracted successfully ({jobDescription.length} characters)
                      </div>
                    )}

                    {/* Error message with manual fallback */}
                    {urlError && (
                      <div className="space-y-3">
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                          {urlError}
                        </div>

                        {/* Manual job description fallback */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-900 mb-2">
                            Paste the full job description manually (including responsibilities, qualifications, and requirements) — I'll optimize your résumé intelligently.
                          </p>
                          <textarea
                            value={manualJobTitle}
                            onChange={(e) => {
                              setManualJobTitle(e.target.value)
                              setJobDescription(e.target.value)
                            }}
                            placeholder="Paste the complete job description here, including job title, company, responsibilities, qualifications, requirements, and any other relevant details..."
                            rows={8}
                            className="w-full p-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                          />
                        </div>
                      </div>
                    )}

                    {!urlError && (
                      <p className="text-xs text-gray-500">
                        Enter a job posting URL from LinkedIn, Indeed, Glassdoor, or any company career page
                      </p>
                    )}
                  </div>
              </div>

              {/* Current Resume */}
              <div>
                <label htmlFor="current-resume" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Current Resume *
                </label>
                
                {/* PDF Upload Section */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={parseLoading}
                    className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 flex items-center text-sm transition-colors"
                  >
                    {parseLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Resume (PDF)
                  </button>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {/* Success message */}
                  {uploadedFile && currentResume && !parseLoading && (
                    <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200 flex items-center justify-between">
                      <span>✓ Resume extracted from {uploadedFile.name} ({currentResume.length} characters)</span>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                        className="text-green-700 hover:text-green-900 underline text-xs"
                        >
                        Remove
                        </button>
                    </div>
                  )}
                  
                  {/* Error message */}
                  {parseError && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      {parseError}
                    </div>
                  )}
                  
                  {/* Helper text */}
                  <p className="mt-1 text-xs text-gray-500">Upload a PDF résumé.</p>
                </div>
              </div>


              {/* Tone selector as chips */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'conservative', label: 'Conservative' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'assertive', label: 'Assertive' }
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCreativeMode(opt.id)}
                      className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                        creativeMode === opt.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateResume}
                disabled={!jobDescription || !currentResume || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-2" />
                    Generate insights
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-5">Generated Resume</h2>

            {!result ? (
              <div className="text-center text-gray-500 py-12">
                {loading ? (
                  <div className="text-left">
                    <UploadingNarrative jobDescription={jobDescription} companyNameHint={companyName ?? undefined} />
                  </div>
                ) : (
                  <>
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Your tailored resume will appear here</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <ChatNarrator insights={result.insights} />

                {showResume && (
                  <div className="animate-fade-in">
                    <ResumePreview optimized={result.optimized_resume} />
                  </div>
                )}
              </div>
            )}
            {/* Mobile-only Start Over is hidden on desktop */}
          </div>
        </div>

        {/* Mobile progressive flow */}
        <div className="lg:hidden">
          <AnimatePresence mode="wait">
            {phase === 'input' ? (
              <motion.div
                key="phase-input"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-white rounded-xl shadow-md p-5"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-5">Input Information</h2>
                <div className="space-y-6">
                  {/* Job Description (URL only) */}
                  <div>
                    <label htmlFor="job-desc" className="block text-sm font-medium text-gray-700 mb-2">
                      Job Description *
                    </label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={jobUrl}
                          onChange={(e) => setJobUrl(e.target.value)}
                          placeholder="https://company.com/jobs/senior-engineer"
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          disabled={urlLoading}
                        />
                        <button
                          type="button"
                          onClick={handleFetchJobFromUrl}
                          disabled={urlLoading || !jobUrl.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center text-sm transition-colors whitespace-nowrap"
                        >
                          {urlLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4 mr-2" />
                              Fetch
                            </>
                          )}
                        </button>
                      </div>
                      {/* Job platform delay warning */}
                      {isJobPlatform && !urlLoading && !urlFetchSuccess && !urlError && (
                        <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                          ⏱️ LinkedIn/Indeed require advanced extraction. This may take 10-15 seconds.
                        </div>
                      )}

                      {urlFetchSuccess && !urlLoading && (
                        <div className="text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">
                          ✓ Job description extracted successfully ({jobDescription.length} characters)
                        </div>
                      )}
                      {/* Error message with manual fallback */}
                      {urlError && (
                        <div className="space-y-3">
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                            {urlError}
                          </div>

                          {/* Manual job description fallback */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-900 mb-2">
                              Paste the full job description manually (including responsibilities, qualifications, and requirements) — I'll optimize your résumé intelligently.
                            </p>
                            <textarea
                              value={manualJobTitle}
                              onChange={(e) => {
                                setManualJobTitle(e.target.value)
                                setJobDescription(e.target.value)
                              }}
                              placeholder="Paste the complete job description here, including job title, company, responsibilities, qualifications, requirements, and any other relevant details..."
                              rows={8}
                              className="w-full p-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                            />
                          </div>
                        </div>
                      )}
                      {!urlError && (
                        <p className="text-xs text-gray-500">
                          Enter a job posting URL from LinkedIn, Indeed, Glassdoor, or any company career page
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Current Resume */}
                  <div>
                    <label htmlFor="current-resume" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Current Resume *
                    </label>
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={parseLoading}
                        className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 flex items-center text-sm transition-colors"
                      >
                        {parseLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Resume (PDF)
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {uploadedFile && currentResume && !parseLoading && (
                        <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200 flex items-center justify-between">
                          <span>✓ Resume extracted from {uploadedFile.name} ({currentResume.length} characters)</span>
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="text-green-700 hover:text-green-900 underline text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {parseError && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                          {parseError}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">Upload a PDF résumé.</p>
                    </div>
                  </div>

                  {/* Tone selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { id: 'conservative', label: 'Conservative' },
                        { id: 'balanced', label: 'Balanced' },
                        { id: 'assertive', label: 'Assertive' }
                      ] as const).map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCreativeMode(opt.id)}
                          className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                            creativeMode === opt.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={generateResume}
                    disabled={!jobDescription || !currentResume || loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        Generate insights
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="phase-output"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="space-y-5"
              >
                <div className="bg-white rounded-xl shadow-md p-5">
                  <h2 className="text-xl font-semibold text-gray-900 mb-5">Generated Resume</h2>
                  {!result ? (
                    <div className="text-center text-gray-500 py-12">
                      {loading ? (
                        <div className="text-left">
                          <UploadingNarrative jobDescription={jobDescription} companyNameHint={companyName ?? undefined} />
                        </div>
                      ) : (
                        <>
                          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>Your tailored resume will appear here</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <ChatNarrator insights={result.insights} />
                      {showResume && (
                        <div className="animate-fade-in">
                          <ResumePreview optimized={result.optimized_resume} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={startOver}
                    className="w-full text-center text-gray-600 hover:text-gray-800 underline text-sm"
                  >
                    Start over
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}