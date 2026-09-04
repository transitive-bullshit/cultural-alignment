import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import sharp from 'sharp'

import { contentCatalog } from '@/lib/content/snapshot'
import { focalPointToObjectPosition } from '@/lib/media/crop'

export const alt =
  'A Cultural Alignment media source poster with its release year'
export const size = {
  width: 1200,
  height: 630
}
export const contentType = 'image/png'

const colors = {
  accent: '#ff4d1f',
  iconBackground: '#2d2a26',
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

export default async function Image({
  params
}: {
  readonly params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const source = contentCatalog.getResourcePage('source', slug)

  if (!source || source.kind !== 'source') notFound()

  const posterSrc = source.poster
    ? await toJpegDataUrl(source.poster.detailSrc)
    : null
  const releaseYear = source.releaseDate?.slice(0, 4)

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
      {posterSrc && source.poster ? (
        <img
          alt={source.poster.alt}
          height={size.height}
          src={posterSrc}
          style={{
            height: '100%',
            objectFit: 'cover',
            objectPosition: focalPointToObjectPosition(
              source.poster.focalPoint
            ),
            width: '100%'
          }}
          width={size.width}
        />
      ) : null}

      <div
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(23, 23, 19, 0), rgba(23, 23, 19, 0.58) 45%, rgba(23, 23, 19, 0.94) 100%)`,
          bottom: 0,
          display: 'flex',
          height: 220,
          left: 0,
          position: 'absolute',
          right: 0
        }}
      />

      <div
        style={{
          alignItems: 'center',
          bottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          left: 0,
          padding: '0 52px 42px',
          position: 'absolute',
          right: 0
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 18
          }}
        >
          <TargetMark />
          <div
            style={{
              display: 'flex',
              fontFamily: 'Barlow Condensed',
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: '-1.7px',
              lineHeight: 0.9,
              textOverflow: 'ellipsis',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '100%'
            }}
          >
            {source.title}
          </div>
        </div>

        {releaseYear ? (
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
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
      ...size,
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
      `Could not load media source poster: ${response.status} ${response.statusText}`
    )
  }

  const jpeg = await sharp(await response.arrayBuffer())
    .resize({
      width: size.width * 2,
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
