'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { RightfitLogo } from './RightfitLogo'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'

interface NavbarProps {
  jobUrl?: string
  uploadedFileName?: string
  onHomeClick?: () => void
}

export function Navbar({ jobUrl, uploadedFileName, onHomeClick }: NavbarProps) {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 50], [1, 0.7])

  const getDisplayHost = (url: string) => {
    try {
      const u = new URL(url)
      return u.hostname.replace('www.', '')
    } catch {
      return url.length > 32 ? url.slice(0, 29) + '…' : url
    }
  }

  return (
    <motion.div 
      className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-white/30"
      style={{ opacity }}
    >
      <div className="container mx-auto px-4 md:px-8 py-2 md:py-3 flex items-center justify-between gap-4">
        {/* Left side: Logo */}
        <div className="flex items-center md:ml-6">
          <Link 
            href="/" 
            className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
            onClick={(e) => {
              // If already on home page and we have a reset handler, call it instead of navigating
              if (isHomePage && onHomeClick) {
                e.preventDefault()
                onHomeClick()
              }
            }}
          >
            <RightfitLogo />
          </Link>
        </div>

        {/* Desktop: Job URL + Resume PDF - only show on home page when values exist */}
        {isHomePage && (jobUrl || uploadedFileName) && (
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 truncate font-serif">
            {jobUrl && (
              <>
                <span className="truncate">{getDisplayHost(jobUrl)}</span>
                {uploadedFileName && <span className="text-gray-300">•</span>}
              </>
            )}
            {uploadedFileName && (
              <span className="truncate">{uploadedFileName}</span>
            )}
          </div>
        )}

        {/* Mobile: Menu icon */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors min-h-[56px] min-w-[56px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-900" />
            ) : (
              <Menu className="h-6 w-6 text-gray-900" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-sm"
          >
            <div className="px-4 py-4 space-y-3">
              {isHomePage && (jobUrl || uploadedFileName) && (
                <div className="text-xs text-gray-500 font-serif">
                  {jobUrl && (
                    <div className="truncate mb-1">{getDisplayHost(jobUrl)}</div>
                  )}
                  {uploadedFileName && (
                    <div className="truncate">{uploadedFileName}</div>
                  )}
                </div>
              )}
              <Link
                href="/modes"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base text-gray-900 hover:text-gray-600 transition-colors font-serif py-2"
              >
                Modes
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base text-gray-900 hover:text-gray-600 transition-colors font-serif py-2"
              >
                About
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

