import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'School Hunt for PR kids — which school got chance to enter ah?',
  description: 'Discover primary schools accessible to Singapore PRs, with Phase 2C ballot history and nearby property data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden antialiased">
        {children}
      </body>
    </html>
  )
}
