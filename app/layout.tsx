import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/next'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import './globals.css'

import { SiteFooter } from '@/components/site-footer'
import { siteName, siteSummary, siteUrl, xProfileUrl } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: siteName,
    template: '%s — Cultural Alignment'
  },
  description: siteSummary,
  openGraph: {
    title: siteName,
    description: siteSummary,
    siteName,
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    site: '@transitive_bs',
    creator: '@transitive_bs'
  },
  authors: [{ name: 'Travis Fischer', url: xProfileUrl }],
  creator: 'Travis Fischer'
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className='h-full antialiased'>
      <body className='min-h-full'>
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  )
}
