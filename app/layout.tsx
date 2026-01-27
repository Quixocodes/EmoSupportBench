import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { LanguageProvider } from '@/lib/i18n/context'

export const metadata: Metadata = {
  title: 'AI Benchmark - LLM Evaluation System',
  description: 'Professional LLM evaluation and scoring system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
        <LanguageProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  )
}
