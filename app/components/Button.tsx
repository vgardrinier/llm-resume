'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'gradient'
  loading?: boolean
  loadingText?: string
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  loadingText,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'px-6 py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed relative'
  
  const variantStyles = {
    primary: 'bg-white text-gray-900 border-2 border-gray-900 hover:bg-gray-50',
    secondary: 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200',
    gradient: 'bg-white text-gray-900',
  }

  const isGradient = variant === 'gradient'

  if (isGradient && !disabled && !loading) {
    return (
      <motion.div
        className="inline-block"
        style={{
          background: 'var(--gradient-brand)',
          padding: '2px',
          borderRadius: '9999px',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.button
          className={`${baseStyles} ${variantStyles[variant]} ${className}`}
          disabled={disabled || loading}
          {...props}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div>
              {loadingText && <span>{loadingText}</span>}
            </div>
          ) : (
            children
          )}
        </motion.button>
      </motion.div>
    )
  }

  return (
    <motion.button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div>
          {loadingText && <span>{loadingText}</span>}
        </div>
      ) : (
        children
      )}
    </motion.button>
  )
}

