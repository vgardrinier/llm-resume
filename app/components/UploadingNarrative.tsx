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
    messages.push("Don't worry — I don't store your data. Just me, you, and your future recruiter 😎")
    messages.push(name
      ? `${name} — nice pick. Ambitious team, tight hiring bar. Let's make sure you clear it.`
      : "Good pick — tight hiring bar. Let's make sure your résumé clears it.")
    messages.push("Comparing your profile to top candidates in this role…\nAlmost there — I'm writing your personalized insights now.")
    return messages
  }, [derivedCompany])

  // Advance through beats up to the last one; then hold
  useEffect(() => {
    if (step >= beats.length - 1) return
    const t = setTimeout(() => setStep(s => Math.min(s + 1, beats.length - 1)), 2600)
    return () => clearTimeout(t)
  }, [step, beats])

  // Simple animated ring (decorative momentum)
  const progressRef = useRef<number>(0)
  const [progress, setProgress] = useState(0) // 0–100
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const duration = 10000 // ~10s to ~80%
    const tick = (ts: number) => {
      const e = Math.min(1, (ts - start) / duration)
      const val = Math.round(80 * e)
      progressRef.current = val
      setProgress(val)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (progress / 100) * circumference

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-xl shadow-lg p-6">
      <div className="flex items-start gap-4">
        {/* Progress ring */}
        <div className="shrink-0 relative">
          <svg width="72" height="72" viewBox="0 0 72 72" className="drop-shadow-sm">
            <circle cx="36" cy="36" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <motion.circle
              cx="36" cy="36" r={radius} fill="none"
              stroke="#4F46E5" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
              style={{ rotate: -90 as any }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs text-indigo-700 font-semibold">
            {progress}%
          </div>
        </div>

        {/* Narrative text */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className="bg-white/80 border border-purple-100 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-line"
            >
              {beats[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}


