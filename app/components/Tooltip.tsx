'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  delay?: number
  className?: string
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top',
  align = 'center',
  delay = 300,
  className = ''
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true)
    }, delay)
    setTimeoutId(id)
  }

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  const getPositionClasses = () => {
    if (position === 'top' || position === 'bottom') {
      const alignClasses = {
        left: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
        right: 'right-0'
      }
      const verticalClass = position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      return `${verticalClass} ${alignClasses[align]}`
    }
    // For left/right positions, align doesn't apply
    if (position === 'left') return 'right-full top-1/2 -translate-y-1/2 mr-2'
    if (position === 'right') return 'left-full top-1/2 -translate-y-1/2 ml-2'
    return ''
  }

  const getArrowClasses = () => {
    if (position === 'top' || position === 'bottom') {
      const alignClasses = {
        left: 'left-3',
        center: 'left-1/2 -translate-x-1/2',
        right: 'right-3'
      }
      const verticalClass = position === 'top' 
        ? 'top-full border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent'
        : 'bottom-full border-b-gray-900 border-l-transparent border-r-transparent border-t-transparent'
      return `${verticalClass} ${alignClasses[align]}`
    }
    if (position === 'left') return 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-t-transparent border-b-transparent border-r-transparent'
    if (position === 'right') return 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-t-transparent border-b-transparent border-l-transparent'
    return ''
  }

  // Check if child is disabled
  const isDisabled = (children as any)?.props?.disabled
  
  return (
    <div 
      className={`relative inline-flex ${className}`}
      onMouseEnter={!isDisabled ? showTooltip : undefined}
      onMouseLeave={!isDisabled ? hideTooltip : undefined}
      onFocus={!isDisabled ? showTooltip : undefined}
      onBlur={!isDisabled ? hideTooltip : undefined}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className={`absolute z-50 ${getPositionClasses()} pointer-events-none`}
            role="tooltip"
          >
            <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap font-sans">
              {content}
              {/* Arrow */}
              <div className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

