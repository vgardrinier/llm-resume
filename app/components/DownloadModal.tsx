'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, FileText, Share2 } from 'lucide-react'
import { Button } from './Button'

interface DownloadModalProps {
  isOpen: boolean
  onClose: () => void
  onDownload: (format: 'pdf' | 'word', feedback: FeedbackData) => void
}

export interface FeedbackData {
  usefulnessRating: number
  pricingPreference: 'one-off' | 'subscription'
}

export function DownloadModal({ isOpen, onClose, onDownload }: DownloadModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [usefulnessRating, setUsefulnessRating] = useState<number>(3)
  const [pricingPreference, setPricingPreference] = useState<'one-off' | 'subscription' | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Handle body scroll lock when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      // Restore body scroll when modal closes
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsefulnessRating(Number(e.target.value))
  }

  const handleNext = () => {
    // Only proceed if pricing is selected (button should be disabled otherwise)
    if (!pricingPreference) return
    setStep(2)
  }

  const handleDownload = (format: 'pdf' | 'word') => {
    const feedback: FeedbackData = {
      usefulnessRating,
      pricingPreference: pricingPreference!
    }
    
    // Log feedback to console for now
    console.log('User Feedback:', feedback)
    
    onDownload(format, feedback)
  }

  const handleShare = (platform: 'whatsapp' | 'email') => {
    const shareText = 'Check out Rightfit - AI-powered resume optimization for your dream job!'
    const shareUrl = 'https://rightfit.xyz'
    
    if (platform === 'whatsapp') {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
      window.open(whatsappUrl, '_blank')
    } else if (platform === 'email') {
      const emailSubject = 'Check out Rightfit'
      const emailBody = `${shareText}\n\n${shareUrl}`
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
      window.open(mailtoUrl, '_blank')
    }
  }

  const handleClose = () => {
    setStep(1) // Reset to step 1 when closing
    onClose()
  }

  const ratingLabels = ['Not useful', 'Slightly useful', 'Somewhat useful', 'Useful', 'Very useful', 'Extremely useful']

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center py-12 px-6 md:py-16 md:px-8 pointer-events-none"
          >
            <div 
              className="bg-white/95 backdrop-blur-md border border-gray-200/50 shadow-default rounded-2xl w-full max-w-2xl max-h-full flex flex-col pointer-events-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
                <h2 className="text-2xl font-semibold text-gray-900 font-serif">Your resume is ready</h2>
                <div className="flex items-center gap-3">
                  {step === 1 && (
                    <Button
                      onClick={handleNext}
                      variant="gradient"
                      disabled={!pricingPreference}
                      className={`flex items-center justify-center gap-2 transition-opacity ${
                        !pricingPreference ? 'opacity-40 cursor-not-allowed' : 'opacity-100'
                      }`}
                    >
                      Get Resume
                    </Button>
                  )}
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8">
                {step === 1 ? (
                  // Step 1: Feedback
                  <div className="space-y-6 pb-4">
                {/* Usefulness Rating */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 font-sans">
                    How useful was Rightfit for you?
                  </label>
                  <div className="space-y-3">
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={usefulnessRating}
                      onChange={handleSliderChange}
                      onMouseDown={() => setIsDragging(true)}
                      onMouseUp={() => setIsDragging(false)}
                      onTouchStart={() => setIsDragging(true)}
                      onTouchEnd={() => setIsDragging(false)}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      style={{
                        background: `linear-gradient(to right, #1f2937 0%, #1f2937 ${(usefulnessRating / 5) * 100}%, #e5e7eb ${(usefulnessRating / 5) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-sans">0</span>
                      <motion.div
                        initial={false}
                        animate={{ scale: isDragging ? 1.05 : 1 }}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium font-sans shadow-md"
                      >
                        {usefulnessRating} - {ratingLabels[usefulnessRating]}
                      </motion.div>
                      <span className="text-xs text-gray-500 font-sans">5</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Preference */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 font-sans">
                      Which pricing would work for you?
                    </label>
                    <p className="text-xs text-gray-500 font-sans mt-1">
                      This is free — just feedback for our final product
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* One-off */}
                    <motion.button
                      onClick={() => setPricingPreference('one-off')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-6 rounded-xl border-2 transition-all ${
                        pricingPreference === 'one-off'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900 font-serif">One-off</h3>
                          <div className="text-2xl font-bold text-gray-900 font-serif">$19</div>
                        </div>
                        <p className="text-sm text-gray-600 font-sans text-left">1 job description</p>
                        <ul className="space-y-1 text-xs text-gray-600 font-sans text-left">
                          <li>• Up to 5 iterations</li>
                          <li>• Full rewrite + fit score</li>
                          <li>• PDF & Word formats</li>
                        </ul>
                      </div>
                      {pricingPreference === 'one-off' && (
                        <motion.div
                          layoutId="pricing-selected"
                          className="absolute top-3 right-3 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                        >
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>

                    {/* Subscription */}
                    <motion.button
                      onClick={() => setPricingPreference('subscription')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-6 rounded-xl border-2 transition-all ${
                        pricingPreference === 'subscription'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900 font-serif">Subscription</h3>
                          <div className="text-xl font-bold text-gray-900 font-serif">$36<span className="text-sm font-normal text-gray-600">/mo</span></div>
                        </div>
                        <p className="text-sm text-gray-600 font-sans text-left">Unlimited job descriptions</p>
                        <ul className="space-y-1 text-xs text-gray-600 font-sans text-left">
                          <li>• 50 iterations per month</li>
                          <li>• Version history</li>
                          <li>• Cancel anytime</li>
                        </ul>
                      </div>
                      {pricingPreference === 'subscription' && (
                        <motion.div
                          layoutId="pricing-selected"
                          className="absolute top-3 right-3 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                        >
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  </div>
                </div>
                  </div>
                ) : (
                  // Step 2: Download & Share
                  <div className="space-y-6 pb-4">
                    {/* Download Format Selection */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-900 font-sans">
                        Choose your format
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          onClick={() => handleDownload('pdf')}
                          variant="gradient"
                          className="flex items-center justify-center gap-2 w-full min-h-[60px]"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                        <Button
                          onClick={() => handleDownload('word')}
                          variant="primary"
                          className="flex items-center justify-center gap-2 w-full min-h-[60px]"
                        >
                          <FileText className="h-4 w-4" />
                          Word
                        </Button>
                      </div>
                    </div>

                    {/* Share Section */}
                    <div className="pt-4 border-t border-gray-200/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Share2 className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500 font-sans">Share Rightfit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleShare('whatsapp')}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Share on WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleShare('email')}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Share via Email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Back Button */}
                    <div className="pt-4">
                      <button
                        onClick={() => setStep(1)}
                        className="text-sm text-gray-600 hover:text-gray-900 font-sans transition-colors"
                      >
                        ← Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

