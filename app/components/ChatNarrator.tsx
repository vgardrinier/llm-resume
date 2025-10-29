'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { InsightCard } from './InsightCard'

interface ChatNarratorProps {
  insights: any
}

export function ChatNarrator({ insights }: ChatNarratorProps) {
  const [steps, setSteps] = useState<Array<{ type: string; payload?: any }>>([])
  const [revealed, setRevealed] = useState<number>(0)
  const [animatingScore, setAnimatingScore] = useState<number | null>(null)
  const [headerScore, setHeaderScore] = useState<number | null>(null)
  const [showingTransformed, setShowingTransformed] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Helper: Get score range category
  const getScoreRange = (score: number): 'low' | 'mid' | 'high' => {
    if (score < 50) return 'low'
    if (score < 76) return 'mid'
    return 'high'
  }

  // Helper: Generate contextual messaging based on initial score
  const generateContextualMessages = (scoreBefore: number, scoreAfter: number) => {
    const rangeBefore = getScoreRange(scoreBefore)
    const rangeAfter = getScoreRange(scoreAfter)
    const improvement = scoreAfter - scoreBefore

    const messages: any = {
      initial: {},
      validation: {},
      transformation: {},
      close: {}
    }

    // Initial reaction based on score_before
    if (rangeBefore === 'low') {
      messages.initial.reaction = "Alright, let's talk about your résumé."
      messages.initial.assessment = "You've got solid experience, but the way it's written? It's hiding your best work."
      messages.validation = "The bones are there — we just need to make recruiters see it in the first 6 seconds."
    } else if (rangeBefore === 'mid') {
      messages.initial.reaction = "Here's the thing about your résumé."
      messages.initial.assessment = "It's competent, but forgettable. And in a stack of 200 applications, forgettable gets you nowhere."
      messages.validation = "You've got the experience — we just need to make recruiters see it in the first 6 seconds."
    } else {
      messages.initial.reaction = "Okay, you're already in good shape."
      messages.initial.assessment = "Most candidates would kill for a résumé like yours. But 'good' doesn't get you the offer."
      messages.validation = "You're close. A few sharp tweaks and you'll be in the top 1% for this role."
    }

    // Transformation messaging
    if (improvement >= 20) {
      messages.transformation.setup = `So we made ${improvement} points worth of changes. Not surface-level stuff — real improvements.`
      messages.transformation.impact = "This is the kind of jump that moves you from 'maybe' to 'interview.'"
    } else if (improvement >= 10) {
      messages.transformation.setup = `We tightened ${improvement} points. Doesn't sound like much, but in résumé math? It's everything.`
      messages.transformation.impact = "These are the details that separate callbacks from silence."
    } else {
      messages.transformation.setup = `We moved you ${improvement} points. Small number, high leverage.`
      messages.transformation.impact = rangeAfter === 'high' ? "You were already strong — now you're undeniable." : "Every point counts when you're this close."
    }

    // Closing based on final score
    if (rangeAfter === 'high') {
      messages.close = `You're now ${scoreAfter}% aligned. This résumé competes.`
    } else if (rangeAfter === 'mid') {
      messages.close = `You're at ${scoreAfter}%. Solid position — ready to see the changes?`
    } else {
      messages.close = `We got you to ${scoreAfter}%. Not perfect, but way better positioned. Check it out.`
    }

    return messages
  }

  useEffect(() => {
    if (!insights?.fit) return

    const scoreBefore = Math.round(insights.fit.score_before ?? 0)
    const scoreAfter = Math.round(insights.fit.score_after ?? 0)

    const messages = generateContextualMessages(scoreBefore, scoreAfter)
    const build: Array<{ type: string; payload?: any }> = []

    // 1. INITIAL SCORE REVEAL (emotional hook)
    build.push({
      type: 'initial-score',
      payload: {
        score: scoreBefore,
        label: 'Your résumé scored'
      }
    })

    // 2. INITIAL REACTION (score-dependent)
    build.push({ type: 'msg', payload: messages.initial.reaction })
    build.push({ type: 'msg', payload: messages.initial.assessment })

    // 3. VALIDATION (builds confidence before showing transformation)
    build.push({ type: 'msg', payload: messages.validation })

    // 4. FIT SCORE TRANSFORMATION (animated reveal)
    build.push({ type: 'msg', payload: messages.transformation.setup })
    build.push({
      type: 'score-transform',
      payload: {
        from: scoreBefore,
        to: scoreAfter,
        subscores: insights.fit.subscores
      }
    })
    build.push({ type: 'msg', payload: messages.transformation.impact })

    // 5. SUPPORTING EVIDENCE (keywords & themes)
    if (insights.keywords && insights.keywords.length > 0) {
      const keywordIntro = scoreBefore < 50
        ? "Now you're hitting the terms recruiters actually scan for:"
        : "You're now aligned with the terms that get noticed:"
      build.push({ type: 'msg', payload: keywordIntro })
      build.push({ type: 'card-keywords', payload: insights.keywords })
    }

    if (insights.themes && insights.themes.length > 0) {
      build.push({ type: 'msg', payload: 'And the storylines we emphasized:' })
      build.push({ type: 'card-themes', payload: insights.themes })
    }

    // 6. SALARY CONTEXT (market reality check)
    if (insights.salary) {
      const s = insights.salary
      const salaryIntro = `Real talk on money: this role in ${s.location} pays around $${s.median.toLocaleString()}.`
      build.push({ type: 'msg', payload: salaryIntro })
      build.push({ type: 'card-salary', payload: s })
    }

    // 7. WHAT TO WATCH FOR (review notes reframed)
    if (insights.review_notes && insights.review_notes.length > 0) {
      build.push({ type: 'msg', payload: 'Double-check these changes - they pushed the limits:' })
      build.push({ type: 'card-review', payload: insights.review_notes })
    }

    // 8. MOTIVATING CLOSE
    build.push({ type: 'msg', payload: messages.close })

    // 9. REVEAL CTA
    build.push({ type: 'reveal-cta' })

    setSteps(build)
    setRevealed(1) // Show first step immediately
  }, [insights])

  // Auto-advance from initial score after 1.8s
  useEffect(() => {
    if (steps.length === 0) return
    if (steps[0]?.type !== 'initial-score') return
    if (revealed !== 1) return
    const t = setTimeout(() => {
      setRevealed(prev => Math.min(prev + 1, steps.length))
    }, 1800)
    return () => clearTimeout(t)
  }, [steps, revealed])

  const randomDelayMs = () => Math.round(1000 + Math.random() * 500) // 1.0s–1.5s

  const revealNext = () => {
    if (revealed >= steps.length) return
    const currentIndex = revealed
    setRevealed(currentIndex + 1)

    // If next item is a card or score-transform, auto-reveal after natural pause
    const justRevealed = steps[currentIndex]
    const upcoming = steps[currentIndex + 1]
    if (
      justRevealed &&
      justRevealed.type === 'msg' &&
      upcoming &&
      (upcoming.type.startsWith('card-') || upcoming.type === 'score-transform')
    ) {
      const delay = randomDelayMs()
      setTimeout(() => {
        setRevealed(prev => Math.min(prev + 1, steps.length))
      }, delay)
    }
  }

  // Animated score counter for transformation (both main card and header)
  useEffect(() => {
    const currentStep = steps[revealed - 1]
    if (currentStep?.type === 'score-transform') {
      const { from, to } = currentStep.payload
      setAnimatingScore(from)
      setHeaderScore(from)
      setShowingTransformed(true)

      const duration = 1500 // 1.5s animation
      const stepCount = 30
      const increment = (to - from) / stepCount
      const intervalTime = duration / stepCount

      // Guard: if there is no change, set once and exit to avoid useless updates
      if (increment === 0) {
        setAnimatingScore(to)
        setHeaderScore(to)
        return
      }

      let current = from
      const interval = setInterval(() => {
        current += increment
        if ((increment > 0 && current >= to) || (increment < 0 && current <= to)) {
          setAnimatingScore(to)
          setHeaderScore(to)
          clearInterval(interval)
        } else {
          const roundedCurrent = Math.round(current)
          setAnimatingScore(roundedCurrent)
          setHeaderScore(roundedCurrent)
        }
      }, intervalTime)

      return () => clearInterval(interval)
    }
  }, [revealed, steps])

  return (
    <div className="bg-gradient-to-br from-orange-50 via-purple-50 to-blue-50 rounded-xl shadow-xl p-6 relative">
      <div className="space-y-3">
        <AnimatePresence mode="sync">
          {steps.slice(0, revealed).map((s, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {/* Initial score reveal - updates during transformation */}
              {s.type === 'initial-score' && (
                <div className="flex items-center justify-center">
                  <div className="text-center bg-white border-2 border-indigo-200 rounded-2xl shadow-lg px-8 py-10 w-full">
                    <div className="text-gray-600 text-sm mb-2">
                      {showingTransformed ? 'Your improved résumé scored' : 'Your résumé scored'}
                    </div>
                    <motion.div
                      key={headerScore ?? s.payload.score}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, type: "spring" }}
                      className="text-6xl font-extrabold text-gray-900"
                    >
                      {headerScore ?? s.payload.score}/100
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Score transformation with animation */}
              {s.type === 'score-transform' && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-4xl font-bold text-gray-400">{s.payload.from}</div>
                    <div className="text-2xl text-gray-400">→</div>
                    <motion.div
                      key={animatingScore}
                      initial={{ scale: 1.2, color: '#818cf8' }}
                      animate={{ scale: 1, color: '#1e293b' }}
                      className="text-5xl font-extrabold"
                    >
                      {animatingScore ?? s.payload.to}
                    </motion.div>
                  </div>

                  {/* Subscores breakdown */}
                  {s.payload.subscores && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/60 rounded-lg p-2">
                        <div className="text-gray-600">Keywords</div>
                        <div className="font-semibold text-gray-800">
                          {s.payload.subscores.before.keywordMatch} → {s.payload.subscores.after.keywordMatch}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-2">
                        <div className="text-gray-600">Themes</div>
                        <div className="font-semibold text-gray-800">
                          {s.payload.subscores.before.themeAlignment} → {s.payload.subscores.after.themeAlignment}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-2">
                        <div className="text-gray-600">Experience</div>
                        <div className="font-semibold text-gray-800">
                          {s.payload.subscores.before.experienceRelevance} → {s.payload.subscores.after.experienceRelevance}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-2">
                        <div className="text-gray-600">Skills</div>
                        <div className="font-semibold text-gray-800">
                          {s.payload.subscores.before.skillOverlap} → {s.payload.subscores.after.skillOverlap}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Message bubbles */}
              {s.type === 'msg' && (
                <div className="bg-white/80 border border-purple-100 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
                  {s.payload}
                </div>
              )}

              {/* Insight cards */}
              {s.type === 'card-salary' && (
                <InsightCard type="salary" title="Market Context" data={s.payload} />
              )}
              {s.type === 'card-fit' && (
                <InsightCard type="fit" title="Fit Analysis" data={s.payload} collapsed />
              )}
              {s.type === 'card-keywords' && (
                <InsightCard type="keywords" title="ATS Keywords" data={s.payload} />
              )}
              {s.type === 'card-themes' && (
                <InsightCard type="themes" title="Themes" data={s.payload} />
              )}
              {s.type === 'card-review' && (
                <InsightCard type="review" title="Watch These" data={s.payload} />
              )}

              {/* Reveal CTA button */}
              {s.type === 'reveal-cta' && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger resume reveal in parent
                      const event = new CustomEvent('reveal-resume')
                      window.dispatchEvent(event)
                    }}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg text-base font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                  >
                    Show Me The Résumé →
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Next insight button */}
      {revealed < steps.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex justify-end"
        >
          <button
            type="button"
            onClick={revealNext}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm hover:shadow"
          >
            Continue →
          </button>
        </motion.div>
      )}
    </div>
  )
}
