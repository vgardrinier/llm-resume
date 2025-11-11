'use client'

import { Navbar } from '@/app/components/Navbar'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function About() {
  return (
    <div className="flex-1 bg-white font-serif">
      {/* Navbar */}
      <Navbar />

      <div className="container mx-auto px-4 lg:px-8 pt-8 pb-16 lg:pt-12 lg:pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              className="space-y-8 font-serif"
            >
              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-5xl lg:text-6xl font-semibold tracking-tight text-gray-900 font-serif"
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
                className="space-y-7 text-lg lg:text-xl text-gray-800 leading-[1.75] font-serif"
                style={{
                  letterSpacing: '-0.01em',
                }}
              >
                <p className="text-xl lg:text-2xl font-medium text-gray-900">
                  We don't sell dreams. We help you see clearly.
                </p>

                <p className="text-lg lg:text-xl">
                  Rightfit is built on one idea: truth helps you get hired faster than flattery. The app gives you honest feedback and precise improvements so your résumé shows what recruiters actually look for — not what random templates or "AI boosters" invent.
                </p>

                <p className="text-lg lg:text-xl">
                  It's not magic. It's clarity. It reduces the gap between what companies seek and what you already have. No buzzwords, no fake confidence, no promises we can't keep.
                </p>

                <p className="text-lg lg:text-xl">
                  For now, English works best (though most languages are supported).
                </p>

                <p className="pt-2 text-xl lg:text-2xl font-medium text-gray-900">
                  The goal is simple: to make hiring fairer by making you sharper.
                </p>
              </motion.div>
            </motion.div>

            {/* Right: Image */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative w-full h-[400px] lg:h-[600px] rounded-lg overflow-hidden shadow-default"
            >
              <Image
                src="/rightfit_background_about.png"
                alt="About Rightfit"
                fill
                className="object-cover"
                priority
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

