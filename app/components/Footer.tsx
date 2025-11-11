'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full py-6 mt-auto">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex justify-center">
          <Link
            href="/about"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-serif"
          >
            About
          </Link>
        </div>
      </div>
    </footer>
  )
}

