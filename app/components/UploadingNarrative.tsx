'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadingNarrativeProps {
  jobDescription?: string
  companyNameHint?: string
  jobTitle?: string | null
  location?: string | null
  resume?: string
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
  resume
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
  
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const rampDuration = 20000 // ~20s to ~98%
    const maxDuringLoad = 98
    const tick = (ts: number) => {
      const elapsed = ts - start
      if (elapsed <= rampDuration) {
        const e = Math.min(1, elapsed / rampDuration)
        const val = Math.round(maxDuringLoad * e)
        progressRef.current = val
        setProgress(val)
      } else {
        // Continue slowly to 100% while pulsing opacity
        const t2 = elapsed - rampDuration
        const slowRampDuration = 10000 // Additional 10s to reach 100%
        if (t2 <= slowRampDuration) {
          const e2 = Math.min(1, t2 / slowRampDuration)
          const val = Math.round(maxDuringLoad + (2 * e2)) // 98% -> 100%
          progressRef.current = val
          setProgress(val)
        } else {
          // Hold at 100% and pulse opacity
          progressRef.current = 100
          setProgress(100)
        }
        // Pulse opacity between 0.7 and 1.0 for "thinking" effect
        const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t2 / 1000))
        setRingOpacity(pulse)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Advance through beats synced with progress - faster initially, slower near end
  // Only start advancing once beats are loaded
  useEffect(() => {
    if (isGeneratingBeats || beats.length === 0) return
    if (step >= beats.length - 1) return
    
    // Distribute beats across progress range: 
    // Beat 0 -> 1: at 25% progress
    // Beat 1 -> 2: at 50% progress  
    // Beat 2 -> 3: at 75% progress
    // Beat 3 -> 4: at 90% progress
    // Beat 4 -> 5: at 98% progress (if exists)
    const progressThresholds = [25, 50, 75, 90, 98]
    const nextBeatThreshold = progressThresholds[Math.min(step, progressThresholds.length - 1)]
    
    // Check periodically if we've reached the threshold for the next beat
    const checkInterval = 100 // Check every 100ms
    const interval = setInterval(() => {
      if (progress >= nextBeatThreshold) {
        setStep(s => Math.min(s + 1, beats.length - 1))
        clearInterval(interval)
      }
    }, checkInterval)
    
    return () => clearInterval(interval)
  }, [step, beats, isGeneratingBeats, progress])

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
                  {beats[step]}
                </motion.p>
              </AnimatePresence>
              {step === beats.length - 1 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-3 text-sm text-gray-600 font-serif"
                >
                  Still working…
                </motion.p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


