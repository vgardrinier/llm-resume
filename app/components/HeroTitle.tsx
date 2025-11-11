'use client'

import { useState, useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'

interface HeroTitleProps {
  isInputFocused?: boolean
  animated?: boolean
}

const headline = "Recruiters keep skipping your résumé?"
const subtitle = "We'll help you fix it."
const words = headline.split(' ')
const lineHeight = 'text-3xl lg:text-5xl xl:text-6xl'
const STAGGER_DELAY_MS = 100
const TRANSITION_DURATION_MS = 400

export function HeroTitle({ isInputFocused = false, animated = true }: HeroTitleProps) {
  const [mounted, setMounted] = useState(false)
  const [showSubtitle, setShowSubtitle] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = animated && !prefersReducedMotion

  // Trigger animation on mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show subtitle after headline animation completes
  useEffect(() => {
    if (!animated || prefersReducedMotion) {
      setShowSubtitle(true)
      return
    }

    if (!mounted) return

    // Calculate delay: number of words * stagger delay + transition duration
    const totalDelay = words.length * STAGGER_DELAY_MS + TRANSITION_DURATION_MS
    const timeoutId = setTimeout(() => {
      setShowSubtitle(true)
    }, totalDelay)

    return () => clearTimeout(timeoutId)
  }, [animated, prefersReducedMotion, mounted])

  return (
    <div className="text-center pb-4 lg:pb-6">
      {/* Hero Title */}
      <div 
        className="relative flex flex-col items-center justify-start"
        style={{ minHeight: '180px' }}
      >
        {/* Fixed height container to prevent layout shift */}
        <div 
          className="w-full max-w-full px-4 flex flex-col items-center justify-center"
          style={{ minHeight: '180px' }}
        >
          {/* Headline with staggered word reveal */}
          <h1 
            className={`${lineHeight} font-semibold tracking-tight text-gray-900 font-serif break-words text-center ${isInputFocused ? 'opacity-40' : ''}`}
            style={{
              fontWeight: 600,
              letterSpacing: '-0.02em',
              textShadow: '0 0 20px rgba(0, 0, 0, 0.03)',
            }}
          >
            {words.map((word, index) => {
              const delayMs = index * STAGGER_DELAY_MS
              const isVisible = !shouldAnimate || (shouldAnimate && mounted)
              
              return (
                <span
                  key={index}
                  className={`inline-block transition-all duration-[400ms] ease-out ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={shouldAnimate && mounted ? {
                    transitionDelay: `${delayMs}ms`,
                  } : undefined}
                >
                  {word}
                  {index < words.length - 1 && '\u00A0'}
                </span>
              )
            })}
          </h1>

          {/* Subtitle - fades in after headline completes */}
          <p
            className={`text-xl lg:text-2xl xl:text-3xl font-semibold tracking-tight text-gray-900 font-serif mt-4 transition-opacity duration-[400ms] ease-out ${
              shouldAnimate && !showSubtitle ? 'opacity-0' : 'opacity-100'
            } ${isInputFocused ? 'opacity-40' : ''}`}
            style={{
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}
