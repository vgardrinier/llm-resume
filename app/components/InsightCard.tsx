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
  salary: 'from-green-50 to-emerald-50 border-green-200',
  fit: 'from-blue-50 to-indigo-50 border-blue-200',
  keywords: 'from-purple-50 to-pink-50 border-purple-200',
  themes: 'from-emerald-50 to-mint-50 border-emerald-200',
  optimizations: 'from-gray-50 to-gray-50 border-gray-200',
  review: 'from-yellow-50 to-amber-50 border-yellow-200',
  auto_optimized: 'from-slate-50 to-zinc-50 border-slate-200'
}

export function InsightCard({ type, title, data, collapsed = false }: InsightCardProps) {
  const [isOpen, setIsOpen] = useState(!collapsed)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`bg-gradient-to-r ${typeClasses[type]} border rounded-xl overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0 }}
        className="px-4 pb-4"
      >
        {/* Render variants */}
        {type === 'salary' && (
          <div className="text-sm text-gray-800">
            <div className="text-2xl font-bold text-green-700 mb-1">${data.median.toLocaleString()}</div>
            <div className="text-xs text-gray-600 mb-2">Range: ${data.range[0].toLocaleString()} - ${data.range[1].toLocaleString()}</div>
            <div className="text-gray-700">{data.comment}</div>
          </div>
        )}

        {type === 'fit' && (
          <div className="text-sm text-blue-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-3xl font-bold">{data.score_after}%</div>
              <div className="text-xs text-blue-700">from {data.score_before}%</div>
            </div>
            {data.subscores && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-medium text-blue-900 mb-1">Before</div>
                  <div>Keywords: {data.subscores.before.keywordMatch}%</div>
                  <div>Themes: {data.subscores.before.themeAlignment}%</div>
                  <div>Experience: {data.subscores.before.experienceRelevance}%</div>
                  <div>Skills: {data.subscores.before.skillOverlap}%</div>
                </div>
                <div>
                  <div className="font-medium text-blue-900 mb-1">After</div>
                  <div>Keywords: {data.subscores.after.keywordMatch}%</div>
                  <div>Themes: {data.subscores.after.themeAlignment}%</div>
                  <div>Experience: {data.subscores.after.experienceRelevance}%</div>
                  <div>Skills: {data.subscores.after.skillOverlap}%</div>
                </div>
              </div>
            )}
            <div className="mt-2 text-blue-900">{data.summary}</div>
          </div>
        )}

        {type === 'keywords' && (
          <div className="flex flex-wrap gap-2">
            {Array.isArray(data) && data.map((k: string, i: number) => (
              <span key={i} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs">{k}</span>
            ))}
          </div>
        )}

        {type === 'themes' && (
          <div className="flex flex-wrap gap-2">
            {Array.isArray(data) && data.map((t: string, i: number) => (
              <span key={i} className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs">{t}</span>
            ))}
          </div>
        )}

        {type === 'optimizations' && (
          <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
            {Array.isArray(data) && data.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
          </ul>
        )}

        {type === 'review' && (
          <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
            {Array.isArray(data) && data.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
          </ul>
        )}

        {type === 'auto_optimized' && (
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            {Array.isArray(data) && data.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}


