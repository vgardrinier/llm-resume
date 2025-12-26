'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { ResumeAnalysis } from '@/types/api'
import { CheckCircle2, XCircle, ArrowUp, TrendingUp, Target, Lightbulb } from 'lucide-react'

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
  mode?: 'fast' | 'deep'
  onStartOver: () => void
  onRunFullAnalysis?: () => void
}

export function TheBrain({
  analysis,
  salary,
  changesCount,
  acceptedCount,
  rejectedCount,
  mode = 'deep',
  onStartOver,
  onRunFullAnalysis
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
      {/* Fast Mode Header */}
      {mode === 'fast' && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: INITIAL_DELAY }}
          className="backdrop-blur-md bg-gradient-to-r from-gray-900 to-gray-700 border border-gray-800 shadow-[0_4px_30px_rgba(0,0,0,0.2)] rounded-2xl p-6 text-white"
        >
          <h2 className="text-lg font-semibold mb-2 font-serif">
            Quick Optimize
          </h2>
          <p className="text-sm text-gray-200 font-sans">
            Your CV has been optimized with high-impact changes. Want deeper insights? Run Full Analysis to see fit scores, diagnostics, and salary data.
          </p>
        </motion.div>
      )}

      {/* Fit Score Card - Only show in Deep Mode */}
      {mode === 'deep' && (
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
      )}

      {/* Strengths We Found - Only show in Deep Mode */}
      {mode === 'deep' && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT }}
          className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
        >
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2 font-serif">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Strengths We Found
          </h3>
          <ul className="space-y-2">
            {(analysis.whatWorks || []).map((item, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2 font-sans">
                <span className="text-green-600 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Gaps to Close for This Role - Only show in Deep Mode */}
      {mode === 'deep' && (analysis.whatsMissing || []).length > 0 && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 2 }}
          className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
        >
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2 font-serif">
            <XCircle className="h-5 w-5 text-amber-600" />
            Gaps to Close for This Role
          </h3>
          <ul className="space-y-2">
            {(analysis.whatsMissing || []).map((item, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2 font-sans">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Keywords & Themes - Only show in Deep Mode */}
      {mode === 'deep' && (analysis.keywordsToTarget?.jobThemes?.length > 0 ||
        analysis.keywordsToTarget?.resumeThemes?.length > 0 ||
        analysis.keywordsToTarget?.missingThemes?.length > 0) && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 3 }}
          className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
        >
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2 font-serif">
            <Target className="h-5 w-5 text-blue-600" />
            Keywords &amp; Themes
          </h3>

          {/* Job Themes */}
          {analysis.keywordsToTarget?.jobThemes?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-2 font-sans font-medium">
                JOB REQUIRES
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.keywordsToTarget.jobThemes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium font-sans"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resume Themes */}
          {analysis.keywordsToTarget?.resumeThemes?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-2 font-sans font-medium">
                YOUR CURRENT SIGNALS
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.keywordsToTarget.resumeThemes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium font-sans"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Themes */}
          {analysis.keywordsToTarget?.missingThemes?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2 font-sans font-medium">
                MISSING (WE'LL ADDRESS)
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.keywordsToTarget.missingThemes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-300 text-gray-600 rounded-full text-xs font-medium font-sans"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Why We Made These Changes */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: INITIAL_DELAY + CARD_DELAY_INCREMENT * 4 }}
        className="backdrop-blur-md bg-white/60 border border-gray-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)] rounded-2xl p-6"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2 font-serif">
          <Lightbulb className="h-5 w-5 text-purple-600" />
          Why We Made These Changes
        </h3>
        <div className="text-sm text-gray-700 leading-relaxed font-sans space-y-3">
          {analysis.rationaleForChanges.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </motion.div>

      {/* Salary (if available) - Only show in Deep Mode */}
      {mode === 'deep' && salary && salary.median && (
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
          {salary.range && salary.range.length === 2 && (
            <div className="text-xs text-gray-500 mt-2 font-sans">
              Range: ${salary.range[0].toLocaleString()} – ${salary.range[1].toLocaleString()}
            </div>
          )}
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

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Run Full Analysis - Only show in Fast Mode */}
        {mode === 'fast' && onRunFullAnalysis && (
          <button
            onClick={onRunFullAnalysis}
            className="w-full bg-gradient-to-r from-gray-900 to-gray-700 text-white py-3 px-6 rounded-xl hover:from-gray-800 hover:to-gray-600 transition-all shadow-lg font-sans text-sm font-medium"
          >
            Run Full Analysis
          </button>
        )}

        {/* Start Over Button */}
        <button
          onClick={onStartOver}
          className="w-full text-center text-gray-600 hover:text-gray-800 underline text-sm transition-colors font-sans"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
