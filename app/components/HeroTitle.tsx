'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RightfitLogo } from './RightfitLogo'

interface HeroTitleProps {
  isInputFocused?: boolean
}

export function HeroTitle({ isInputFocused = false }: HeroTitleProps) {
  const [showSecondLine, setShowSecondLine] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSecondLine(true)
    }, 2000) // Show second line after 2 seconds

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="text-center mb-4 lg:mb-5">
      {/* Logo */}
      <div className="flex items-center justify-center mb-4 lg:mb-6">
        <RightfitLogo />
      </div>

      {/* Hero Title */}
      <div className="relative mb-3 lg:mb-4 min-h-[180px] lg:min-h-[220px] flex flex-col items-center justify-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: isInputFocused ? 0.4 : showSecondLine ? 0.85 : 1,
            y: 0
          }}
          transition={{ 
            duration: 1.2, 
            ease: [0.25, 0.1, 0.25, 1],
            opacity: { duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }
          }}
          className="text-3xl lg:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 mb-2"
          style={{ 
            fontWeight: 600, 
            letterSpacing: '-0.02em',
            textShadow: '0 0 20px rgba(0, 0, 0, 0.03)'
          }}
        >
          Find out why recruiters skip your résumé.
        </motion.div>

        <div className="h-16 lg:h-20 flex items-start justify-center">
          <AnimatePresence>
            {showSecondLine && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ 
                  opacity: isInputFocused ? 0.4 : 1,
                  y: 0
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 1.2, 
                  ease: [0.25, 0.1, 0.25, 1],
                  delay: 0.3
                }}
                className="text-3xl lg:text-5xl xl:text-6xl font-semibold tracking-tight"
                style={{
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  background: 'var(--gradient-brand)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 8px rgba(165, 134, 234, 0.2))',
                }}
              >
                and fix it, today!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: isInputFocused ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
        className="text-sm lg:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed"
      >
        Honest feedback and precise improvements — no fluff. Just truth and clarity so you can stand out where it matters.
      </motion.p>
    </div>
  )
}

