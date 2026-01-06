'use client'

import { Navbar } from '@/app/components/Navbar'
import { Check } from 'lucide-react'

export default function ModesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 font-serif text-center">
          Choose Your Mode
        </h1>
        <p className="text-lg text-gray-600 mb-12 font-sans text-center max-w-2xl mx-auto">
          Pick the optimization mode that fits your needs. Both use Claude's latest models to improve your résumé.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Quick Optimize */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gray-900 text-white px-4 py-2 rounded-xl font-sans text-sm font-medium">
                Quick Optimize
              </div>
              <span className="text-sm text-gray-500 font-sans">~50 seconds</span>
            </div>

            <p className="text-gray-700 mb-6 font-sans">
              Fast single-pass optimization focused on high-impact changes. Get your improved CV quickly.
            </p>

            <h3 className="text-sm font-semibold text-gray-900 mb-3 font-sans uppercase tracking-wide">
              What's Included
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Optimized CV with strategic transformations</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>10-15 actionable change suggestions</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Built-in honesty validation (no hallucinations)</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Dual-variant suggestions (with/without metrics)</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Language elevation (tactical → strategic)</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Accept/reject inline suggestions</span>
              </li>
            </ul>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 font-sans">
                <strong>Best for:</strong> Quick iterations, time-sensitive applications, or when you need results fast.
              </p>
            </div>
          </div>

          {/* Full Analysis */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gray-900 text-white px-4 py-2 rounded-xl font-sans text-sm font-medium">
                Full Analysis
              </div>
              <span className="text-sm text-gray-500 font-sans">~90 seconds</span>
            </div>

            <p className="text-gray-700 mb-6 font-sans">
              Deep multi-stage analysis with comprehensive diagnostics. Understand exactly how your résumé improves.
            </p>

            <h3 className="text-sm font-semibold text-gray-900 mb-3 font-sans uppercase tracking-wide">
              Everything in Quick Optimize, plus:
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Fit score:</strong> Before/after comparison (e.g., 32 → 67)</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Strengths analysis:</strong> What's already working</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Gap identification:</strong> What's missing for this role</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Keyword targeting:</strong> Job themes vs your signals</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Strategic rationale:</strong> Why each change was made</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Salary insights:</strong> Market context for the role</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 font-sans text-sm">
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span><strong>Curator validation:</strong> Extra honesty pass</span>
              </li>
            </ul>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 font-sans">
                <strong>Best for:</strong> Critical applications, understanding your positioning, or when you need proof of improvement.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 font-sans">
            Both modes use <strong>Claude Sonnet 4</strong> for maximum quality. You can switch between modes at any time.
          </p>
        </div>
      </div>
    </div>
  )
}
