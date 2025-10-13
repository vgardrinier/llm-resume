'use client'

import { useState } from 'react'
import { FileText, Download, Sparkles } from 'lucide-react'

interface ResumeResult {
  resume_md: string
  fit_summary: string
  keywords: string[]
}

export default function Home() {
  const [jobDescription, setJobDescription] = useState('')
  const [currentResume, setCurrentResume] = useState('')
  const [companyVision, setCompanyVision] = useState('')
  const [result, setResult] = useState<ResumeResult | null>(null)
  const [loading, setLoading] = useState(false)

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
          company_vision: companyVision || undefined,
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
                <textarea
                  id="current-resume"
                  value={currentResume}
                  onChange={(e) => setCurrentResume(e.target.value)}
                  placeholder="Paste your current resume or LinkedIn summary here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Company Vision (Optional) */}
              <div>
                <label htmlFor="company-vision" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Vision (Optional)
                </label>
                <textarea
                  id="company-vision"
                  value={companyVision}
                  onChange={(e) => setCompanyVision(e.target.value)}
                  placeholder="Additional company culture or vision information..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
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
                    {result.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

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