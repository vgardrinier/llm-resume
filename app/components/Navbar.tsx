'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RightfitLogo } from './RightfitLogo'

interface NavbarProps {
  jobUrl?: string
  uploadedFileName?: string
}

export function Navbar({ jobUrl, uploadedFileName }: NavbarProps) {
  const pathname = usePathname()
  const isHomePage = pathname === '/'

  const getDisplayHost = (url: string) => {
    try {
      const u = new URL(url)
      return u.hostname.replace('www.', '')
    } catch {
      return url.length > 32 ? url.slice(0, 29) + '…' : url
    }
  }

  return (
    <div className="sticky top-0 z-50 backdrop-blur-sm bg-white/50 border-b border-gray-100">
      <div className="container mx-auto px-4 lg:px-8 py-2 flex items-center justify-between gap-4">
        {/* Left side: Logo + About */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex-shrink-0 hover:opacity-80 transition-opacity">
            <RightfitLogo className="text-base lg:text-lg" />
          </Link>
          <Link
            href="/about"
            className="flex-shrink-0 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            About
          </Link>
        </div>

        {/* Right side: Job URL + Resume PDF - only show on home page when values exist */}
        {isHomePage && (jobUrl || uploadedFileName) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
            {jobUrl && (
              <>
                <span className="truncate">{getDisplayHost(jobUrl)}</span>
                {uploadedFileName && <span className="text-gray-300">•</span>}
              </>
            )}
            {uploadedFileName && (
              <span className="truncate">{uploadedFileName}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

