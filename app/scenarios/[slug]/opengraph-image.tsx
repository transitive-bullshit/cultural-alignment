import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import sharp from 'sharp'

import { contentCatalog } from '@/lib/content/snapshot'
import { focalPointToObjectPosition } from '@/lib/media/crop'

export const alt = 'A highlighted Cultural Alignment scenario'
export const size = {
  width: 1200,
  height: 630
}
export const contentType = 'image/png'

const selectedFrame = {
  height: 170,
  left: 477,
  padding: 8,
  top: 215,
  width: 288
} as const
const stillSize = {
  height: selectedFrame.height - selectedFrame.padding * 2,
  width: selectedFrame.width - selectedFrame.padding * 2
} as const
const templateData = await readFile(
  join(process.cwd(), 'assets/social-image-template.jpg'),
  'base64'
)
const templateSrc = `data:image/jpeg;base64,${templateData}`

export default async function Image({
  params
}: {
  readonly params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const scenario = contentCatalog.getScenarioPage(slug)

  if (!scenario) notFound()

  const stillSrc = await toJpegDataUrl(scenario.image.detailSrc)

  return new ImageResponse(
    <div
      style={{
        backgroundColor: '#f7f0de',
        display: 'flex',
        height: '100%',
        position: 'relative',
        width: '100%'
      }}
    >
      <img
        alt=''
        height={size.height}
        src={templateSrc}
        style={{
          height: size.height,
          left: 0,
          position: 'absolute',
          top: 0,
          width: size.width
        }}
        width={size.width}
      />
      <div
        style={{
          alignItems: 'center',
          backgroundColor: '#f7f0de',
          display: 'flex',
          height: selectedFrame.height,
          justifyContent: 'center',
          left: selectedFrame.left,
          position: 'absolute',
          top: selectedFrame.top,
          width: selectedFrame.width
        }}
      >
        <div
          style={{
            display: 'flex',
            height: stillSize.height,
            overflow: 'hidden',
            width: stillSize.width
          }}
        >
          <img
            alt={scenario.image.alt}
            height={stillSize.height}
            src={stillSrc}
            style={{
              height: stillSize.height,
              objectFit: 'cover',
              objectPosition: focalPointToObjectPosition(
                scenario.image.focalPoint
              ),
              width: stillSize.width
            }}
            width={stillSize.width}
          />
        </div>
      </div>
    </div>,
    size
  )
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
      width: stillSize.width * 3,
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
