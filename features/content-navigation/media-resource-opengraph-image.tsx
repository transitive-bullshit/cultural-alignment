import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'
import sharp from 'sharp'

import type { ContentImage } from '@/lib/content/catalog'
import { focalPointToObjectPosition } from '@/lib/media/crop'

export const mediaResourceOpenGraphImageSize = {
  width: 1200,
  height: 630
} as const
export const mediaResourceOpenGraphImageContentType = 'image/png'

const colors = {
  accent: '#ff4d1f',
  paper: '#f4ecdd',
  stage: '#171713'
} as const
const [barlowExtraBold, geistRegular] = await Promise.all([
  readFile(
    join(process.cwd(), 'assets/fonts/barlow-condensed-latin-800-normal.woff')
  ),
  readFile(
    join(
      process.cwd(),
      'node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf'
    )
  )
])

type MediaResourceOpenGraphImageInput = Readonly<{
  image: ContentImage | null
  releaseYear?: string
  title: string
}>

export async function renderMediaResourceOpenGraphImage({
  image,
  releaseYear,
  title
}: MediaResourceOpenGraphImageInput) {
  const imageSrc = image ? await toJpegDataUrl(image.detailSrc) : null

  return new ImageResponse(
    <div
      style={{
        backgroundColor: colors.stage,
        color: colors.paper,
        display: 'flex',
        fontFamily: 'Geist',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%'
      }}
    >
      {imageSrc && image ? (
        <img
          alt={image.alt}
          height={mediaResourceOpenGraphImageSize.height}
          src={imageSrc}
          style={{
            height: '100%',
            objectFit: 'cover',
            objectPosition: focalPointToObjectPosition(image.focalPoint),
            width: '100%'
          }}
          width={mediaResourceOpenGraphImageSize.width}
        />
      ) : null}

      <div
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(23, 23, 19, 0.94), rgba(23, 23, 19, 0.58) 55%, rgba(23, 23, 19, 0) 100%)`,
          display: 'flex',
          height: 220,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0
        }}
      />

      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          left: 0,
          padding: '52px 64px 0',
          position: 'absolute',
          right: 0,
          top: 0
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flex: 1,
            gap: 18,
            minWidth: 0
          }}
        >
          <TargetMark />
          <div
            style={{
              display: 'flex',
              fontFamily: 'Barlow Condensed',
              fontSize: 48,
              fontWeight: 800,
              flex: 1,
              letterSpacing: '-1.7px',
              lineHeight: 0.9,
              minWidth: 0,
              textTransform: 'uppercase'
            }}
          >
            {title}
          </div>
        </div>

        {releaseYear ? (
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              gap: 6,
              marginLeft: 40
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                letterSpacing: '2.8px',
                lineHeight: 1
              }}
            >
              {releaseYear}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    {
      ...mediaResourceOpenGraphImageSize,
      fonts: [
        {
          data: barlowExtraBold,
          name: 'Barlow Condensed',
          style: 'normal',
          weight: 800
        },
        {
          data: geistRegular,
          name: 'Geist',
          style: 'normal',
          weight: 400
        }
      ]
    }
  )
}

function TargetMark() {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height='60'
      style={{ flexShrink: 0 }}
      viewBox='0 0 60 60'
      width='60'
    >
      <path
        d='M30 6V22M30 38V54M6 30H22M38 30H54'
        stroke={colors.accent}
        strokeLinecap='square'
        strokeWidth='3'
      />
      <path
        d='M30 38C34.4183 38 38 34.4183 38 30C38 25.5817 34.4183 22 30 22C25.5817 22 22 25.5817 22 30C22 34.4183 25.5817 38 30 38Z'
        stroke={colors.accent}
        strokeLinecap='square'
        strokeWidth='3'
      />
    </svg>
  )
}

async function toJpegDataUrl(source: string) {
  const response = await fetch(source, { cache: 'force-cache' })

  if (!response.ok) {
    throw new Error(
      `Could not load media resource image: ${response.status} ${response.statusText}`
    )
  }

  const jpeg = await sharp(await response.arrayBuffer())
    .resize({
      width: mediaResourceOpenGraphImageSize.width * 2,
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
