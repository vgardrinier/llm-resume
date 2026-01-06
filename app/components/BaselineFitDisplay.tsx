'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Target, Users, Briefcase, Layers } from 'lucide-react'

interface BaselineFitDisplayProps {
  overallScore: number
  breakdown: {
    keywordMatch: number
    themeAlignment: number
    experienceRelevance: number
    skillOverlap: number
  }
}

export function BaselineFitDisplay({ overallScore, breakdown }: BaselineFitDisplayProps) {
  // Color coding based on score
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-50 border-green-200'
    if (score >= 50) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  const scoreColor = getScoreColor(overallScore)
  const scoreBgColor = getScoreBgColor(overallScore)

  const breakdownItems = [
    { label: 'Keywords', value: breakdown.keywordMatch, icon: Target },
    { label: 'Themes', value: breakdown.themeAlignment, icon: Layers },
    { label: 'Experience', value: breakdown.experienceRelevance, icon: Briefcase },
    { label: 'Skills', value: breakdown.skillOverlap, icon: Users },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="backdrop-blur-sm bg-white/50 border border-gray-200 rounded-2xl shadow-default p-4 sm:p-6"
    >
      {/* Header */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="text-xs sm:text-sm text-gray-600 mb-2 font-sans">
          Your Current Fit Score
        </div>
        <div className={`text-5xl sm:text-6xl font-bold ${scoreColor} mb-2 font-serif`}>
          {overallScore}
        </div>
        <div className="text-xs text-gray-500 font-sans">
          We're optimizing your résumé to improve this score...
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {breakdownItems.map((item, idx) => {
          const itemColor = getScoreColor(item.value)
          const itemBg = getScoreBgColor(item.value)
          const Icon = item.icon

          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
              className={`${itemBg} border rounded-lg p-2 sm:p-3`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${itemColor}`} />
                <div className="text-xs text-gray-600 font-sans">{item.label}</div>
              </div>
              <div className={`text-xl sm:text-2xl font-semibold ${itemColor} font-serif`}>
                {item.value}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Progress indicator */}
      <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-500">
        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 animate-pulse" />
        <span className="font-sans">Optimization in progress...</span>
      </div>
    </motion.div>
  )
}


