'use client'

import { AlertCircle, X, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

interface ErrorAlertProps {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
  autoDismiss?: boolean
  dismissAfter?: number // milliseconds
  variant?: 'error' | 'warning' | 'info'
  className?: string
}

export function ErrorAlert({
  message,
  onDismiss,
  onRetry,
  autoDismiss = false,
  dismissAfter = 5000,
  variant = 'error',
  className = '',
}: ErrorAlertProps) {
  useEffect(() => {
    if (autoDismiss && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss()
      }, dismissAfter)
      return () => clearTimeout(timer)
    }
  }, [autoDismiss, dismissAfter, onDismiss])

  const variantStyles = {
    error: {
      bg: 'bg-red-50/90',
      border: 'border-red-200',
      text: 'text-red-900',
      icon: 'text-red-600',
      button: 'text-red-700 hover:text-red-900',
    },
    warning: {
      bg: 'bg-amber-50/90',
      border: 'border-amber-200',
      text: 'text-amber-900',
      icon: 'text-amber-600',
      button: 'text-amber-700 hover:text-amber-900',
    },
    info: {
      bg: 'bg-blue-50/90',
      border: 'border-blue-200',
      text: 'text-blue-900',
      icon: 'text-blue-600',
      button: 'text-blue-700 hover:text-blue-900',
    },
  }

  const styles = variantStyles[variant]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className={`backdrop-blur-md ${styles.bg} ${styles.border} border rounded-xl px-4 py-3 shadow-lg ${className}`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className={`h-5 w-5 ${styles.icon} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${styles.text} font-sans`}>
              {message}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`${styles.button} p-1 rounded-md hover:bg-black/5 transition-colors`}
                aria-label="Retry"
                title="Retry"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`${styles.button} p-1 rounded-md hover:bg-black/5 transition-colors`}
                aria-label="Dismiss"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}


