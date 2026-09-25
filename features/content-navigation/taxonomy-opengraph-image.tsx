import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'takumi-js/response'

import { socialImageCacheHeaders } from '@/lib/media/social-image'

import { SocialImageTargetMark } from './social-image-target-mark'

export const taxonomyOpenGraphImageSize = { width: 1200, height: 630 } as const
export const taxonomyOpenGraphImageContentType = 'image/webp'

const barlowExtraBold = await readFile(
  join(process.cwd(), 'assets/fonts/barlow-condensed-latin-800-normal.woff')
)

export function renderTaxonomyOpenGraphImage({
  category,
  title
}: Readonly<{
  category: 'AI risk family' | 'AI safety concept'
  title: string
}>) {
  return new ImageResponse(
    <div
      style={{
        backgroundColor: '#f4ecdd',
        backgroundImage:
          'linear-gradient(rgba(45, 42, 38, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(45, 42, 38, 0.035) 1px, transparent 1px)',
        backgroundSize: '74px 74px',
        backgroundRepeat: 'repeat',
        color: '#2d2a26',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Geist',
        height: '100%',
        padding: '46px 64px',
        width: '100%'
      }}
    >
      <div
        style={{
          alignItems: 'center',
          borderBottom: '1px solid rgba(45, 42, 38, 0.24)',
          display: 'flex',
          gap: 16,
          paddingBottom: 22
        }}
      >
        <SocialImageTargetMark />
        <div
          style={{
            fontFamily: 'Barlow Condensed',
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '-1px',
            textTransform: 'uppercase'
          }}
        >
          Cultural Alignment
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 20,
          padding: '26px 0'
        }}
      >
        <div
          style={{
            color: '#71695f',
            fontSize: 18,
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}
        >
          {category}
        </div>
        <div
          style={{
            fontFamily: 'Barlow Condensed',
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: '-2.5px',
            lineHeight: 0.96
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          alignItems: 'center',
          borderTop: '1px solid rgba(45, 42, 38, 0.24)',
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 22
        }}
      >
        <div style={{ color: '#71695f', fontSize: 20 }}>
          AI safety through the lens of pop culture
        </div>
        <div
          style={{
            borderBottom: '4px solid #ff4d1f',
            borderRight: '4px solid #ff4d1f',
            height: 24,
            width: 24
          }}
        />
      </div>
    </div>,
    {
      ...taxonomyOpenGraphImageSize,
      format: 'webp',
      quality: 80,
      headers: socialImageCacheHeaders,
      fonts: [
        {
          data: barlowExtraBold,
          name: 'Barlow Condensed',
          style: 'normal',
          weight: 800
        }
      ]
    }
  )
}
