'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Link2 } from 'lucide-react'
import { ParseResumeResponse, GenerateInsightsResponse, StructuredResumeResponse } from '@/types/api'
import { ChatNarrator } from '@/app/components/ChatNarrator'
import { UploadingNarrative } from '@/app/components/UploadingNarrative'
import { InsightCard } from '@/app/components/InsightCard'
import { ResumeModal } from '@/app/components/ResumeModal'
import { HeroTitle } from '@/app/components/HeroTitle'
import { Navbar } from '@/app/components/Navbar'
import { Button } from '@/app/components/Button'
import { ErrorAlert } from '@/app/components/ErrorAlert'
import { Tooltip } from '@/app/components/Tooltip'
import { ResumeWorkspace } from '@/app/components/ResumeWorkspace'
import { AnimatePresence, motion } from 'framer-motion'

export default function Home() {
  const [jobDescription, setJobDescription] = useState('')
  const [currentResume, setCurrentResume] = useState('')
  const [creativeMode, setCreativeMode] = useState<'conservative' | 'balanced' | 'assertive'>('balanced')
  const [result, setResult] = useState<GenerateInsightsResponse | null>(null)
  const [structuredResult, setStructuredResult] = useState<StructuredResumeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [useStructuredFlow, setUseStructuredFlow] = useState(true) // Feature flag for new flow
  const [generationError, setGenerationError] = useState<string | null>(null)
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
  // Quick extraction state
  const [quickMetadata, setQuickMetadata] = useState<{ companyName?: string | null; jobTitle?: string | null; location?: string | null } | null>(null)
  const [fullJdPromise, setFullJdPromise] = useState<Promise<string> | null>(null)
  
  // Baseline fit score state (appears during loading)
  const [baselineFit, setBaselineFit] = useState<{
    overallScore: number
    breakdown: {
      keywordMatch: number
      themeAlignment: number
      experienceRelevance: number
      skillOverlap: number
    }
  } | null>(null)

  // State to store resolved flags for display (location -> flag emoji)
  const [resolvedFlags, setResolvedFlags] = useState<Map<string, string>>(new Map())
  // Ref to track pending requests to avoid duplicate API calls
  const pendingFlagsRef = useRef<Set<string>>(new Set())
  
  // Resolve flag when location changes
  useEffect(() => {
    if (!quickMetadata?.location) return
    
    const locationKey = quickMetadata.location.trim().toLowerCase()
    
    // Skip if already resolved or pending
    setResolvedFlags(prev => {
      if (prev.has(locationKey) || pendingFlagsRef.current.has(locationKey)) {
        return prev
      }
      
      // Mark as pending
      pendingFlagsRef.current.add(locationKey)
      
      // Fetch flag from API
      fetch('/api/get-country-flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location: quickMetadata.location }),
      })
        .then(response => response.json())
        .then(data => {
          const flag = data.flag ? ` ${data.flag}` : ''
          setResolvedFlags(current => {
            const next = new Map(current)
            next.set(locationKey, flag)
            return next
          })
          pendingFlagsRef.current.delete(locationKey)
        })
        .catch(error => {
          console.error('[GetCountryFlag] Error fetching flag:', error)
          pendingFlagsRef.current.delete(locationKey)
        })
      
      return prev
    })
  }, [quickMetadata?.location])
  
  // Helper to get flag from cache (synchronous for display)
  const getCountryFlag = (location: string | null | undefined): string => {
    if (!location) return ''
    return resolvedFlags.get(location.trim().toLowerCase()) || ''
  }

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
    setQuickMetadata(null)
    setFullJdPromise(null)
  }, [jobUrl])

  const generateResume = async () => {
    // Start timing from button click
    const userClickStart = performance.now()
    const timingBreakdown: Record<string, number> = {
      buttonClick: 0,
      fullJdWait: 0,
      apiCall: 0,
      responseParse: 0,
      stateUpdate: 0,
      total: 0
    }
    
    setPhase('output')
    setLoading(true)
    setShowResume(false) // Reset resume visibility
    setBaselineFit(null) // Reset baseline fit score for new analysis
    
    timingBreakdown.buttonClick = performance.now() - userClickStart
    
    try {
      // If we have a background full JD extraction promise, wait for it
      let finalJobDescription = jobDescription
      const fullJdWaitStart = performance.now()
      if (fullJdPromise) {
        console.log('[Frontend] Waiting for full JD extraction to complete...')
        const fullJd = await fullJdPromise
        if (fullJd) {
          finalJobDescription = fullJd
          setJobDescription(fullJd)
          console.log('[Frontend] Full JD extraction completed, using it for analysis')
        } else {
          console.warn('[Frontend] Full JD extraction failed, using existing job description')
        }
      }
      timingBreakdown.fullJdWait = performance.now() - fullJdWaitStart

      // Debug: Log inputs before API call
      console.log('[Frontend] Starting resume generation', {
        step: 'start',
        hasJob: !!finalJobDescription,
        hasResume: !!currentResume,
        jobLength: finalJobDescription?.length || 0,
        resumeLength: currentResume?.length || 0,
        creativeMode,
        waitedForFullJd: !!fullJdPromise,
      })

      // Choose API endpoint based on feature flag
      const apiEndpoint = useStructuredFlow ? '/api/premium-start' : '/api/orchestrator'
      const usePolling = useStructuredFlow // Premium uses polling

      const apiCallStart = performance.now()

      let data: any

      if (usePolling) {
        // POLLING FLOW for premium (async)
        console.log('[Frontend] Starting async premium job...')

        // Step 1: Start the job
        const startResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_description: finalJobDescription,
            candidate_resume: currentResume,
            creative_mode: creativeMode,
          }),
        })

        if (!startResponse.ok) {
          const errorData = await startResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to start analysis')
        }

        const { jobId } = await startResponse.json()
        console.log(`[Frontend] Job started: ${jobId}, polling for results...`)

        // Step 2: Poll for completion
        let attempts = 0
        const maxAttempts = 90 // 3 minutes max (2s interval)

        while (attempts < maxAttempts) {
          attempts++
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2s poll interval

          const statusResponse = await fetch(`/api/premium-status?jobId=${jobId}`)

          if (!statusResponse.ok) {
            throw new Error('Failed to check job status')
          }

          const status = await statusResponse.json()

          console.log(`[Frontend Poll ${attempts}] ${status.status} | ${status.progress}% | ${status.currentStep || ''}`)

          // Capture baseline fit score when it becomes available (~5s in)
          if (status.baselineFit && !baselineFit) {
            setBaselineFit(status.baselineFit)
            console.log('[Frontend] Baseline fit score received:', status.baselineFit.overallScore)
          }

          if (status.status === 'completed') {
            data = status.result
            console.log(`[Frontend] Job completed after ${attempts} polls`)
            break
          }

          if (status.status === 'failed') {
            throw new Error(status.error || 'Analysis failed')
          }
        }

        if (!data) {
          throw new Error('Analysis timeout after 3 minutes')
        }

      } else {
        // ORIGINAL FLOW for non-premium (synchronous)
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            job_description: finalJobDescription,
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

          // Provide user-friendly error messages based on status code
          let userMessage = 'Failed to generate resume. Please try again.'
          if (response.status === 400) {
            // Check if it's a job description length issue
            if (errorData.error?.includes('incomplete') || errorData.error?.includes('minimum')) {
              userMessage = errorData.error + (errorData.details ? ` ${errorData.details}` : '')
            } else {
              userMessage = errorData.error || 'Invalid request. Please check your inputs and try again.'
            }
          } else if (response.status === 429) {
            userMessage = 'Too many requests. Please wait a moment and try again.'
          } else if (response.status === 500) {
            userMessage = errorData.error || 'Our servers encountered an issue. Please try again in a moment.'
          } else if (response.status >= 500) {
            userMessage = 'Service temporarily unavailable. Please try again shortly.'
          }

          throw new Error(userMessage)
        }

        data = await response.json()
      }

      // Parse response based on which flow we're using
      timingBreakdown.apiCall = performance.now() - apiCallStart
      const parseStart = performance.now()

      if (useStructuredFlow) {
        const structuredData: StructuredResumeResponse = data
        timingBreakdown.responseParse = performance.now() - parseStart

        // Extract server-side timing if available
        const serverTiming = structuredData.metadata?.timing || {}

        const stateUpdateStart = performance.now()
        setStructuredResult(structuredData)
        timingBreakdown.stateUpdate = performance.now() - stateUpdateStart
        
        timingBreakdown.total = performance.now() - userClickStart

        console.log('[Frontend] Structured API response received', {
          step: 'api_response',
          hasOptimizedResume: !!data.optimizedResume,
          changesCount: data.changes?.length || 0,
          hasAnalysis: !!data.analysis,
          fitScoreBefore: data.analysis?.fitScoreBefore,
          fitScoreAfter: data.analysis?.fitScoreAfter,
        })

        // Comprehensive timing breakdown
        console.log('⏱️ TIMING BREAKDOWN (Button Click → Output Reveal):', {
          'Client-Side': {
            'Button Click → Setup': `${timingBreakdown.buttonClick.toFixed(0)}ms`,
            'Full JD Wait (if any)': `${timingBreakdown.fullJdWait.toFixed(0)}ms`,
            'API Call (network + server)': `${timingBreakdown.apiCall.toFixed(0)}ms`,
            'Response Parse': `${timingBreakdown.responseParse.toFixed(0)}ms`,
            'State Update': `${timingBreakdown.stateUpdate.toFixed(0)}ms`,
            'TOTAL CLIENT TIME': `${timingBreakdown.total.toFixed(0)}ms (${(timingBreakdown.total / 1000).toFixed(1)}s)`
          },
          'Server-Side (from API)': {
            'Analyzer (Sonnet)': serverTiming.analyzer_ms ? `${serverTiming.analyzer_ms}ms (${(serverTiming.analyzer_ms / 1000).toFixed(1)}s)` : 'N/A',
            'Generator (Haiku)': serverTiming.generator_ms ? `${serverTiming.generator_ms}ms (${(serverTiming.generator_ms / 1000).toFixed(1)}s)` : 'N/A',
            'Curator (Haiku)': serverTiming.curator_ms ? `${serverTiming.curator_ms}ms (${(serverTiming.curator_ms / 1000).toFixed(1)}s)` : 'N/A',
            'Fit Score Calc': serverTiming.fitScore_ms ? `${serverTiming.fitScore_ms}ms (${(serverTiming.fitScore_ms / 1000).toFixed(1)}s)` : 'N/A',
            'TOTAL SERVER TIME': serverTiming.total_ms ? `${serverTiming.total_ms}ms (${(serverTiming.total_ms / 1000).toFixed(1)}s)` : 'N/A'
          },
          'Bottleneck Analysis': (() => {
            const bottlenecks: string[] = []
            if (serverTiming.analyzer_ms && serverTiming.analyzer_ms > 30000) {
              bottlenecks.push(`⚠️ Analyzer (Sonnet) is slow: ${(serverTiming.analyzer_ms / 1000).toFixed(1)}s`)
            }
            if (serverTiming.generator_ms && serverTiming.generator_ms > 20000) {
              bottlenecks.push(`⚠️ Generator (Haiku) is slow: ${(serverTiming.generator_ms / 1000).toFixed(1)}s`)
            }
            if (serverTiming.curator_ms && serverTiming.curator_ms > 15000) {
              bottlenecks.push(`⚠️ Curator (Haiku) is slow: ${(serverTiming.curator_ms / 1000).toFixed(1)}s`)
            }
            if (serverTiming.fitScore_ms && serverTiming.fitScore_ms > 10000) {
              bottlenecks.push(`⚠️ Fit Score calculation is slow: ${(serverTiming.fitScore_ms / 1000).toFixed(1)}s`)
            }
            if (timingBreakdown.apiCall > 120000) {
              bottlenecks.push(`⚠️ Total API call is very long: ${(timingBreakdown.apiCall / 1000).toFixed(1)}s`)
            }
            return bottlenecks.length > 0 ? bottlenecks : ['✅ All timings look reasonable']
          })()
        })
      } else {
        const data: GenerateInsightsResponse = await response.json()
        timingBreakdown.responseParse = performance.now() - parseStart

        const stateUpdateStart = performance.now()
        setResult(data)
        timingBreakdown.stateUpdate = performance.now() - stateUpdateStart
        
        timingBreakdown.total = performance.now() - userClickStart

        console.log('[Frontend] Legacy API response received', {
          step: 'api_response',
          hasInsights: !!data.insights,
          hasFitScore: !!data.insights?.fit,
          fitScoreBefore: data.insights?.fit?.score_before,
          fitScoreAfter: data.insights?.fit?.score_after,
          hasOptimizedResume: !!data.optimized_resume,
          optimizedResumeLength: data.optimized_resume?.length || 0,
        })

        console.log('⏱️ TIMING BREAKDOWN (Button Click → Output Reveal):', {
          'Client-Side': {
            'Button Click → Setup': `${timingBreakdown.buttonClick.toFixed(0)}ms`,
            'Full JD Wait (if any)': `${timingBreakdown.fullJdWait.toFixed(0)}ms`,
            'API Call (network + server)': `${timingBreakdown.apiCall.toFixed(0)}ms`,
            'Response Parse': `${timingBreakdown.responseParse.toFixed(0)}ms`,
            'State Update': `${timingBreakdown.stateUpdate.toFixed(0)}ms`,
            'TOTAL CLIENT TIME': `${timingBreakdown.total.toFixed(0)}ms (${(timingBreakdown.total / 1000).toFixed(1)}s)`
          }
        })
      }

      setGenerationError(null) // Clear any previous errors on success
    } catch (error) {
      console.error('Error generating resume:', error)
      
      // Handle different error types with user-friendly messages
      let errorMessage = 'Failed to generate resume. Please try again.'
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      setGenerationError(errorMessage)
      // Reset phase to input so user can try again
      setPhase('input')
    } finally {
      setLoading(false)
    }
  }

  const startOver = () => {
    setPhase('input')
    setLoading(false)
    setShowResume(false)
    setResult(null)
    setStructuredResult(null)
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
    setGenerationError(null)
    setQuickMetadata(null)
    setFullJdPromise(null)
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

  // Job URL fetching with quick extraction
  const handleFetchJobFromUrl = async () => {
    if (!jobUrl.trim()) {
      setUrlError('Please enter a valid URL')
      return
    }

    setUrlError(null)
    setUrlLoading(true)
    setUrlFetchSuccess(false)
    setManualJobTitle('') // Clear manual entry when starting a new URL fetch
    setQuickMetadata(null)
    setFullJdPromise(null)

    try {
      // Step 1: Quick extraction (title, company, location)
      console.log('[Frontend] Starting quick extraction...')
      const quickResponse = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: jobUrl, quick: true }),
      })

      if (!quickResponse.ok) {
        const errorData = await quickResponse.json()
        throw new Error(errorData.error || 'Failed to fetch job description')
      }

      const quickData = await quickResponse.json()
      
      // If quick extraction returned metadata, store it and show Analyze button
      if (quickData.quick && (quickData.companyName || quickData.jobTitle || quickData.location)) {
        console.log('[Frontend] Quick extraction successful:', quickData)
        setQuickMetadata({
          companyName: quickData.companyName,
          jobTitle: quickData.jobTitle,
          location: quickData.location,
        })
        
        if (quickData.companyName) setCompanyName(quickData.companyName)

        // Start full JD extraction in background
        const fullExtractionPromise = fetch('/api/fetch-job', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: jobUrl, quick: false }),
        })
          .then(async (response) => {
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'Failed to fetch full job description')
            }
            const fullData = await response.json()
            
            // Log successful full JD extraction
            const jdLength = fullData.jobDescription?.length || 0
            console.log(`[Frontend] ✅ Full JD extraction completed in background: ${jdLength} characters`, {
              jobTitle: fullData.jobTitle || quickMetadata?.jobTitle || 'N/A',
              company: fullData.companyName || quickMetadata?.companyName || 'N/A',
              location: fullData.location || quickMetadata?.location || 'N/A',
            })
            
            // Build final job description with metadata prepended
            let finalJobDescription = fullData.jobDescription
            if (fullData.jobTitle || fullData.location) {
              const prefixParts: string[] = []
              if (fullData.jobTitle) prefixParts.push(`Job Title: ${fullData.jobTitle}`)
              if (fullData.location) prefixParts.push(`Location: ${fullData.location}`)
              if (prefixParts.length > 0) {
                finalJobDescription = `${prefixParts.join('\n')}\n\n${fullData.jobDescription}`
              }
            }

            // Update state so button becomes enabled
            setJobDescription(finalJobDescription)

            return finalJobDescription
          })
          .catch((error) => {
            console.error('[Frontend] ❌ Full JD extraction error:', error)
            // Return empty string if full extraction fails - we'll use what we have
            return ''
          })

        setFullJdPromise(fullExtractionPromise)
        setUrlFetchSuccess(true)
        setUrlLoading(false)
        return
      }

      // Fallback: If quick extraction didn't work or returned full data, use it
      console.log('[Frontend] Quick extraction returned full data or failed, using directly')
      if (quickData.companyName) setCompanyName(quickData.companyName)
      
      let finalJobDescription = quickData.jobDescription || ''
      if (quickData.jobTitle || quickData.location) {
        const prefixParts: string[] = []
        if (quickData.jobTitle) prefixParts.push(`Job Title: ${quickData.jobTitle}`)
        if (quickData.location) prefixParts.push(`Location: ${quickData.location}`)
        if (prefixParts.length > 0 && finalJobDescription) {
          finalJobDescription = `${prefixParts.join('\n')}\n\n${finalJobDescription}`
        }
      }
      setJobDescription(finalJobDescription)
      
      setUrlFetchSuccess(true)
      setManualJobTitle('') // Clear manual entry on successful URL fetch

      // Store company info if needed (for display later)
      if (quickData.companyName) {
        console.log('Company detected:', quickData.companyName)
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
      setUrlLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Navbar */}
      <Navbar 
        jobUrl={jobUrl} 
        uploadedFileName={uploadedFile?.name} 
        onHomeClick={startOver}
      />

      {/* Main content - centered vertically and horizontally */}
      {/* Background image transition */}
      <motion.div
        className="flex-1 w-full flex flex-col md:justify-center items-center overflow-y-auto relative"
        initial={false}
        animate={{
          opacity: 1,
        }}
        transition={{
          opacity: { duration: 0.4, ease: "easeOut" },
        }}
        style={{
          minHeight: '100vh',
          width: '100%',
        }}
      >
        {/* Background images with smooth transition */}
        <motion.div
          className="fixed inset-0 -z-10"
          initial={false}
          animate={{
            opacity: phase === 'input' ? 1 : 0,
          }}
          transition={{
            opacity: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat md:bg-contain"
            style={{
              backgroundImage: 'url(/rightfit_background_mobile.png)',
            }}
          />
          <div
            className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(/rightfit_background_wide.png)',
            }}
          />
        </motion.div>
        <motion.div
          className="fixed inset-0 -z-10"
          initial={false}
          animate={{
            opacity: phase === 'output' || structuredResult ? 1 : 0,
          }}
          transition={{
            opacity: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat md:bg-contain"
            style={{
              backgroundImage: 'url(/rightfit_background_mobile.png)',
            }}
          />
          <div
            className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(/rightfit_background2.png)',
            }}
          />
        </motion.div>
        <div className={`w-full ${structuredResult ? 'max-w-none' : 'max-w-3xl'} flex flex-col items-center md:items-center pt-6 md:pt-0`}>
          {/* Hero Title with AnimatePresence for smooth fade-out */}
          <AnimatePresence>
            {phase === 'input' && (
              <motion.div
                key="hero-title"
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="mb-6 md:mb-8 w-full flex justify-center px-4 md:px-0"
              >
                <HeroTitle isInputFocused={isInputFocused} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main content area */}
          <div className="w-full flex flex-col justify-start px-4 md:px-0 pb-24 md:pb-0">
            <AnimatePresence mode="wait">
              {phase === 'input' ? (
                <motion.div
                  key="input-phase"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                  className="w-full py-6"
                >
                  {/* Generation error alert */}
                  {generationError && (
                    <div className="mb-4">
                      <ErrorAlert
                        message={generationError}
                        onDismiss={() => setGenerationError(null)}
                        onRetry={generateResume}
                        variant="error"
                      />
                    </div>
                  )}

                  {/* Floating capsule */}
                  <div className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6 space-y-3">
                    {/* Desktop: URL Input and Upload side by side, Mobile: stacked */}
                    <div className="flex flex-col md:flex-row gap-2">
                      {/* Job URL Input */}
                      <div className="flex gap-2 flex-1">
                        <input
                          type="url"
                          value={jobUrl}
                          onChange={(e) => setJobUrl(e.target.value)}
                          onFocus={() => setIsInputFocused(true)}
                          onBlur={() => setIsInputFocused(false)}
                          placeholder="Paste job link here"
                          className="flex-1 min-h-[56px] px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all hover:border-gray-400 backdrop-blur-sm bg-white/60 placeholder:text-gray-500 text-gray-900 text-sm md:text-base font-serif shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                          disabled={urlLoading}
                        />
                        <Tooltip key="fetch-job-tooltip" content={urlFetchSuccess ? "Job description extracted successfully" : "Fetch job description"} position="top" align="left" delay={200}>
                          <button
                            type="button"
                            onClick={handleFetchJobFromUrl}
                            disabled={urlLoading || !jobUrl.trim()}
                            className={`min-h-[56px] min-w-[56px] rounded-xl text-white border flex items-center justify-center transition-all flex-shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.05)] ${
                              urlFetchSuccess
                                ? 'bg-green-600 hover:bg-green-700 border-green-600'
                                : urlLoading
                                ? 'bg-gray-300 border-gray-300'
                                : 'bg-gray-900 hover:bg-gray-800 border-gray-900'
                            }`}
                            aria-label="Fetch job description"
                          >
                            {urlLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            ) : urlFetchSuccess ? (
                              <motion.svg
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </motion.svg>
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </button>
                        </Tooltip>
                      </div>

                      {/* Resume Upload - Desktop: next to URL, Mobile: below */}
                      <div className="flex gap-2 md:flex-shrink-0">
                        <Tooltip key="upload-resume-tooltip" content={uploadedFile && currentResume ? "Résumé uploaded successfully" : "Upload résumé (PDF)"} position="left" delay={200}>
                          <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={parseLoading}
                            className={`min-h-[56px] min-w-[56px] rounded-xl text-white border flex items-center justify-center transition-all flex-shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.05)] ${
                              uploadedFile && currentResume && !parseLoading
                                ? 'bg-green-600 hover:bg-green-700 border-green-600'
                                : parseLoading
                                ? 'bg-gray-300 border-gray-300'
                                : 'bg-gray-900 hover:bg-gray-800 border-gray-900'
                            }`}
                            aria-label="Upload résumé PDF"
                          >
                            {parseLoading ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            ) : uploadedFile && currentResume ? (
                              <motion.svg
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </motion.svg>
                            ) : (
                              <Upload className="h-5 w-5" />
                            )}
                          </button>
                        </Tooltip>
                        
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        
                        {/* File status display - Desktop: next to icon, Mobile: below */}
                        <div className="flex-1 min-w-0 flex items-center md:hidden">
                          <AnimatePresence mode="wait">
                            {uploadedFile && currentResume && !parseLoading ? (
                              <motion.div
                                key="success"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.3 }}
                                className="text-xs text-green-900 backdrop-blur-sm bg-green-50/80 px-3 py-2 rounded-xl border border-green-200 truncate w-full font-serif shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                              >
                                ✓ {uploadedFile.name}
                              </motion.div>
                            ) : parseError ? (
                              <motion.div
                                key="error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.3 }}
                                className="text-xs text-red-900 backdrop-blur-sm bg-red-50/80 px-3 py-2 rounded-xl border border-red-200 truncate w-full font-serif shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                              >
                                ⚠️ {parseError}
                              </motion.div>
                            ) : (
                              <span className="text-xs text-gray-500 font-serif">Upload résumé (PDF)</span>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Helper text and status messages */}
                    <div className="space-y-2">
                      {!urlError && !urlFetchSuccess && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <img 
                              src="/linkedin_icon.png" 
                              alt="LinkedIn" 
                              className="h-3.5 w-auto"
                              style={{ objectFit: 'contain' }}
                            />
                            <img 
                              src="https://cdn.simpleicons.org/indeed/003A9B" 
                              alt="Indeed" 
                              className="h-3.5 w-3.5"
                            />
                            <img 
                              src="https://cdn.simpleicons.org/glassdoor/0CAA41" 
                              alt="Glassdoor" 
                              className="h-3.5 w-3.5"
                            />
                          </div>
                          <span className="text-xs text-gray-500 font-serif">or any company career page</span>
                        </div>
                      )}

                      {/* Job platform delay warning - Hidden on mobile */}
                      {isJobPlatform && !urlLoading && !urlFetchSuccess && !urlError && (
                        <div className="hidden md:block text-xs text-gray-900 backdrop-blur-sm bg-white/60 px-3 py-2 rounded-xl border border-gray-200 font-serif shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                          ⏱️ LinkedIn/Indeed require advanced extraction. This may take 10-15 seconds.
                        </div>
                      )}

                      {/* Success message */}
                      {urlFetchSuccess && !urlLoading && (
                        <div className="text-xs text-gray-900 backdrop-blur-sm bg-white/60 px-3 py-2 rounded-xl border border-gray-200 font-serif shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                          {quickMetadata && !jobDescription ? (
                            <>
                              ✓ {quickMetadata.jobTitle || 'Job'} {quickMetadata.companyName ? `- ${quickMetadata.companyName}` : ''}{getCountryFlag(quickMetadata.location)}
                            </>
                          ) : (
                            <>✓ Job description extracted successfully ({jobDescription.length} characters)</>
                          )}
                        </div>
                      )}

                      {/* Error message with manual fallback */}
                      {urlError && (
                        <div className="space-y-3">
                          <ErrorAlert
                            message={urlError}
                            onDismiss={() => setUrlError(null)}
                            onRetry={handleFetchJobFromUrl}
                            variant="warning"
                            className="text-sm"
                          />

                          {/* Manual job description fallback */}
                          <div className="backdrop-blur-sm bg-white/60 border border-gray-200 rounded-xl p-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                            <p className="text-xs text-gray-900 mb-2 font-serif">
                              Paste the full job description manually (including responsibilities, qualifications, and requirements) — I'll tailor your résumé to match what they're looking for.
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
                              className="w-full p-3 text-sm md:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 resize-y backdrop-blur-sm bg-white/60 text-gray-900 placeholder:text-gray-500 font-serif shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                            />
                            {/* Warning for short descriptions */}
                            {manualJobTitle.trim().length > 0 && manualJobTitle.trim().length < 200 && (
                              <div className="text-xs text-amber-700 bg-amber-50/80 px-3 py-2 rounded-lg border border-amber-200 font-serif">
                                💡 Tip: For best results, include the full job description with responsibilities, qualifications, and requirements.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA Button - Hidden on mobile (shown as sticky bottom button) */}
                    <div className="hidden md:flex justify-center pt-6">
                      <Button
                        onClick={generateResume}
                        disabled={(!jobDescription && !quickMetadata) || !currentResume || loading}
                        variant={(jobDescription || quickMetadata) && currentResume && !loading ? 'gradient' : 'primary'}
                        loading={loading}
                        loadingText="Optimizing..."
                        className="text-base px-8 py-4"
                      >
                        Optimize My Résumé
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
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  className="w-full flex justify-center"
                >
                  {/* Structured Results (full-width workspace) */}
                  {structuredResult && (
                    <ResumeWorkspace
                      data={structuredResult}
                      onStartOver={startOver}
                    />
                  )}

                  {/* Legacy/Loading States (constrained width) */}
                  {!structuredResult && (
                    <div className="w-full max-w-3xl px-0 sm:px-4 py-6 sm:py-8 mx-auto my-8">
                      {/* Error state */}
                      {generationError && !loading && (
                        <div className="mb-6">
                          <ErrorAlert
                            message={generationError}
                            onDismiss={() => setGenerationError(null)}
                            onRetry={generateResume}
                            variant="error"
                          />
                        </div>
                      )}

                      {/* Loading state */}
                      {loading && !result && (
                        <UploadingNarrative 
                          jobDescription={jobDescription} 
                          companyNameHint={companyName ?? undefined}
                          jobTitle={quickMetadata?.jobTitle || null}
                          location={quickMetadata?.location || null}
                          resume={currentResume}
                          isLoading={loading}
                          baselineFit={baselineFit ?? undefined}
                        />
                      )}

                      {/* Legacy Results (old chat narrator) */}
                      {result && (
                        <div className="space-y-6">
                          <ChatNarrator insights={result.insights} />

                          {/* Start Over button */}
                          <div className="pt-6 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={startOver}
                              className="w-full text-center text-gray-600 hover:text-gray-800 underline text-sm transition-colors font-serif"
                            >
                              Start over
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Sticky bottom button for mobile */}
      {phase === 'input' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-4 left-4 right-4 z-50 md:hidden"
        >
          <Button
            onClick={generateResume}
            disabled={!jobDescription || !currentResume || loading}
            variant={jobDescription && currentResume && !loading ? 'gradient' : 'primary'}
            loading={loading}
            loadingText="Optimizing..."
            className="w-full text-lg font-medium shadow-lg"
          >
            Optimize My Résumé
          </Button>
        </motion.div>
      )}

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
