'use client'

import { DollarSign, MapPin, Briefcase, MessageCircle } from 'lucide-react'
import { generateCheekySalaryCommentary } from '@/lib/utils/salaryMCP'

interface SalaryData {
  low: number
  median: number
  high: number
  source: string
  role: string
  location: string
}

interface SalaryDisplayProps {
  salaryData: SalaryData
}

export function SalaryDisplay({ salaryData }: SalaryDisplayProps) {
  const { low, median, high, source, role, location } = salaryData
  const cheekyCommentary = generateCheekySalaryCommentary(salaryData)

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold text-green-800">Salary Intelligence</h3>
      </div>
      
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">{role}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">{location}</span>
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-3 border border-green-100 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-800">
            ${median.toLocaleString()}
          </div>
          <div className="text-sm text-green-600 mb-2">Median Salary</div>
          <div className="text-xs text-gray-600">
            Range: ${low.toLocaleString()} - ${high.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Cheeky Commentary Section */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">The Tea ☕</span>
        </div>
        <div className="text-sm text-purple-700 leading-relaxed">
          {cheekyCommentary}
        </div>
      </div>
      
      <div className="mt-3 text-xs text-green-700 bg-green-100 rounded p-2">
        💡 <strong>Smart Investment:</strong> For $9, you're investing 0.005% of this role's annual salary to optimize your résumé.
      </div>
    </div>
  )
}
