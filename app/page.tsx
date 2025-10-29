'use client'

import { useState, useRef } from 'react'
import { FileText, Download, Sparkles, Upload, X, Link2 } from 'lucide-react'
import { ParseResumeResponse, GenerateInsightsResponse } from '@/types/api'
import { ChatNarrator } from '@/app/components/ChatNarrator'
import { InsightCard } from '@/app/components/InsightCard'
import { ResumePreview } from '@/app/components/ResumePreview'

export default function Home() {
  const [jobDescription, setJobDescription] = useState('')
  const [currentResume, setCurrentResume] = useState('')
  const [creativeMode, setCreativeMode] = useState<'conservative' | 'balanced' | 'assertive'>('balanced')
  const [result, setResult] = useState<GenerateInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  
  // PDF upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Job URL state
  const [jobUrl, setJobUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'text' | 'url'>('url')
  const [urlFetchSuccess, setUrlFetchSuccess] = useState(false)

  const generateResume = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/generate', {
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
      setParseError(error instanceof Error ? error.message : 'Failed to extract text from PDF. Please paste text manually.')
    } finally {
      setParseLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
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

      // Auto-fill the textarea with extracted job description
      setJobDescription(data.jobDescription)
      setUrlFetchSuccess(true)

      // Store company info if needed (for display later)
      if (data.companyName) {
        console.log('Company detected:', data.companyName)
      }

    } catch (error) {
      console.error('URL fetching error:', error)
      setUrlError(error instanceof Error ? error.message : 'Failed to extract job description from URL. Please paste text manually.')
      setUrlFetchSuccess(false)
    } finally {
      setUrlLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-indigo-600 mr-2" />
            <h1 className="text-4xl font-bold text-gray-900">LLM Resume Generator</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Generate tailored, ATS-optimized resumes for technical and product roles in seconds
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Input Information</h2>

            <div className="space-y-6">
              {/* Job Description */}
              <div>
                <label htmlFor="job-desc" className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description *
                </label>

                {/* Toggle between URL and Text input */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('text')
                      setUrlFetchSuccess(false)
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      inputMode === 'text'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('url')
                      setUrlFetchSuccess(false)
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      inputMode === 'url'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Link2 className="inline h-4 w-4 mr-1" />
                    From URL
                  </button>
                </div>

                {/* URL Input Mode */}
                {inputMode === 'url' && (
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

                    {/* Success message */}
                    {urlFetchSuccess && !urlLoading && (
                      <div className="text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">
                        ✓ Job description extracted successfully ({jobDescription.length} characters)
                      </div>
                    )}

                    {/* Error message */}
                    {urlError && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                        {urlError}
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Enter a job posting URL from LinkedIn, Indeed, Glassdoor, or any company career page
                    </p>
                  </div>
                )}

                {/* Text input (only shown in text mode) */}
                {inputMode === 'text' && (
                <textarea
                  id="job-desc"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
                )}
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
                  <p className="mt-1 text-xs text-gray-500">
                    Upload PDF or paste text manually
                  </p>
                </div>
                
                {/* Show textarea only if no file uploaded */}
                {!uploadedFile && (
                  <textarea
                    id="current-resume"
                    value={currentResume}
                    onChange={(e) => setCurrentResume(e.target.value)}
                    placeholder="Paste your current resume or LinkedIn summary here..."
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                )}
              </div>


              {/* Creative Mode Control */}
              <div>
                <label htmlFor="creative-mode" className="block text-sm font-medium text-gray-700 mb-2">
                  Tone & Creativity Level
                </label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <input
                      type="radio"
                      id="conservative"
                      name="creative-mode"
                      value="conservative"
                      checked={creativeMode === 'conservative'}
                      onChange={(e) => setCreativeMode(e.target.value as 'conservative' | 'balanced' | 'assertive')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="conservative" className="text-sm text-gray-700">
                      <span className="font-medium">Conservative</span> - Factual accuracy over impact
                    </label>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="radio"
                      id="balanced"
                      name="creative-mode"
                      value="balanced"
                      checked={creativeMode === 'balanced'}
                      onChange={(e) => setCreativeMode(e.target.value as 'conservative' | 'balanced' | 'assertive')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="balanced" className="text-sm text-gray-700">
                      <span className="font-medium">Balanced</span> - Optimal truth + impact (recommended)
                    </label>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="radio"
                      id="assertive"
                      name="creative-mode"
                      value="assertive"
                      checked={creativeMode === 'assertive'}
                      onChange={(e) => setCreativeMode(e.target.value as 'conservative' | 'balanced' | 'assertive')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="assertive" className="text-sm text-gray-700">
                      <span className="font-medium">Assertive</span> - High-energy, outcome-focused
                    </label>
                  </div>
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
                    Generate Tailored Resume
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Generated Resume</h2>

            {!result ? (
              <div className="text-center text-gray-500 py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Your tailored resume will appear here</p>
              </div>
            ) : (
              <div className="space-y-6">
                <ChatNarrator insights={result.insights} />

                {result.insights.optimizations && result.insights.optimizations.length > 0 && (
                  <InsightCard type="optimizations" title="Optimizations Made" data={result.insights.optimizations} />
                )}

                {result.insights.review_notes && result.insights.review_notes.length > 0 && (
                  <InsightCard type="review" title="Review Notes" data={result.insights.review_notes} />
                )}

                {result.insights.auto_optimized && result.insights.auto_optimized.length > 0 && (
                  <InsightCard type="auto_optimized" title="Auto-Optimized" data={result.insights.auto_optimized} />
                )}

                <ResumePreview optimized={result.optimized_resume} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}