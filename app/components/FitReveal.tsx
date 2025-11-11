'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FitRevealProps {
  score: number
  onDone: () => void
}

export function FitReveal({ score, onDone }: FitRevealProps) {
  useEffect(() => {
    const t = setTimeout(() => onDone(), 2000)
    return () => clearTimeout(t)
  }, [onDone])

  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)))
  const message = clamped < 60
    ? "We can level this up — let's focus where it matters most."
    : clamped < 80
    ? "Solid foundation. A few smart tweaks will push this over the line."
    : "Strong showing. We'll polish the edges and make it undeniable."

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center justify-center"
      >
        <div className="text-center bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl shadow-default px-8 py-10 w-full">
          <div className="text-5xl font-extrabold text-gray-900 mb-2">
            {clamped}/100
          </div>
          <div className="text-gray-800 text-lg mb-2">
            Your résumé score for this role
          </div>
          <div className="text-sm text-gray-600">
            {message}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}


