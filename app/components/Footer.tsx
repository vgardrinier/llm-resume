'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full py-6 mt-auto">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex justify-center gap-6">
          <Link
            href="/about"
            className="text-base text-gray-400 hover:text-gray-600 transition-colors font-serif"
          >
            About
          </Link>
          <Link
            href="/terms"
            className="text-base text-gray-400 hover:text-gray-600 transition-colors font-serif"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-base text-gray-400 hover:text-gray-600 transition-colors font-serif"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
}

