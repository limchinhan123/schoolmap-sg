import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'School Hunt for SG PR - where got chance ah?',
  description: 'School Hunt for SG PR - where got chance ah?',
  openGraph: {
    title: 'School Hunt for SG PR - where got chance ah?',
    description: 'School Hunt for SG PR - where got chance ah?',
    url: 'https://schoolmap-sg.vercel.app',
    siteName: 'School Hunt for SG PR',
    images: [
      {
        url: 'https://schoolmap-sg.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'School Hunt for SG PR',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'School Hunt for SG PR - where got chance ah?',
    description: 'School Hunt for SG PR - where got chance ah?',
    images: ['https://schoolmap-sg.vercel.app/og-image.png'],
  },
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
