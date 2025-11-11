'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadingNarrativeProps {
  jobDescription?: string
  companyNameHint?: string
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

export function UploadingNarrative({ jobDescription, companyNameHint }: UploadingNarrativeProps) {
  const derivedCompany = useMemo(() => companyNameHint || extractCompanyNameClient(jobDescription) || null, [jobDescription, companyNameHint])
  const [step, setStep] = useState(0)

  const beats = useMemo(() => {
    const name = derivedCompany
    const messages: string[] = []
    messages.push(name
      ? `Alright, let's get to work. I'm scanning your résumé and the job at ${name} now.`
      : "Alright, let's get to work. I'm scanning your résumé and the job details now.")
    messages.push("Privacy check: I don't store your résumé — it's processed only for this session.")
    messages.push(name
      ? `${name} — nice pick. Ambitious team, tight hiring bar. Let's make sure you clear it.`
      : "Good pick — tight hiring bar. Let's make sure your résumé clears it.")
    messages.push("Comparing your profile to top candidates in this role…")
    messages.push("Cross-checking themes, skills, and scope against what this role values.")
    messages.push("Almost there — writing your personalized insights now.")
    return messages
  }, [derivedCompany])

  // Advance through beats up to the last one; then hold
  useEffect(() => {
    if (step >= beats.length - 1) return
    const t = setTimeout(() => setStep(s => Math.min(s + 1, beats.length - 1)), 6000)
    return () => clearTimeout(t)
  }, [step, beats])

  // Simple animated ring (decorative momentum)
  const progressRef = useRef<number>(0)
  const [progress, setProgress] = useState(0) // 0–100
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const rampDuration = 20000 // ~20s to ~92% (5s slower)
    const maxDuringLoad = 92
    const tick = (ts: number) => {
      const elapsed = ts - start
      if (elapsed <= rampDuration) {
        const e = Math.min(1, elapsed / rampDuration)
        const val = Math.round(maxDuringLoad * e)
        progressRef.current = val
        setProgress(val)
      } else {
        // Subtle breathing between 90–95% while we wait
        const t2 = elapsed - rampDuration
        const oscill = 92 + 2 * Math.sin(t2 / 800)
        const val = Math.max(90, Math.min(95, Math.round(oscill)))
        progressRef.current = val
        setProgress(val)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

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
              transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-900 font-medium font-serif">
            {progress}%
          </div>
        </div>

        {/* Narrative text - clean, minimal */}
        <div className="text-center">
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
        </div>
      </div>
    </div>
  )
}


