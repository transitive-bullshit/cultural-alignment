import { access } from 'node:fs/promises'
import { join } from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { resolveImpactFont } from './impact-font'
import { renderMeasuredText } from './measured-text'

const fontFile = join(
  process.cwd(),
  'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff'
)

const impactStyle = {
  fill: '#ffffff',
  stroke: { color: '#000000', widthEm: 0.1 },
  align: 'center',
  verticalAlign: 'center',
  lineHeight: 1.02,
  blockGapEm: 0.25,
  indentEm: 1.2
} as const

const resolvedImpact = resolveImpactFont()

describe('measured text renderer', { timeout: 10_000 }, () => {
  it('preserves exact Unicode copy and returns measured unclipped alpha ink', async () => {
    await access(fontFile)
    const blocks = [
      { id: 'setup', text: 'Café says “no”—exactly 3.6×' },
      { id: 'payoff', text: 'PUNCTUATION STAYS!' }
    ] as const

    const result = await renderMeasuredText({
      blocks,
      font: { family: 'Barlow Condensed', filePath: fontFile, weight: 800 },
      style: impactStyle,
      maxWidthPx: 520,
      maxHeightPx: 260,
      minimumFontSizePx: 28,
      maximumFontSizePx: 72,
      safeInsetPx: 8
    })

    expect(result.status).toBe('fit')
    if (result.status !== 'fit') return

    expect(result.sourceBlocks).toEqual(blocks)
    for (const block of blocks) {
      expect(
        result.physicalLines
          .filter(({ blockId }) => blockId === block.id)
          .map(({ text }) => text)
          .join(' ')
      ).toBe(block.text)
    }

    const metadata = await sharp(result.layerPng).metadata()
    expect(metadata).toMatchObject({
      format: 'png',
      width: 520,
      height: 260,
      hasAlpha: true
    })

    const independentlyMeasured = await alphaBounds(result.layerPng)
    expect(independentlyMeasured).toEqual(result.inkBoundsPx)
    expect(independentlyMeasured).not.toBeNull()
    expect(independentlyMeasured!.left).toBeGreaterThanOrEqual(8)
    expect(independentlyMeasured!.top).toBeGreaterThanOrEqual(8)
    expect(
      independentlyMeasured!.left + independentlyMeasured!.width
    ).toBeLessThanOrEqual(512)
    expect(
      independentlyMeasured!.top + independentlyMeasured!.height
    ).toBeLessThanOrEqual(252)
  })

  it('chooses the largest whole-pixel font size that really fits', async () => {
    const blocks = [
      { id: 'caption', text: 'WHEN THE BENCHMARK BECOMES THE CURRICULUM' }
    ] as const
    const request = {
      blocks,
      font: { family: 'Barlow Condensed', filePath: fontFile, weight: 800 },
      style: impactStyle,
      maxWidthPx: 430,
      maxHeightPx: 150,
      minimumFontSizePx: 24,
      maximumFontSizePx: 80,
      safeInsetPx: 6
    } as const

    const result = await renderMeasuredText(request)

    expect(result.status).toBe('fit')
    if (result.status !== 'fit') return
    expect(result.fontSizePx).toBeGreaterThanOrEqual(request.minimumFontSizePx)
    expect(result.fontSizePx).toBeLessThan(request.maximumFontSizePx)

    const nextSize = await renderMeasuredText({
      ...request,
      minimumFontSizePx: result.fontSizePx + 1,
      maximumFontSizePx: result.fontSizePx + 1
    })
    expect(nextSize).toMatchObject({ status: 'unfit' })
  })

  it('rasterizes an opaque black outline outside the white glyph fill', async () => {
    const result = await renderMeasuredText({
      blocks: [{ id: 'caption', text: 'OUTLINE' }] as const,
      font: { family: 'Barlow Condensed', filePath: fontFile, weight: 800 },
      style: {
        ...impactStyle,
        stroke: { color: '#000000', widthEm: 0.05 }
      },
      maxWidthPx: 420,
      maxHeightPx: 160,
      minimumFontSizePx: 68,
      maximumFontSizePx: 68,
      safeInsetPx: 12
    })

    expect(result.status).toBe('fit')
    if (result.status !== 'fit') return
    expect(result.strokeWidthPx).toBe(4)
    const colors = await opaqueColorCounts(result.layerPng)
    expect(colors.white).toBeGreaterThan(0)
    expect(colors.black).toBeGreaterThan(0)
  })

  it('balances non-code lines instead of leaving an avoidable one-word orphan', async () => {
    const request = {
      blocks: [
        { id: 'caption', text: 'ONE TWO RED ELEPHANT BLUE SKY' }
      ] as const,
      font: { family: 'Barlow Condensed', filePath: fontFile, weight: 800 },
      maxWidthPx: 440,
      maxHeightPx: 240,
      minimumFontSizePx: 48,
      maximumFontSizePx: 48,
      safeInsetPx: 12
    } as const
    const [greedy, balanced] = await Promise.all([
      renderMeasuredText({
        ...request,
        style: { ...impactStyle, wrap: 'greedy' }
      }),
      renderMeasuredText({
        ...request,
        style: { ...impactStyle, wrap: 'balance' }
      })
    ])

    expect(greedy.status).toBe('fit')
    expect(balanced.status).toBe('fit')
    if (greedy.status !== 'fit' || balanced.status !== 'fit') return
    expect(balanced.physicalLines).toHaveLength(greedy.physicalLines.length)
    expect(balanced.physicalLines.map(({ text }) => text).join(' ')).toBe(
      request.blocks[0].text
    )
    expect(wordsIn(greedy.physicalLines.at(-1)!.text)).toHaveLength(1)
    expect(wordsIn(balanced.physicalLines.at(-1)!.text).length).toBeGreaterThan(
      1
    )
    expect(
      balanced.physicalLines.some(({ text }) => wordsIn(text).length === 1)
    ).toBe(false)
  })

  it.skipIf(resolvedImpact.status !== 'resolved')(
    'tries another measured balance instead of falling back to a final orphan',
    async () => {
      if (resolvedImpact.status !== 'resolved') return
      const text = "WHEN YOUR AI'S CALIBRATION SET IS THE ONLY PLANET YOU HAVE"

      const result = await renderMeasuredText({
        blocks: [{ id: 'caption', text }] as const,
        font: {
          family: resolvedImpact.family,
          filePath: resolvedImpact.filePath,
          weight: 400
        },
        style: {
          ...impactStyle,
          stroke: { color: '#000000', widthEm: 0.05 },
          wrap: 'balance'
        },
        maxWidthPx: 1152,
        maxHeightPx: 125,
        minimumFontSizePx: 45,
        maximumFontSizePx: 84,
        safeInsetPx: 12
      })

      expect(result.status).toBe('fit')
      if (result.status !== 'fit') return
      expect(result.physicalLines.map(({ text }) => text).join(' ')).toBe(text)
      expect(result.physicalLines).toHaveLength(2)
      expect(wordsIn(result.physicalLines.at(-1)!.text).length).toBeGreaterThan(
        1
      )
    }
  )

  it('returns typed unfit for an overlong token instead of clipping or editing it', async () => {
    const text = `ROOT_${'X'.repeat(120)}`
    const blocks = [{ id: 'code', text, indentLevel: 1 }] as const

    const result = await renderMeasuredText({
      blocks,
      font: { family: 'Barlow Condensed', filePath: fontFile, weight: 800 },
      style: { ...impactStyle, align: 'left' },
      maxWidthPx: 180,
      maxHeightPx: 120,
      minimumFontSizePx: 28,
      maximumFontSizePx: 56,
      safeInsetPx: 6
    })

    expect(result).toMatchObject({
      status: 'unfit',
      code: 'unbreakable-token',
      sourceBlocks: blocks
    })
  })

  it('reduces type to honor a physical-line ceiling before accepting a fit', async () => {
    const result = await renderMeasuredText({
      blocks: [{ id: 'speech', text: 'ORO: YOU CHECKED THE DECOY' }] as const,
      font: { family: 'Barlow Condensed', filePath: fontFile, weight: 800 },
      style: impactStyle,
      maxWidthPx: 540,
      maxHeightPx: 200,
      minimumFontSizePx: 46,
      maximumFontSizePx: 70,
      maximumPhysicalLines: 2,
      safeInsetPx: 12
    })

    expect(result.status).toBe('fit')
    if (result.status !== 'fit') return
    expect(result.physicalLines.length).toBeLessThanOrEqual(2)
    expect(result.fontSizePx).toBeLessThan(70)
  })
})

function wordsIn(text: string): readonly string[] {
  return text.match(/\S+/gu) ?? []
}

async function alphaBounds(buffer: Buffer): Promise<{
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
} | null> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let left = info.width
  let top = info.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if (!alpha) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  return right < 0
    ? null
    : { left, top, width: right - left + 1, height: bottom - top + 1 }
}

async function opaqueColorCounts(
  buffer: Buffer
): Promise<{ readonly white: number; readonly black: number }> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let white = 0
  let black = 0
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] !== 255) continue
    const [red, green, blue] = data.subarray(offset, offset + 3)
    if (red === 255 && green === 255 && blue === 255) white += 1
    if (red === 0 && green === 0 && blue === 0) black += 1
  }
  return { white, black }
}
