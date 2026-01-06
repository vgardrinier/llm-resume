'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BaselineFitDisplay } from './BaselineFitDisplay'

interface UploadingNarrativeProps {
  jobDescription?: string
  companyNameHint?: string
  jobTitle?: string | null
  location?: string | null
  resume?: string
  isLoading?: boolean // Whether the API call is still in progress
  baselineFit?: {
    overallScore: number
    breakdown: {
      keywordMatch: number
      themeAlignment: number
      experienceRelevance: number
      skillOverlap: number
    }
  }
}

// Best-effort, non-blocking client extraction; skips if not found
function extractCompanyNameClient(text?: string): string | null {
  if (!text) return null
  const patterns = [
    /(?:at|@|Company:|Employer:)\s*([A-Z][a-zA-Z\s&.,]+?)(?:\s|,|\.|$)/i,
    /([A-Z][a-zA-Z\s&.,]+?)\s+(?:Inc|Corp|LLC|Ltd|Technologies|Systems|Solutions|Labs|Group)/i,
    /at\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+in|\s+located|$|,|\.)/i
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

export function UploadingNarrative({ 
  jobDescription, 
  companyNameHint,
  jobTitle,
  location,
  resume,
  isLoading = true,
  baselineFit
}: UploadingNarrativeProps) {
  const derivedCompany = useMemo(() => companyNameHint || extractCompanyNameClient(jobDescription) || null, [jobDescription, companyNameHint])
  const [step, setStep] = useState(0)
  const [beats, setBeats] = useState<string[]>([])
  const [isGeneratingBeats, setIsGeneratingBeats] = useState(true)

  // Generate dynamic beats on mount
  useEffect(() => {
    let cancelled = false

    async function generateBeats() {
      // Only generate if we have required data
      if (!jobDescription || !resume) {
        // Fallback to static beats if data not available
        const fallbackBeats = [
          "Scanning your résumé and the job details now…",
          "Comparing your experience with the role's requirements…",
          "Cross-checking skills and themes against what this position values…",
          "Almost there — writing your personalized insights now."
        ]
        if (!cancelled) {
          setBeats(fallbackBeats)
          setIsGeneratingBeats(false)
        }
        return
      }

      try {
        const response = await fetch('/api/generate-loading-beats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobTitle: jobTitle || null,
            company: derivedCompany || null,
            location: location || null,
            jobDescription: jobDescription,
            resume: resume
          })
        })

        if (!response.ok) {
          throw new Error('Failed to generate beats')
        }

        const data = await response.json()
        if (!cancelled && data.beats && Array.isArray(data.beats)) {
          setBeats(data.beats)
        } else if (!cancelled) {
          throw new Error('Invalid beats format')
        }
      } catch (error) {
        console.warn('[UploadingNarrative] Failed to generate dynamic beats, using fallback:', error)
        // Fallback to static beats
        if (!cancelled) {
          const fallbackBeats = [
            "Scanning your résumé and the job details now…",
            "Comparing your experience with the role's requirements…",
            "Cross-checking skills and themes against what this position values…",
            "Almost there — writing your personalized insights now."
          ]
          setBeats(fallbackBeats)
        }
      } finally {
        if (!cancelled) {
          setIsGeneratingBeats(false)
        }
      }
    }

    generateBeats()

    return () => {
      cancelled = true
    }
  }, [jobDescription, resume, jobTitle, location, derivedCompany])

  // Simple animated ring (decorative momentum)
  const progressRef = useRef<number>(0)
  const [progress, setProgress] = useState(0) // 0–100
  const [ringOpacity, setRingOpacity] = useState(1)
  const loadingCompleteTimeRef = useRef<number | null>(null)
  
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const rampDuration = 60000 // ~60s to ~95% (slower progression to allow more beats to show)
    const maxDuringLoad = 95 // Cap at 95% while loading
    
    // Reset completion time when loading state changes
    if (!isLoading && loadingCompleteTimeRef.current === null) {
      loadingCompleteTimeRef.current = performance.now()
    } else if (isLoading) {
      loadingCompleteTimeRef.current = null
    }
    
    const tick = (ts: number) => {
      const elapsed = ts - start
      
      // If still loading, cap at 95% and pulse
      if (isLoading) {
        if (elapsed <= rampDuration) {
          const e = Math.min(1, elapsed / rampDuration)
          const val = Math.round(maxDuringLoad * e)
          progressRef.current = val
          setProgress(val)
        } else {
          // Hold at 95% and pulse opacity while loading
          progressRef.current = maxDuringLoad
          setProgress(maxDuringLoad)
          const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin((elapsed - rampDuration) / 1000))
          setRingOpacity(pulse)
        }
      } else {
        // Loading complete - animate to 100%
        const currentProgress = progressRef.current
        if (currentProgress < 100 && loadingCompleteTimeRef.current !== null) {
          const elapsedSinceComplete = ts - loadingCompleteTimeRef.current
          const completionDuration = 500 // 0.5s to reach 100%
          if (elapsedSinceComplete <= completionDuration) {
            const e = Math.min(1, elapsedSinceComplete / completionDuration)
            const val = Math.round(currentProgress + ((100 - currentProgress) * e))
            progressRef.current = val
            setProgress(val)
            setRingOpacity(1)
          } else {
            progressRef.current = 100
            setProgress(100)
            setRingOpacity(1)
          }
        } else {
          progressRef.current = 100
          setProgress(100)
          setRingOpacity(1)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isLoading])

  // Advance through beats synced with progress - faster initially, slower near end
  // Only start advancing once beats are loaded
  useEffect(() => {
    if (isGeneratingBeats || beats.length === 0) return
    
    // Distribute beats across progress range so all can trigger before 95%:
    // Beat 0 -> 1: at 20% progress
    // Beat 1 -> 2: at 40% progress  
    // Beat 2 -> 3: at 60% progress
    // Beat 3 -> 4: at 80% progress
    // Beat 4 -> 5: at 92% progress (if exists)
    const progressThresholds = [20, 40, 60, 80, 92]
    const nextBeatThreshold = progressThresholds[Math.min(step, progressThresholds.length - 1)]
    
    // Check periodically if we've reached the threshold for the next beat
    const checkInterval = 100 // Check every 100ms
    const interval = setInterval(() => {
      if (progress >= nextBeatThreshold && step < beats.length - 1) {
        setStep(s => Math.min(s + 1, beats.length - 1))
        clearInterval(interval)
      }
    }, checkInterval)
    
    return () => clearInterval(interval)
  }, [step, beats, isGeneratingBeats, progress])

  // Track the last shown beat index to prevent repetition
  const lastShownBeatRef = useRef<number>(-1)
  
  // Cycle through remaining beats while stuck at 95% to keep user engaged
  useEffect(() => {
    if (isGeneratingBeats || beats.length === 0) return
    if (!isLoading) return
    if (progress < 95) {
      // Reset tracking when below 95%
      lastShownBeatRef.current = -1
      return
    }
    
    // If we're stuck at 95%, continue showing beats without repetition
    // First, show any remaining beats that haven't been shown yet
    // Then show a final message when all beats are exhausted
    const cycleInterval = 4000 // Change beat every 4 seconds while stuck
    const interval = setInterval(() => {
      setStep(s => {
        // If there are beats we haven't shown yet, show them first
        if (s < beats.length - 1) {
          const nextStep = s + 1
          lastShownBeatRef.current = nextStep
          return nextStep
        }
        // Once all beats are shown, stay on the last beat (don't cycle)
        // The final message will be shown separately
        return s
      })
    }, cycleInterval)
    
    return () => clearInterval(interval)
  }, [isGeneratingBeats, beats.length, isLoading, progress, step])

  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (progress / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Glass container for better readability */}
      <div className="backdrop-blur-sm bg-white/50 border border-gray-200 rounded-2xl shadow-default px-8 py-8 max-w-lg w-full">
        {/* Progress ring - minimal, clean */}
        <div className="relative flex justify-center mb-6">
          <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
            <circle 
              cx="32" 
              cy="32" 
              r={radius} 
              fill="none" 
              stroke="#9CA3AF" 
              strokeWidth="4" 
            />
            <motion.circle
              cx="32" 
              cy="32" 
              r={radius} 
              fill="none"
              stroke="#1e293b" 
              strokeWidth="4" 
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              animate={{ opacity: ringOpacity }}
              transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
            />
          </svg>
          <motion.div 
            className="absolute inset-0 flex items-center justify-center text-sm text-gray-900 font-medium font-serif"
            animate={{ opacity: ringOpacity }}
            transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
          >
            {progress}%
          </motion.div>
          {/* Animated dots when stuck at 95% */}
          {isLoading && progress >= 95 && (
            <motion.div
              className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* Narrative text - clean, minimal */}
        <div className="text-center">
          {isGeneratingBeats || beats.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-base lg:text-lg text-gray-900 leading-relaxed font-serif"
            >
              Scanning your résumé and the job details now…
            </motion.p>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-base lg:text-lg text-gray-900 leading-relaxed font-serif"
                >
                  {isLoading && progress >= 95 && step === beats.length - 1 && lastShownBeatRef.current >= beats.length - 1
                    ? "Your improved CV is now being generated…"
                    : beats[step]}
                </motion.p>
              </AnimatePresence>
              {isLoading && progress >= 95 && step === beats.length - 1 && lastShownBeatRef.current >= beats.length - 1 && !baselineFit && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-3 text-sm text-gray-500 font-sans"
                >
                  Still working…
                </motion.p>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Show baseline fit score as soon as it's available */}
      {isLoading && baselineFit && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <BaselineFitDisplay 
            overallScore={baselineFit.overallScore}
            breakdown={baselineFit.breakdown}
          />
        </motion.div>
      )}
    </div>
  )
}


