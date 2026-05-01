import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'School Hunt for SG PR - where got chance ah?',
  description: 'Some schools are never meant for PR. Know your odds!',
  openGraph: {
    title: 'School Hunt for SG PR - where got chance ah?',
    description: 'Some schools are never meant for PR. Know your odds!',
    url: 'https://schoolmap-sg.vercel.app',
    siteName: 'School Hunt for SG PR',
    images: [
      {
        url: 'https://schoolmap-sg.vercel.app/og-image.jpg',
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
    description: 'Some schools are never meant for PR. Know your odds!',
    images: ['https://schoolmap-sg.vercel.app/og-image.jpg'],
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
