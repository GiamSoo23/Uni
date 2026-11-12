import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Uni',
  description: 'Open internships, filtered by eligibility, with a direct link to apply.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  )
}
