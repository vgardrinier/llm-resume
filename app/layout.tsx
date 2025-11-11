import type { Metadata } from 'next'
import './globals.css'
import { Inter, Playfair_Display } from 'next/font/google'
import { Analytics } from "@vercel/analytics/next"
import { Footer } from './components/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Rightfit — Honest Résumé Feedback & Precise Improvements',
  description: 'Find out why recruiters skip your résumé and fix it, today. Honest feedback and precise improvements — no fluff. Just truth and clarity so you can stand out where it matters.',
  keywords: ['résumé', 'resume', 'CV', 'career', 'job search', 'ATS', 'recruiter feedback', 'résumé improvement'],
  authors: [{ name: 'Rightfit' }],
  creator: 'Rightfit',
  publisher: 'Rightfit',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://rightfit.ai'),
  openGraph: {
    title: 'Rightfit — Honest Résumé Feedback & Precise Improvements',
    description: 'Find out why recruiters skip your résumé and fix it, today. Honest feedback and precise improvements — no fluff.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Rightfit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rightfit — Honest Résumé Feedback & Precise Improvements',
    description: 'Find out why recruiters skip your résumé and fix it, today. Honest feedback and precise improvements — no fluff.',
  },
  icons: {
    icon: '/rightfit_logo.png',
    apple: '/rightfit_logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans flex flex-col min-h-screen">
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}