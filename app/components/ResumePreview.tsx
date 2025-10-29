'use client'

interface ResumePreviewProps {
  optimized: string
}

export function ResumePreview({ optimized }: ResumePreviewProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Resume Preview</h3>
        <a
          href={URL.createObjectURL(new Blob([optimized], { type: 'text/markdown' }))}
          download={'tailored_resume.md'}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Download MD
        </a>
      </div>
      <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{optimized}</pre>
      </div>
    </div>
  )
}


