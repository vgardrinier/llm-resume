'use client'

import { Navbar } from '@/app/components/Navbar'
import { motion } from 'framer-motion'

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <Navbar />

      <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-8"
          >
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900 text-center"
              style={{
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              About Rightfit
            </motion.h1>

            {/* Manifesto content */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="space-y-7 text-base lg:text-lg text-gray-800 leading-[1.75]"
              style={{
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 400,
                letterSpacing: '-0.01em',
              }}
            >
              <p className="text-lg lg:text-xl font-medium text-gray-900">
                We don't sell dreams. We help you see clearly.
              </p>

              <p>
                Rightfit is built on one idea: truth helps you get hired faster than flattery. The app gives you honest feedback and precise improvements so your résumé shows what recruiters actually look for — not what random templates or "AI boosters" invent.
              </p>

              <p>
                It's not magic. It's clarity. It reduces the gap between what companies seek and what you already have. No buzzwords, no fake confidence, no promises we can't keep.
              </p>

              <p>
                For now, English works best (though most languages are supported).
              </p>

              <p className="pt-2 text-lg lg:text-xl font-medium text-gray-900">
                The goal is simple: to make hiring fairer by making you sharper.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

