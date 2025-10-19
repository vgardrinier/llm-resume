'use client'

import { useState, useRef } from 'react'
import { FileText, Download, Sparkles, Upload, X } from 'lucide-react'
import { ParseResumeResponse } from '@/types/api'

interface ResumeResult {
  resume_md: string
  fit_summary: string
  keywords_used: string[]
  themes_covered: string[]
  changes_made: string[]
  sanity_concerns?: string[]
  auto_patched?: boolean
  fit_score: {
    score: number
    breakdown: {
      keywordMatch: number
      themeAlignment: number
      experienceRelevance: number
      skillOverlap: number
    }
    explanation: string
  }
}

export default function Home() {
  const [jobDescription, setJobDescription] = useState('')
  const [currentResume, setCurrentResume] = useState('')
  const [creativeMode, setCreativeMode] = useState<'conservative' | 'balanced' | 'assertive'>('balanced')
  const [result, setResult] = useState<ResumeResult | null>(null)
  const [loading, setLoading] = useState(false)
  
  // PDF upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      const data = await response.json()
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

    const blob = new Blob([result.resume_md], { type: 'text/markdown' })
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
                <textarea
                  id="job-desc"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
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
                  
                  {/* File chip */}
                  {uploadedFile && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {uploadedFile.name} ({formatFileSize(uploadedFile.size)})
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="hover:bg-indigo-200 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
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
                
                {/* Show textarea only if no file uploaded or user wants to edit */}
                {!uploadedFile ? (
                  <textarea
                    id="current-resume"
                    value={currentResume}
                    onChange={(e) => setCurrentResume(e.target.value)}
                    placeholder="Paste your current resume or LinkedIn summary here..."
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Resume text extracted from PDF ({currentResume.length} characters)
                      </p>
                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        Upload different file
                      </button>
                    </div>
                    <textarea
                      id="current-resume"
                      value={currentResume}
                      onChange={(e) => setCurrentResume(e.target.value)}
                      placeholder="Edit your extracted resume text..."
                      className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
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
                {/* Fit Score */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Fit Score</h3>
                  <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-400">
                    {/* Overall Score and Explanation */}
                    <div className="mb-6">
                      <div className="flex items-start gap-4 mb-4">
                        <span className="text-4xl font-bold text-blue-600">{result.fit_score.score}%</span>
                        <div className="flex-1">
                          <p className="text-sm text-blue-800 leading-relaxed">
                            {result.fit_score.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Breakdown Metrics */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-blue-700">Keywords:</span>
                        <span className="font-semibold text-blue-600">{result.fit_score.breakdown.keywordMatch}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-blue-700">Themes:</span>
                        <span className="font-semibold text-blue-600">{result.fit_score.breakdown.themeAlignment}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-blue-700">Experience:</span>
                        <span className="font-semibold text-blue-600">{result.fit_score.breakdown.experienceRelevance}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-blue-700">Skills:</span>
                        <span className="font-semibold text-blue-600">{result.fit_score.breakdown.skillOverlap}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fit Summary */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Why You're a Great Fit</h3>
                  <p className="text-gray-700 bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                    {result.fit_summary}
                  </p>
                </div>

                {/* Keywords */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Key Terms Included</h3>
                  <div className="flex flex-wrap gap-2">
                    {(result.keywords_used || []).map((keyword, index) => (
                      <span
                        key={index}
                        className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Themes Covered */}
                {result.themes_covered && result.themes_covered.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Themes Emphasized</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.themes_covered.map((theme, index) => (
                        <span
                          key={index}
                          className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changes Made */}
                {result.changes_made && result.changes_made.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Optimizations Made</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {result.changes_made.map((change, index) => (
                        <li key={index}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sanity Concerns */}
                {result.sanity_concerns && result.sanity_concerns.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Review Notes</h3>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <ul className="list-disc list-inside text-yellow-800 space-y-1">
                        {result.sanity_concerns.map((concern, index) => (
                          <li key={index}>{concern}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Auto-patch Notification */}
                {result.auto_patched && (
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">🔧 Auto-Optimized</h3>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                      <p className="text-blue-800">
                        Replaced potentially inflated numbers with neutral qualifiers to maintain accuracy while preserving impact.
                      </p>
                    </div>
                  </div>
                )}

                {/* Resume Preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Resume Preview</h3>
                    <button
                      onClick={downloadMarkdown}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center text-sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download MD
                    </button>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                      {result.resume_md}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}