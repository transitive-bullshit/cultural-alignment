import { readFile } from 'node:fs/promises'

import sharp from 'sharp'

import { fixtureImagePath } from './fixtures'
import { calculateFrameGeometry, protectedRegionFocus } from './frame-geometry'
import type { MemeEvalPlan, MemeSkillFixture } from './schema'
import { layoutMemeTextZone, memeEvalCanvas } from './text-layout'

export { memeEvalCanvas } from './text-layout'

export async function renderMemeEvalPlan({
  fixture,
  plan,
  outputPath,
  previewPath
}: {
  readonly fixture: MemeSkillFixture
  readonly plan: MemeEvalPlan
  readonly outputPath: string
  readonly previewPath?: string
}): Promise<void> {
  const background = await renderMemeBackground(fixture, plan)
  const overlay = Buffer.from(renderOverlaySvg(plan))
  const raster = await sharp(background)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer()

  await sharp(raster).toFile(outputPath)
  if (previewPath) {
    await sharp(raster).resize({ width: 480 }).png().toFile(previewPath)
  }
}

export async function renderMemeBackground(
  fixture: MemeSkillFixture,
  plan: MemeEvalPlan
): Promise<Buffer> {
  const { width, height } = memeEvalCanvas
  const frames = await Promise.all(
    plan.presentation.source_frames.map(async ({ image_id }) => ({
      imageId: image_id,
      source: await readFile(fixtureImagePath(fixture, image_id))
    }))
  )

  if (plan.presentation.template === 'diptych') {
    const panelWidth = width / 2
    const panels = await Promise.all(
      frames.map(({ imageId, source }) =>
        plan.presentation.frame_mode === 'extend'
          ? renderExtendedFrame({
              source,
              fixture,
              imageId,
              width: panelWidth,
              height
            })
          : renderPositionedFrame({
              source,
              fixture,
              imageId,
              width: panelWidth,
              height,
              frameMode: plan.presentation.frame_mode,
              background: '#020617'
            })
      )
    )
    return sharp({
      create: { width, height, channels: 4, background: '#020617' }
    })
      .composite(
        panels.map((input, index) => ({
          input,
          left: index * panelWidth,
          top: 0
        }))
      )
      .png()
      .toBuffer()
  }

  const { source, imageId } = frames[0]!
  const bandHeight =
    plan.presentation.template === 'band-top' ||
    plan.presentation.template === 'band-bottom'
      ? 190
      : 0
  const sidecarWidth =
    plan.presentation.template === 'sidecar-left' ||
    plan.presentation.template === 'sidecar-right'
      ? 330
      : 0
  const imageWidth = width - sidecarWidth
  const imageHeight = height - bandHeight
  const fit = plan.presentation.frame_mode === 'cover' ? 'cover' : 'contain'
  const resized =
    plan.presentation.frame_mode === 'extend'
      ? await renderExtendedFrame({
          source,
          fixture,
          imageId,
          width: imageWidth,
          height: imageHeight
        })
      : await renderPositionedFrame({
          source,
          fixture,
          imageId,
          width: imageWidth,
          height: imageHeight,
          frameMode: fit,
          background: '#020617'
        })
  const left = plan.presentation.template === 'sidecar-left' ? sidecarWidth : 0
  const top = plan.presentation.template === 'band-top' ? bandHeight : 0

  return sharp({
    create: { width, height, channels: 4, background: '#020617' }
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()
}

export async function renderMemeSourceFrame({
  fixture,
  imageId,
  width,
  height,
  frameMode
}: {
  readonly fixture: MemeSkillFixture
  readonly imageId: string
  readonly width: number
  readonly height: number
  readonly frameMode: MemeEvalPlan['presentation']['frame_mode']
}): Promise<Buffer> {
  const source = await readFile(fixtureImagePath(fixture, imageId))
  if (frameMode === 'extend') {
    return renderExtendedFrame({
      source,
      fixture,
      imageId,
      width,
      height
    })
  }
  return renderPositionedFrame({
    source,
    fixture,
    imageId,
    width,
    height,
    frameMode,
    background: '#020617'
  })
}

function renderOverlaySvg(plan: MemeEvalPlan): string {
  const { width, height } = memeEvalCanvas
  const zones = plan.presentation.zones.map((zone, zoneIndex) => {
    const [xPct, yPct, widthPct, heightPct] = zone.bounds_pct
    const x = (xPct / 100) * width
    const y = (yPct / 100) * height
    const zoneWidth = (widthPct / 100) * width
    const zoneHeight = (heightPct / 100) * height
    const isCode = zone.style === 'code'
    const {
      lines: lineTexts,
      fontSize,
      lineHeight,
      blockHeight
    } = layoutMemeTextZone(plan.caption_lines, zone)
    const firstBaseline = y + (zoneHeight - blockHeight) / 2 + fontSize
    const textAnchor = isCode ? 'start' : 'middle'
    const textX = isCode ? x : x + zoneWidth / 2
    const fontFamily = isCode
      ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
      : 'Impact, Arial Black, sans-serif'
    const stroke = zone.contrast === 'outlined' ? '#020617' : 'none'
    const strokeWidth = zone.contrast === 'outlined' ? fontSize * 0.11 : 0
    const backdrop = renderBackdrop(
      zone.backdrop,
      zone.palette ?? 'default',
      zone.slot,
      x,
      y,
      zoneWidth,
      zoneHeight,
      zoneIndex
    )
    const tspans = lineTexts
      .map(
        ({ text, indentCharacters }, index) =>
          `<tspan x="${textX + indentCharacters * fontSize * 0.62}" y="${firstBaseline + index * lineHeight}">${escapeXml(text)}</tspan>`
      )
      .join('')

    return `${backdrop}<text text-anchor="${textAnchor}" fill="#fff" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill" font-family="${fontFamily}" font-size="${fontSize}" font-weight="900">${tspans}</text>`
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${zones.join('')}</svg>`
}

function renderBackdrop(
  backdrop: MemeEvalPlan['presentation']['zones'][number]['backdrop'],
  palette: NonNullable<
    MemeEvalPlan['presentation']['zones'][number]['palette']
  >,
  slot: MemeEvalPlan['presentation']['zones'][number]['slot'],
  x: number,
  y: number,
  width: number,
  height: number,
  index: number
): string {
  if (backdrop === 'none' || backdrop === 'source-native') return ''
  if (backdrop === 'solid-panel') {
    const fill = palette === 'orange-white' ? '#d96b18' : '#020617'
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${fill}"/>`
  }

  const topEdge = slot.startsWith('top')
  const gradientId = `edge-gradient-${index}`
  return `<defs><linearGradient id="${gradientId}" x1="0" y1="${topEdge ? 0 : 1}" x2="0" y2="${topEdge ? 1 : 0}"><stop offset="0" stop-color="#020617" stop-opacity=".78"/><stop offset="1" stop-color="#020617" stop-opacity="0"/></linearGradient></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${gradientId})"/>`
}

async function renderExtendedFrame({
  source,
  fixture,
  imageId,
  width,
  height
}: {
  readonly source: Buffer
  readonly fixture: MemeSkillFixture
  readonly imageId: string
  readonly width: number
  readonly height: number
}): Promise<Buffer> {
  const [blurredMargin, authenticFrame] = await Promise.all([
    renderPositionedFrame({
      source,
      fixture,
      imageId,
      width,
      height,
      frameMode: 'cover',
      background: '#020617'
    }).then((frame) =>
      sharp(frame)
        .blur(18)
        .modulate({ brightness: 0.58, saturation: 0.75 })
        .png()
        .toBuffer()
    ),
    renderPositionedFrame({
      source,
      fixture,
      imageId,
      width,
      height,
      frameMode: 'contain',
      background: '#00000000'
    })
  ])

  return sharp(blurredMargin)
    .composite([{ input: authenticFrame, left: 0, top: 0 }])
    .png()
    .toBuffer()
}

async function renderPositionedFrame({
  source,
  fixture,
  imageId,
  width,
  height,
  frameMode,
  background
}: {
  readonly source: Buffer
  readonly fixture: MemeSkillFixture
  readonly imageId: string
  readonly width: number
  readonly height: number
  readonly frameMode: 'cover' | 'contain'
  readonly background: string
}): Promise<Buffer> {
  const metadata = await sharp(source).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read source dimensions for ${imageId}`)
  }
  const focus = protectedRegionFocus(
    fixture.protected_regions.filter(({ image_id }) => image_id === imageId)
  )
  const geometry = calculateFrameGeometry({
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    targetLeft: 0,
    targetTop: 0,
    targetWidth: width,
    targetHeight: height,
    frameMode,
    focus
  })
  const renderedWidth = Math.max(1, Math.round(geometry.renderedWidth))
  const renderedHeight = Math.max(1, Math.round(geometry.renderedHeight))
  const imageLeft = Math.round(geometry.imageLeft)
  const imageTop = Math.round(geometry.imageTop)
  const cropLeft = Math.max(0, -imageLeft)
  const cropTop = Math.max(0, -imageTop)
  const destinationLeft = Math.max(0, imageLeft)
  const destinationTop = Math.max(0, imageTop)
  const visibleWidth = Math.min(
    renderedWidth - cropLeft,
    width - destinationLeft
  )
  const visibleHeight = Math.min(
    renderedHeight - cropTop,
    height - destinationTop
  )
  const canvas = sharp({
    create: { width, height, channels: 4, background }
  })
  if (visibleWidth <= 0 || visibleHeight <= 0) return canvas.png().toBuffer()

  const resized = await sharp(source)
    .resize({
      width: renderedWidth,
      height: renderedHeight,
      fit: 'fill'
    })
    .extract({
      left: cropLeft,
      top: cropTop,
      width: visibleWidth,
      height: visibleHeight
    })
    .png()
    .toBuffer()
  return canvas
    .composite([{ input: resized, left: destinationLeft, top: destinationTop }])
    .png()
    .toBuffer()
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
