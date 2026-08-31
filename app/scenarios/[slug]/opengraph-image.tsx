import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import sharp from 'sharp'

import { shouldShowEpisode } from '@/features/scenario-dossier/source-meta'
import { contentCatalog } from '@/lib/content/snapshot'
import { focalPointToObjectPosition } from '@/lib/media/crop'

export const alt =
  'A Cultural Alignment scenario with its source and AI safety concepts'
export const size = {
  width: 1200,
  height: 630
}
export const contentType = 'image/png'

const colors = {
  accent: '#ff4d1f',
  ink: '#2d2a26',
  mutedInk: '#71695f',
  paper: '#f4ecdd'
} as const
const mediaWidth = 744
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
  const scenario = contentCatalog.getScenarioPage(slug)

  if (!scenario) notFound()

  const stillSrc = await toJpegDataUrl(scenario.image.detailSrc)
  const showEpisode = shouldShowEpisode(
    scenario.source.sourceType,
    scenario.episode?.label
  )
  const concepts = scenario.concepts.slice(0, 3)
  const titleFontSize = getTitleFontSize(scenario.title)

  return new ImageResponse(
    <div
      style={{
        backgroundColor: colors.paper,
        color: colors.ink,
        display: 'flex',
        fontFamily: 'Geist',
        height: '100%',
        position: 'relative',
        width: '100%'
      }}
    >
      <div
        style={{
          backgroundColor: '#171713',
          borderRight: `1px solid ${colors.ink}`,
          display: 'flex',
          flexShrink: 0,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          width: mediaWidth
        }}
      >
        <img
          alt={scenario.image.alt}
          height={size.height}
          src={stillSrc}
          style={{
            height: size.height,
            objectFit: 'cover',
            objectPosition: focalPointToObjectPosition(
              scenario.image.focalPoint
            ),
            width: mediaWidth
          }}
          width={mediaWidth}
        />
        <div
          style={{
            borderBottom: `4px solid ${colors.accent}`,
            borderRight: `4px solid ${colors.accent}`,
            bottom: 21,
            display: 'flex',
            height: 50,
            position: 'absolute',
            right: 21,
            width: 50
          }}
        />
      </div>

      <div
        style={{
          backgroundColor: colors.paper,
          backgroundImage:
            'linear-gradient(rgba(45, 42, 38, 0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(45, 42, 38, 0.028) 1px, transparent 1px)',
          backgroundSize: '74px 74px',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          height: '100%',
          padding: '40px 41px 38px'
        }}
      >
        <div
          style={{
            alignItems: 'baseline',
            borderBottom: '1px solid rgba(45, 42, 38, 0.24)',
            display: 'flex',
            justifyContent: 'space-between',
            paddingBottom: 17
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Barlow Condensed',
              fontSize: 25,
              fontWeight: 800,
              letterSpacing: '-0.9px',
              lineHeight: 0.9,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}
          >
            Cultural Alignment
          </div>
          <div
            style={{
              color: colors.mutedInk,
              display: 'flex',
              fontSize: 9,
              letterSpacing: '0.8px',
              lineHeight: 1.2,
              textAlign: 'right',
              textTransform: 'uppercase'
            }}
          >
            Scenario analogy
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 0,
            padding: '20px 0 22px'
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Barlow Condensed',
              fontSize: titleFontSize,
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 0.86
            }}
          >
            {scenario.title}
          </div>

          <div
            style={{
              color: colors.mutedInk,
              display: 'flex',
              flexDirection: 'column',
              fontSize: 15,
              gap: 7,
              letterSpacing: '1px',
              lineHeight: 1.2,
              marginTop: 23,
              textTransform: 'uppercase'
            }}
          >
            <SourceDetail prominent>{scenario.source.title}</SourceDetail>
            {showEpisode && scenario.episode ? (
              <SourceDetail>{scenario.episode.label}</SourceDetail>
            ) : null}
            {scenario.releaseDate ? (
              <SourceDetail>{scenario.releaseDate.slice(0, 4)}</SourceDetail>
            ) : null}
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${colors.ink}`,
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 16
          }}
        >
          <div
            style={{
              color: colors.mutedInk,
              display: 'flex',
              fontSize: 12,
              letterSpacing: '1px',
              lineHeight: 1.2,
              textTransform: 'uppercase'
            }}
          >
            AI safety concepts
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              marginTop: 10
            }}
          >
            {concepts.map((concept, index) => (
              <div
                key={concept.id}
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  fontSize: 18,
                  fontWeight: 600,
                  gap: 11,
                  lineHeight: 1.15
                }}
              >
                <span
                  style={{
                    color: colors.accent,
                    fontSize: 9,
                    fontWeight: 400,
                    letterSpacing: '0.6px'
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{concept.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      // debug: true,
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

function SourceDetail({
  children,
  prominent = false
}: {
  readonly children: string
  readonly prominent?: boolean
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        color: prominent ? colors.ink : colors.mutedInk,
        display: 'flex',
        fontWeight: prominent ? 600 : 400,
        gap: 8
      }}
    >
      <span
        style={{
          color: colors.accent,
          display: 'flex',
          flex: '0 0 10px'
        }}
      >
        ×
      </span>
      <span>{children}</span>
    </div>
  )
}

function getTitleFontSize(title: string) {
  const longestToken = Math.max(
    ...title.split(/\s+/).map((word) => word.length)
  )

  if (title.length >= 45) return 64
  if (title.length >= 36 || longestToken >= 13) return 68
  if (title.length >= 28 || longestToken >= 12) return 72
  return 77
}

async function toJpegDataUrl(source: string) {
  const response = await fetch(source, { cache: 'force-cache' })

  if (!response.ok) {
    throw new Error(
      `Could not load scenario image: ${response.status} ${response.statusText}`
    )
  }

  const jpeg = await sharp(await response.arrayBuffer())
    .resize({
      width: mediaWidth * 2,
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
