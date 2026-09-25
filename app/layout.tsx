import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { MarketplaceProvider } from '@/lib/store'
import { SiteChrome } from '@/components/layout/site-chrome'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
})

export const metadata: Metadata = {
  title: 'WorkBid — Find the Right Contractor for Your Next Project',
  description:
    'WorkBid is a contractor marketplace where clients post projects, receive competitive bids, compare contractors, and hire the best fit for the job.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} bg-background`}>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <MarketplaceProvider>
            <SiteChrome>{children}</SiteChrome>
            <Toaster position="top-right" richColors />
          </MarketplaceProvider>
        </Suspense>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
