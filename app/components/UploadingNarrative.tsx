'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadingNarrativeProps {
  jobDescription?: string
  companyNameHint?: string
  jobTitle?: string | null
  location?: string | null
  resume?: string
  isLoading?: boolean
}

interface BaselineScore {
  score: number
  breakdown: {
    keywordMatch: number
    themeAlignment: number
    experienceRelevance: number
    skillOverlap: number
  }
}

export function UploadingNarrative({ 
  jobDescription, 
  companyNameHint,
  jobTitle,
  location,
  resume,
  isLoading = true
}: UploadingNarrativeProps) {
  const [step, setStep] = useState(0)
  const [baselineScore, setBaselineScore] = useState<BaselineScore | null>(null)
  const [progress, setProgress] = useState(0)

  // Generic fallback beats
  const genericBeats = [
    "Analyzing your resume",
    "Finding key signals",
    "Tightening phrasing",
    "Finalizing edits"
  ]

  const [beats, setBeats] = useState<string[]>(genericBeats)

  // Reset state when loading starts
  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      setStep(0)
      setBaselineScore(null)
      setBeats(genericBeats)
    }
  }, [isLoading])

  // Fetch baseline score immediately and generate personalized beats
  useEffect(() => {
    if (!isLoading || !jobDescription || !resume) return
    
    let cancelled = false

    async function fetchBaseline() {
      try {
        const response = await fetch('/api/baseline-fit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_description: jobDescription,
            candidate_resume: resume
          })
        })

        if (!response.ok) throw new Error('Failed')
        const data = await response.json()
        if (!cancelled) {
          setBaselineScore(data)
          
          // Generate personalized beats based on score
          const score = data.score
          const breakdown = data.breakdown
          
          // Find weakest area to focus on
          const areas = [
            { name: 'keywords', score: breakdown.keywordMatch },
            { name: 'themes', score: breakdown.themeAlignment },
            { name: 'experience', score: breakdown.experienceRelevance },
            { name: 'skills', score: breakdown.skillOverlap }
          ]
          const weakest = areas.sort((a, b) => a.score - b.score)[0]
          
          // Personalized beats
          const personalizedBeats = [
            "Analyzing your resume",
            weakest.name === 'keywords' ? "Adding missing keywords" :
            weakest.name === 'themes' ? "Strengthening key themes" :
            weakest.name === 'experience' ? "Highlighting experience" :
            "Matching skills",
            "Tightening phrasing",
            "Finalizing edits"
          ]
          
          setBeats(personalizedBeats)
        }
      } catch (error) {
        console.warn('[Loading] Baseline score failed:', error)
      }
    }

    fetchBaseline()
    return () => { cancelled = true }
  }, [jobDescription, resume, isLoading])

  // Simple progress: steady increment to 90%, ease to 100% when done
  const progressRef = useRef(0)
  
  useEffect(() => {
    if (!isLoading) {
      // Animate from current to 100 over 300ms
      const current = progressRef.current
      const start = Date.now()
      const duration = 300

      const interval = setInterval(() => {
        const elapsed = Date.now() - start
        const t = Math.min(elapsed / duration, 1)
        const eased = t * t * (3 - 2 * t) // smoothstep easing
        const newProgress = Math.round(current + (100 - current) * eased)
        progressRef.current = newProgress
        setProgress(newProgress)
        
        if (t >= 1) clearInterval(interval)
      }, 16)

      return () => clearInterval(interval)
    }

    const start = Date.now()
    const targetDuration = 40000 // expect ~40s
    const maxProgress = 90 // cap at 90% until done

    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const calculated = Math.min((elapsed / targetDuration) * maxProgress, maxProgress)
      const rounded = Math.round(calculated)
      progressRef.current = rounded
      setProgress(rounded)
    }, 200)

    return () => clearInterval(interval)
  }, [isLoading])

  // Advance beats every 7 seconds
  useEffect(() => {
    if (!isLoading) return
    
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, beats.length - 1))
    }, 7000)
    
    return () => clearInterval(interval)
  }, [isLoading, beats.length])

  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (progress / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="backdrop-blur-sm bg-white/50 border border-gray-200 rounded-2xl shadow-sm px-6 py-6 max-w-lg w-full">
        {/* Progress ring */}
        <div className="relative flex justify-center mb-6">
          <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
            <circle 
              cx="32" 
              cy="32" 
              r={radius} 
              fill="none" 
              stroke="#e5e7eb" 
              strokeWidth="3" 
            />
            <circle
              cx="32" 
              cy="32" 
              r={radius} 
              fill="none"
              stroke="#1e293b" 
              strokeWidth="3" 
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-900 font-medium">
            {progress}%
          </div>
        </div>

        {/* Beat text */}
        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-base text-gray-700 leading-relaxed"
            >
              {beats[step]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Baseline score - tiny, ghosted, personalized */}
        {baselineScore && isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-6 pt-4 border-t border-gray-200/50 text-center"
          >
            <p className="text-sm text-gray-500">
              Current fit: <span className="font-medium text-gray-700">{baselineScore.score}/100</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {baselineScore.score < 50 ? "We'll get you there" :
               baselineScore.score < 70 ? "Improving it now" :
               "Making it stronger"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
