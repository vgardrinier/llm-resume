'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { InsightCard } from './InsightCard'

interface ChatNarratorProps {
  insights: any
}

export function ChatNarrator({ insights }: ChatNarratorProps) {
  const [steps, setSteps] = useState<Array<{ type: string; payload?: any }>>([])
  const [revealed, setRevealed] = useState<number>(0)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const build: Array<{ type: string; payload?: any }> = []
    // 0) Initial Fit Score reveal (centered, emotional hook)
    if (insights.fit && typeof insights.fit.score_after === 'number') {
      const score = Math.max(0, Math.min(100, Math.round(insights.fit.score_after)))
      let note = "Strong showing. We'll polish the edges and make it undeniable."
      if (score < 60) note = "We can level this up — let's focus where it matters most."
      else if (score < 80) note = "Solid foundation. A few smart tweaks will push this over the line."
      build.push({ type: 'fit-reveal', payload: { score, note } })
      // Score statement as part of intro
      build.push({ type: 'msg', payload: `Your résumé scored ${score}/100 for this role.` })
    }

    // 1) Intro sets tone
    build.push({
      type: 'msg',
      payload:
        "Let's be real — your résumé had good bones. We stripped the fluff and aligned it to what this role values."
    })

    // 1.5) Acknowledge optimizations early so users know what's improved
    if (Array.isArray(insights.optimizations) && insights.optimizations.length > 0) {
      build.push({ type: 'msg', payload: 'First, we tightened the language and sharpened outcomes. Here’s how it got stronger.' })
    }

    // 2) Salary (soft dopamine)
    if (insights.salary) {
      const s = insights.salary
      build.push({ type: 'msg', payload: `First, the money in ${s.location}: $${s.median.toLocaleString()} (range $${s.range[0].toLocaleString()}–$${s.range[1].toLocaleString()}).` })
      build.push({ type: 'card-salary', payload: s })
    }

    // 3) Fit (analytical validation)
    if (insights.fit) {
      const f = insights.fit
      build.push({ type: 'msg', payload: `Your fit moved from ${f.score_before}% → ${f.score_after}%. Here's what changed.` })
      build.push({ type: 'card-fit', payload: f })
    }

    // 4) Reinforce that the detailed list is below
    if (Array.isArray(insights.optimizations) && insights.optimizations.length > 0) {
      build.push({ type: 'msg', payload: 'You can skim the full change list below when you’re ready.' })
    }

    // 5) Themes/keywords (supporting evidence)
    if (insights.keywords && insights.keywords.length > 0) {
      build.push({ type: 'msg', payload: 'You now hit the terms recruiters skim for.' })
      build.push({ type: 'card-keywords', payload: insights.keywords })
    }
    if (insights.themes && insights.themes.length > 0) {
      build.push({ type: 'msg', payload: 'And the storylines it emphasizes:' })
      build.push({ type: 'card-themes', payload: insights.themes })
    }

    // 6) Wrap-up
    if (insights.fit) {
      build.push({ type: 'msg', payload: `You're now ${insights.fit.score_after}% aligned. Ready to see it?` })
    }

    setSteps(build)
    setRevealed(1) // show the first step immediately (fit-reveal if present, else intro)
  }, [insights])

  // Removed automatic scroll-to-bottom to prevent jarring jumps

  // Auto-advance from the fit-reveal to the next narrator step for a smooth start
  useEffect(() => {
    if (steps.length === 0) return
    if (steps[0]?.type !== 'fit-reveal') return
    if (revealed !== 1) return
    const t = setTimeout(() => {
      setRevealed(prev => Math.min(prev + 1, steps.length))
    }, 1600)
    return () => clearTimeout(t)
  }, [steps, revealed])

  const randomDelayMs = () => Math.round(1000 + Math.random() * 600) // 1.0s–1.6s

  const revealNext = () => {
    if (revealed >= steps.length) return
    const currentIndex = revealed
    setRevealed(currentIndex + 1)

    // If next item is a card for the message we just revealed, auto-reveal after a small human cadence
    const justRevealed = steps[currentIndex]
    const upcoming = steps[currentIndex + 1]
    if (justRevealed && justRevealed.type === 'msg' && upcoming && upcoming.type.startsWith('card-')) {
      const delay = randomDelayMs()
      setTimeout(() => {
        setRevealed(prev => Math.min(prev + 1, steps.length))
      }, delay)
    }
  }

  // no auto-reveal beyond intro; user-driven pacing

  return (
    <div className="bg-gradient-to-br from-orange-50 via-purple-50 to-blue-50 rounded-xl shadow-xl p-6 relative">
      {typeof insights?.fit?.score_after === 'number' && (
        <div className="absolute top-3 right-3">
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow ring-2 ring-white">
            <span className="text-sm font-bold">{Math.round(insights.fit.score_after)}</span>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {steps.slice(0, revealed).map((s, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {s.type === 'fit-reveal' && (
              <div className="flex items-center justify-center">
                <div className="text-center bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl shadow px-6 py-8 w-full">
                  <div className="text-5xl font-extrabold text-gray-900 mb-1">{s.payload.score}/100</div>
                  <div className="text-gray-800 text-base mb-1">Your résumé score for this role</div>
                  <div className="text-sm text-gray-600">{s.payload.note}</div>
                </div>
              </div>
            )}
            {s.type === 'msg' && (
              <div className="bg-white/80 border border-purple-100 rounded-lg p-3 text-sm text-gray-800">
                {s.payload}
              </div>
            )}
            {s.type === 'card-salary' && (
              <InsightCard type="salary" title="Salary" data={s.payload} collapsed />
            )}
            {s.type === 'card-fit' && (
              <InsightCard type="fit" title="Fit" data={s.payload} collapsed />
            )}
            {s.type === 'card-keywords' && (
              <InsightCard type="keywords" title="Keywords" data={s.payload} />
            )}
            {s.type === 'card-themes' && (
              <InsightCard type="themes" title="Themes" data={s.payload} />
            )}
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>

      {revealed < steps.length && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={revealNext}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Next insight →
          </button>
        </div>
      )}
    </div>
  )
}


