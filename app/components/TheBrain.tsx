'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { ResumeAnalysis } from '@/types/api'
import { CheckCircle2, XCircle, ArrowUp, TrendingUp } from 'lucide-react'

interface TheBrainProps {
  analysis: ResumeAnalysis
  salary?: {
    median: number
    range: [number, number]
    location: string
    role: string
    comment: string
  }
  changesCount: number
  acceptedCount: number
  rejectedCount: number
  onStartOver: () => void
}

export function TheBrain({
  analysis,
  salary,
  changesCount,
  acceptedCount,
  rejectedCount,
  onStartOver
}: TheBrainProps) {
  const improvement = analysis.fitScoreAfter - analysis.fitScoreBefore
  
  // Animated score counter
  const [animatedScore, setAnimatedScore] = useState(analysis.fitScoreBefore)
  
  useEffect(() => {
    // Animate from before to after score
    const from = analysis.fitScoreBefore
    const to = analysis.fitScoreAfter
    
    // If scores are the same, no animation needed
    if (from === to) {
      setAnimatedScore(to)
      return
    }
    
    const duration = 1500 // 1.5s animation
    const stepCount = 30
    const increment = (to - from) / stepCount
    const intervalTime = duration / stepCount
    
    let current = from
    const interval = setInterval(() => {
      current += increment
      if ((increment > 0 && current >= to) || (increment < 0 && current <= to)) {
        setAnimatedScore(to)
        clearInterval(interval)
      } else {
        setAnimatedScore(Math.round(current))
      }
    }, intervalTime)
    
    return () => clearInterval(interval)
  }, [analysis.fitScoreBefore, analysis.fitScoreAfter])

  // Animation timing constants
  const ANIMATION_DURATION = 0.8
  const ANIMATION_EASING = [0.22, 1, 0.36, 1] as const
  const CARD_DELAY_INCREMENT = 0.3 // Delay between each card reveal
  const INITIAL_DELAY = 0.2 // First card delay

  // Animation variants for smoother progressive reveal
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 40,
      scale: 0.9,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: ANIMATION_DURATION,
        ease: ANIMATION_EASING,
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Fit Score Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4 font-serif">
          Overall Fit Score
        </h2>

        {/* Before → After */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <div className="text-3xl font-semibold text-gray-400 font-serif">
              {analysis.fitScoreBefore}
            </div>
            <div className="text-xs text-gray-500 font-sans">Before</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-gray-300" />
            <ArrowUp className="h-5 w-5 text-green-600" />
            <div className="h-px w-8 bg-gray-300" />
          </div>

          <div className="text-center">
            <motion.div 
              key={animatedScore}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.3 }}
              className="text-4xl font-semibold text-green-600 font-serif"
            >
              {animatedScore}
            </motion.div>
            <div className="text-xs text-gray-500 font-sans">After</div>
          </div>
        </div>

        {/* Improvement Badge */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-700" />
          <span className="text-sm font-medium text-green-900 font-sans">
            +{improvement} points improvement
          </span>
        </div>

        {/* Subscores */}
        {analysis.subscores && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-2 font-sans">
              Breakdown
            </div>
            {Object.entries(analysis.subscores.after).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 capitalize font-sans">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-sans">
                    {analysis.subscores.before[key as keyof typeof analysis.subscores.before]}
                  </span>
                  <span className="text-gray-300">→</span>
                  <span className="font-medium text-gray-900 font-sans">{value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* What Works */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 font-sans">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          What Works
        </h3>
        <ul className="space-y-2">
          {analysis.whatWorks.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-700 flex gap-2 font-sans">
              <span className="text-green-600 flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* What's Missing */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 2 }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 font-sans">
          <XCircle className="h-4 w-4 text-amber-600" />
          What's Missing
        </h3>
        <ul className="space-y-2">
          {analysis.whatsMissing.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-700 flex gap-2 font-sans">
              <span className="text-amber-600 flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Keywords to Target */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 3 }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3 font-sans">
          Keywords & Themes
        </h3>
        <div className="space-y-3">
          {analysis.keywordsToTarget.verbs.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1 font-sans">Action Verbs</div>
              <div className="flex flex-wrap gap-1">
                {analysis.keywordsToTarget.verbs.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-sans"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.keywordsToTarget.techStack.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1 font-sans">Tech Stack</div>
              <div className="flex flex-wrap gap-1">
                {analysis.keywordsToTarget.techStack.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-sans"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.keywordsToTarget.concepts.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1 font-sans">Key Concepts</div>
              <div className="flex flex-wrap gap-1">
                {analysis.keywordsToTarget.concepts.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-sans"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Rationale */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 4 }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-2 font-sans">
          Rationale for Changes
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed font-sans">
          {analysis.rationaleForChanges}
        </p>
      </motion.div>

      {/* Salary (if available) */}
      {salary && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 5 }}
          className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-gray-900 mb-2 font-sans">
            Market Context
          </h3>
          <div className="text-2xl font-semibold text-gray-900 mb-1 font-serif">
            ${salary.median.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600 font-sans">
            Median salary for {salary.role} in {salary.location}
          </div>
          <div className="text-xs text-gray-500 mt-2 font-sans">
            Range: ${salary.range[0].toLocaleString()} – ${salary.range[1].toLocaleString()}
          </div>
        </motion.div>
      )}

      {/* Progress Tracker */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 6 }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3 font-sans">
          Your Progress
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-sans">Total suggestions</span>
            <span className="font-medium text-gray-900 font-sans">{changesCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-sans">Accepted</span>
            <span className="font-medium text-green-600 font-sans">{acceptedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-sans">Rejected</span>
            <span className="font-medium text-red-600 font-sans">{rejectedCount}</span>
          </div>
        </div>
      </motion.div>

      {/* Start Over Button */}
      <button
        onClick={onStartOver}
        className="w-full text-center text-gray-600 hover:text-gray-800 underline text-sm transition-colors font-sans"
      >
        Start over
      </button>
    </div>
  )
}
