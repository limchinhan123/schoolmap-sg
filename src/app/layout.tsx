import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SchoolMap SG — Find your school, find your home',
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
