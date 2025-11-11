'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Sparkles, Loader2 } from 'lucide-react'

interface ChatMessage {
  content: string
  timestamp: Date
}

interface HonestCoachProps {
  jobTitle: string
  companyName: string
  location: string
  salaryMedian: number
  salaryLow: number
  salaryHigh: number
  fitScore: number
  changesMade: string[]
  keywordsUsed: string[]
  isVisible: boolean
}

export function HonestCoach({
  jobTitle,
  companyName,
  location,
  salaryMedian,
  salaryLow,
  salaryHigh,
  fitScore,
  changesMade,
  keywordsUsed,
  isVisible
}: HonestCoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && !showChat) {
      // Trigger the chat generation
      generateChatMessages()
      setShowChat(true)
    }
  }, [isVisible])

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const generateChatMessages = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          companyName,
          location,
          salaryMedian,
          salaryLow,
          salaryHigh,
          fitScore,
          changesMade,
          keywordsUsed
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate coach chat')
      }

      const data = await response.json()
      const chatMessages = data.messages || []

      // Animate messages one at a time
      for (let i = 0; i < chatMessages.length; i++) {
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            content: chatMessages[i],
            timestamp: new Date()
          }])
        }, i * 800) // 800ms delay between messages
      }
    } catch (error) {
      console.error('Error generating coach chat:', error)
      // Fallback messages if API fails
      setMessages([
        { content: '👋 Hey, I\'m Mio — your brutally honest résumé coach.', timestamp: new Date() }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  if (!showChat) return null

  return (
    <div className="bg-gradient-to-br from-orange-50 via-purple-50 to-blue-50 rounded-2xl shadow-default p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-orange-500 to-purple-600 rounded-full p-2">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">The Honest Coach</div>
            <div className="text-xs text-gray-600">by Mio</div>
          </div>
        </div>
        <button className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium bg-white px-3 py-1.5 rounded-full shadow-sm transition-colors">
          <Sparkles className="h-4 w-4" />
          What should I say?
        </button>
      </div>

      {/* Chat Messages */}
      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Mio is thinking...</span>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={index}
                className="mb-3 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-purple-100">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Mio is typing...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask Mio anything... (⌘↩ to send)"
          className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
          disabled
        />
        <div className="text-xs text-gray-400">
          💡 Coming soon: chat with Mio
        </div>
      </div>
    </div>
  )
}

