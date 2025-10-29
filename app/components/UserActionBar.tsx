'use client'

interface UserActionBarProps {
  mode: 'next' | 'resume'
  onNext?: () => void
  onShowResume?: () => void
}

export function UserActionBar({ mode, onNext, onShowResume }: UserActionBarProps) {
  return (
    <div className="sticky bottom-4">
      <div className="bg-white/90 backdrop-blur-md border border-gray-200 shadow-lg rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-700">Explore your insights at your pace.</div>
        {mode === 'next' ? (
          <button onClick={onNext} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">
            Next insight →
          </button>
        ) : (
          <button onClick={onShowResume} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
            Show résumé →
          </button>
        )}
      </div>
    </div>
  )
}


