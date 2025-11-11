'use client'

import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

type InsightType = 'salary' | 'fit' | 'keywords' | 'themes' | 'optimizations' | 'review' | 'auto_optimized'

interface InsightCardProps {
  type: InsightType
  title: string
  data: any
  collapsed?: boolean
}

const typeClasses: Record<InsightType, string> = {
  salary: 'bg-white/95 border-gray-200',
  fit: 'bg-white/95 border-gray-200',
  keywords: 'bg-white/95 border-gray-200',
  themes: 'bg-white/95 border-gray-200',
  optimizations: 'bg-white/95 border-gray-200',
  review: 'bg-white/95 border-gray-200',
  auto_optimized: 'bg-white/95 border-gray-200'
}

export function InsightCard({ type, title, data, collapsed = false }: InsightCardProps) {
  const [isOpen, setIsOpen] = useState(!collapsed)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`${typeClasses[type]} border rounded-2xl overflow-hidden backdrop-blur-sm shadow-default`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-gray-900 font-sans">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0 }}
        className="px-4 pb-4 overflow-hidden"
      >
        {/* Render variants */}
        {type === 'salary' && (
          <div className="text-sm text-gray-800 font-sans">
            <div className="text-2xl font-semibold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-playfair), serif' }}>${data.median.toLocaleString()}</div>
            <div className="text-xs text-gray-600 mb-2">Range: ${data.range[0].toLocaleString()} - ${data.range[1].toLocaleString()}</div>
            <div className="text-gray-700">{data.comment}</div>
          </div>
        )}

        {type === 'fit' && (
          <div className="text-sm text-gray-800 font-sans">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-3xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-playfair), serif' }}>{data.score_after}%</div>
              <div className="text-xs text-gray-600">from {data.score_before}%</div>
            </div>
            {data.subscores && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-medium text-gray-900 mb-1">Before</div>
                  <div className="text-gray-700">Keywords: {data.subscores.before.keywordMatch}%</div>
                  <div className="text-gray-700">Themes: {data.subscores.before.themeAlignment}%</div>
                  <div className="text-gray-700">Experience: {data.subscores.before.experienceRelevance}%</div>
                  <div className="text-gray-700">Skills: {data.subscores.before.skillOverlap}%</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 mb-1">After</div>
                  <div className="text-gray-700">Keywords: {data.subscores.after.keywordMatch}%</div>
                  <div className="text-gray-700">Themes: {data.subscores.after.themeAlignment}%</div>
                  <div className="text-gray-700">Experience: {data.subscores.after.experienceRelevance}%</div>
                  <div className="text-gray-700">Skills: {data.subscores.after.skillOverlap}%</div>
                </div>
              </div>
            )}
            <div className="mt-2 text-gray-800">{data.summary}</div>
          </div>
        )}

        {type === 'keywords' && (
          <div className="flex flex-wrap gap-2">
            {Array.isArray(data) && data.map((k: string, i: number) => (
              <span key={i} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg text-xs font-sans">{k}</span>
            ))}
          </div>
        )}

        {type === 'themes' && (
          <div className="flex flex-wrap gap-2">
            {Array.isArray(data) && data.map((t: string, i: number) => (
              <span key={i} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg text-xs font-sans">{t}</span>
            ))}
          </div>
        )}

        {type === 'optimizations' && (
          <ul className="list-disc list-inside text-sm text-gray-800 space-y-1 font-sans">
            {Array.isArray(data) && data.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
          </ul>
        )}

        {type === 'review' && (
          <ul className="list-disc list-inside text-sm text-gray-800 space-y-1 font-sans">
            {Array.isArray(data) && data.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
          </ul>
        )}

        {type === 'auto_optimized' && (
          <ul className="list-disc list-inside text-sm text-gray-800 space-y-1 font-sans">
            {Array.isArray(data) && data.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}


