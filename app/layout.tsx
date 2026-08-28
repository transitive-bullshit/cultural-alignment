import type { Metadata } from 'next'

import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import './globals.css'

import { SiteFooter } from '@/components/site-footer'
import { siteSummary, siteUrl } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Cultural Alignment',
    template: '%s — Cultural Alignment'
  },
  description: siteSummary
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className='h-full antialiased'>
      <body className='min-h-full'>
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
