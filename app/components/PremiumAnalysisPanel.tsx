'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Target, Lightbulb } from 'lucide-react'

interface PremiumAnalysisPanelProps {
  whatWorks: string[]
  whatsMissing: string[]
  keywordsToTarget: {
    jobThemes?: string[]
    resumeThemes?: string[]
    missingThemes?: string[]
  }
  rationaleForChanges: string
}

export function PremiumAnalysisPanel({
  whatWorks,
  whatsMissing,
  keywordsToTarget,
  rationaleForChanges,
}: PremiumAnalysisPanelProps) {
  const jobThemes = keywordsToTarget.jobThemes || []
  const resumeThemes = keywordsToTarget.resumeThemes || []
  const missingThemes = keywordsToTarget.missingThemes || []

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* 1. Strengths We Found */}
      <div className="backdrop-blur-md bg-white/80 border border-gray-200 shadow-lg rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900 font-serif">
            Strengths We Found
          </h3>
        </div>
        <ul className="space-y-2">
          {whatWorks.map((strength, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-2 text-sm text-gray-700 font-sans"
            >
              <span className="text-green-600 mt-0.5">•</span>
              <span>{strength}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* 2. Gaps to Close for This Role */}
      {whatsMissing.length > 0 && (
        <div className="backdrop-blur-md bg-white/80 border border-gray-200 shadow-lg rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900 font-serif">
              Gaps to Close for This Role
            </h3>
          </div>
          <ul className="space-y-2">
            {whatsMissing.map((gap, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-2 text-sm text-gray-700 font-sans"
              >
                <span className="text-amber-600 mt-0.5">•</span>
                <span>{gap}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Keywords & Themes */}
      {(jobThemes.length > 0 || resumeThemes.length > 0 || missingThemes.length > 0) && (
        <div className="backdrop-blur-md bg-white/80 border border-gray-200 shadow-lg rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 font-serif">
              Keywords &amp; Themes
            </h3>
          </div>

          {/* Job Themes */}
          {jobThemes.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-2 font-sans font-medium">
                JOB REQUIRES
              </div>
              <div className="flex flex-wrap gap-2">
                {jobThemes.map((theme, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium font-sans"
                  >
                    {theme}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {/* Resume Themes */}
          {resumeThemes.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-2 font-sans font-medium">
                YOUR CURRENT SIGNALS
              </div>
              <div className="flex flex-wrap gap-2">
                {resumeThemes.map((theme, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium font-sans"
                  >
                    {theme}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Themes */}
          {missingThemes.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2 font-sans font-medium">
                MISSING (WE'LL ADDRESS)
              </div>
              <div className="flex flex-wrap gap-2">
                {missingThemes.map((theme, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-300 text-gray-600 rounded-full text-xs font-medium font-sans"
                  >
                    {theme}
                  </motion.span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Why We Made These Changes */}
      <div className="backdrop-blur-md bg-white/80 border border-gray-200 shadow-lg rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 font-serif">
            Why We Made These Changes
          </h3>
        </div>
        <div className="text-sm text-gray-700 leading-relaxed font-sans space-y-3">
          {rationaleForChanges.split('\n\n').map((paragraph, idx) => (
            <motion.p
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.15 }}
            >
              {paragraph}
            </motion.p>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

