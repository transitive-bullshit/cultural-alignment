import sharp from 'sharp'

import { rankBalancedTextLines } from './balanced-wrap'

export interface MeasuredTextBlock {
  readonly id: string
  readonly text: string
  readonly indentLevel?: 0 | 1 | 2 | 3 | 4
}

export interface MeasuredTextFont {
  readonly family: string
  readonly filePath: string
  readonly weight: number
}

export interface MeasuredTextStyle {
  readonly fill: string
  readonly stroke?: {
    readonly color: string
    readonly widthEm: number
  }
  readonly wrap?: 'greedy' | 'balance'
  readonly align: 'left' | 'center' | 'right'
  readonly verticalAlign: 'top' | 'center' | 'bottom'
  readonly lineHeight: number
  readonly blockGapEm: number
  readonly indentEm: number
}

export interface MeasuredPixelBounds {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface MeasuredPhysicalLine {
  readonly blockId: string
  readonly text: string
  readonly indentLevel: number
  readonly inkBoundsPx: MeasuredPixelBounds
}

export interface RenderMeasuredTextRequest {
  readonly blocks: readonly [MeasuredTextBlock, ...MeasuredTextBlock[]]
  readonly font: MeasuredTextFont
  readonly style: MeasuredTextStyle
  readonly maxWidthPx: number
  readonly maxHeightPx: number
  readonly minimumFontSizePx: number
  readonly maximumFontSizePx: number
  readonly maximumPhysicalLines?: number
  readonly safeInsetPx?: number
}

export interface MeasuredTextFit {
  readonly status: 'fit'
  readonly sourceBlocks: readonly MeasuredTextBlock[]
  readonly fontSizePx: number
  readonly strokeWidthPx: number
  readonly physicalLines: readonly MeasuredPhysicalLine[]
  readonly layerPng: Buffer
  readonly layerWidthPx: number
  readonly layerHeightPx: number
  readonly inkBoundsPx: MeasuredPixelBounds
}

export interface MeasuredTextUnfit {
  readonly status: 'unfit'
  readonly code: 'unbreakable-token' | 'box-too-small'
  readonly sourceBlocks: readonly MeasuredTextBlock[]
  readonly reason: string
}

export type MeasuredTextResult = MeasuredTextFit | MeasuredTextUnfit

interface RenderedLine {
  readonly buffer: Buffer
  readonly width: number
  readonly height: number
  readonly inkBounds: MeasuredPixelBounds
}

interface PendingPhysicalLine {
  readonly blockId: string
  readonly text: string
  readonly indentLevel: number
  readonly indentPx: number
  readonly rendered: RenderedLine
  readonly rowHeight: number
}

interface FittedLayout {
  readonly fontSizePx: number
  readonly lines: readonly PendingPhysicalLine[]
  readonly totalHeight: number
  readonly blockEndIndexes: ReadonlySet<number>
}

interface LayoutFailure {
  readonly unbreakableToken: boolean
}

interface TextComposite {
  readonly input: Buffer
  readonly left: number
  readonly top: number
}

export async function renderMeasuredText(
  request: RenderMeasuredTextRequest
): Promise<MeasuredTextResult> {
  validateRequest(request)
  const safeInsetPx = request.safeInsetPx ?? 0
  const cache = new Map<string, Promise<RenderedLine>>()
  let lower = request.minimumFontSizePx
  let upper = request.maximumFontSizePx
  let best: FittedLayout | undefined
  let lastFailure: LayoutFailure = { unbreakableToken: false }

  while (lower <= upper) {
    const fontSizePx = Math.floor((lower + upper) / 2)
    const layout = await fitAtFontSize(request, fontSizePx, safeInsetPx, cache)
    if ('fontSizePx' in layout) {
      best = layout
      lower = fontSizePx + 1
    } else {
      lastFailure = layout
      upper = fontSizePx - 1
    }
  }

  if (best) {
    if (request.style.wrap === 'balance') {
      const minimumBalancedFontSize = Math.max(
        request.minimumFontSizePx,
        best.fontSizePx - 2
      )
      for (
        let fontSizePx = best.fontSizePx;
        fontSizePx >= minimumBalancedFontSize;
        fontSizePx -= 1
      ) {
        const balanced = await fitAtFontSize(
          request,
          fontSizePx,
          safeInsetPx,
          cache,
          'balance'
        )
        if ('fontSizePx' in balanced) {
          best = balanced
          break
        }
      }
    }
    return renderFittedLayout(request, best, safeInsetPx)
  }

  const minimumFailure =
    upper < request.minimumFontSizePx
      ? lastFailure
      : await fitAtFontSize(
          request,
          request.minimumFontSizePx,
          safeInsetPx,
          cache
        )
  const failed =
    'fontSizePx' in minimumFailure
      ? { unbreakableToken: false }
      : minimumFailure

  return {
    status: 'unfit',
    code: failed.unbreakableToken ? 'unbreakable-token' : 'box-too-small',
    sourceBlocks: request.blocks,
    reason: failed.unbreakableToken
      ? 'At least one unbroken token exceeds the usable width at the minimum font size'
      : 'The exact text does not fit within the requested box at the minimum font size'
  }
}

async function fitAtFontSize(
  request: RenderMeasuredTextRequest,
  fontSizePx: number,
  safeInsetPx: number,
  cache: Map<string, Promise<RenderedLine>>,
  wrapMode: 'greedy' | 'balance' = 'greedy'
): Promise<FittedLayout | LayoutFailure> {
  const usableWidth = request.maxWidthPx - safeInsetPx * 2
  const usableHeight = request.maxHeightPx - safeInsetPx * 2
  const lines: PendingPhysicalLine[] = []
  const blockEndIndexes = new Set<number>()

  for (const block of request.blocks) {
    const indentLevel = block.indentLevel ?? 0
    const indentPx = Math.ceil(
      indentLevel * request.style.indentEm * fontSizePx
    )
    const wrap = await wrapBlock({
      text: block.text,
      maximumWidth: usableWidth - indentPx,
      mode: wrapMode,
      renderLine: (text) => cachedRenderLine(cache, request, text, fontSizePx)
    })
    if (wrap.status === 'unfit') return { unbreakableToken: true }

    for (const { text, rendered } of wrap.lines) {
      const rowHeight = Math.max(
        rendered.height,
        Math.ceil(fontSizePx * request.style.lineHeight)
      )
      lines.push({
        blockId: block.id,
        text,
        indentLevel,
        indentPx,
        rendered,
        rowHeight
      })
    }
    blockEndIndexes.add(lines.length - 1)
  }

  const blockGap = Math.ceil(fontSizePx * request.style.blockGapEm)
  if (
    request.maximumPhysicalLines !== undefined &&
    lines.length > request.maximumPhysicalLines
  ) {
    return { unbreakableToken: false }
  }
  const totalHeight = lines.reduce(
    (height, line, index) =>
      height +
      line.rowHeight +
      (blockEndIndexes.has(index) && index < lines.length - 1 ? blockGap : 0),
    0
  )
  if (totalHeight > usableHeight) return { unbreakableToken: false }

  return { fontSizePx, lines, totalHeight, blockEndIndexes }
}

async function wrapBlock({
  text,
  maximumWidth,
  mode,
  renderLine
}: {
  readonly text: string
  readonly maximumWidth: number
  readonly mode: 'greedy' | 'balance'
  readonly renderLine: (text: string) => Promise<RenderedLine>
}): Promise<
  | {
      readonly status: 'fit'
      readonly lines: readonly { text: string; rendered: RenderedLine }[]
    }
  | { readonly status: 'unfit' }
> {
  const physicalLines: { text: string; rendered: RenderedLine }[] = []
  const paragraphs = text.split(/\r\n|\n|\r/u)

  for (const paragraph of paragraphs) {
    const words = paragraph.match(/\S+/gu) ?? []
    if (!words.length) return { status: 'unfit' }
    if (words.some((word) => Array.from(word).length > 512)) {
      return { status: 'unfit' }
    }
    const wrapped = await wrapWordsGreedily({
      words,
      maximumWidth,
      renderLine
    })
    if (!wrapped) return { status: 'unfit' }
    physicalLines.push(
      ...(mode === 'balance' && wrapped.length > 1
        ? await balanceWrappedLines({
            lines: wrapped,
            maximumWidth,
            renderLine
          })
        : wrapped)
    )
  }

  return { status: 'fit', lines: physicalLines }
}

async function wrapWordsGreedily({
  words,
  maximumWidth,
  renderLine
}: {
  readonly words: readonly string[]
  readonly maximumWidth: number
  readonly renderLine: (text: string) => Promise<RenderedLine>
}): Promise<readonly { text: string; rendered: RenderedLine }[] | null> {
  const lines: { text: string; rendered: RenderedLine }[] = []
  let currentText = ''
  let currentRender: RenderedLine | undefined

  for (const word of words) {
    const candidateText = currentText ? `${currentText} ${word}` : word
    const candidateRender = await renderLine(candidateText)
    if (candidateRender.width <= maximumWidth) {
      currentText = candidateText
      currentRender = candidateRender
      continue
    }

    if (!currentText || !currentRender) return null
    lines.push({ text: currentText, rendered: currentRender })
    const wordRender = await renderLine(word)
    if (wordRender.width > maximumWidth) return null
    currentText = word
    currentRender = wordRender
  }

  if (!currentText || !currentRender) return null
  lines.push({ text: currentText, rendered: currentRender })
  return lines
}

async function balanceWrappedLines({
  lines: initialLines,
  maximumWidth,
  renderLine
}: {
  readonly lines: readonly { text: string; rendered: RenderedLine }[]
  readonly maximumWidth: number
  readonly renderLine: (text: string) => Promise<RenderedLine>
}): Promise<readonly { text: string; rendered: RenderedLine }[]> {
  const candidates = rankBalancedTextLines(initialLines.map(({ text }) => text))
  for (const texts of candidates) {
    const rendered = await Promise.all(texts.map(renderLine))
    if (rendered.every((line) => line.width <= maximumWidth)) {
      return texts.map((text, index) => ({ text, rendered: rendered[index]! }))
    }
  }
  return initialLines
}

function cachedRenderLine(
  cache: Map<string, Promise<RenderedLine>>,
  request: RenderMeasuredTextRequest,
  text: string,
  fontSizePx: number
): Promise<RenderedLine> {
  const key = `${fontSizePx}\u0000${text}`
  const cached = cache.get(key)
  if (cached) return cached
  const rendered = renderLine(request, text, fontSizePx)
  cache.set(key, rendered)
  return rendered
}

async function renderLine(
  request: RenderMeasuredTextRequest,
  text: string,
  fontSizePx: number
): Promise<RenderedLine> {
  const markup = `<span foreground="${request.style.fill}">${escapeMarkup(text)}</span>`
  const glyphs = await sharp({
    text: {
      text: markup,
      font: `${request.font.family} ${pangoWeight(request.font.weight)} ${fontSizePx}`,
      fontfile: request.font.filePath,
      dpi: 72,
      rgba: true,
      wrap: 'none'
    }
  })
    .png()
    .toBuffer()
  const strokeWidth = strokeWidthPx(request.style, fontSizePx)
  const padding = strokeWidth + 2
  const paddedGlyphs = await sharp(glyphs)
    .extend({
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
      background: '#00000000'
    })
    .png()
    .toBuffer()
  const metadata = await sharp(paddedGlyphs).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error('Text rasterizer returned an empty image')
  }

  let decorated = paddedGlyphs
  if (request.style.stroke && strokeWidth > 0) {
    const strokeAlpha = await sharp(paddedGlyphs)
      .extractChannel('alpha')
      .erode(strokeWidth)
      .png()
      .toBuffer()
    const stroke = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 3,
        background: request.style.stroke.color
      }
    })
      .joinChannel(strokeAlpha)
      .png()
      .toBuffer()
    decorated = await sharp(stroke)
      .composite([{ input: paddedGlyphs, left: 0, top: 0 }])
      .png()
      .toBuffer()
  }

  const inkBounds = await measureAlphaBounds(decorated)
  if (!inkBounds) throw new Error('Text rasterizer produced no visible ink')
  return {
    buffer: decorated,
    width: metadata.width,
    height: metadata.height,
    inkBounds
  }
}

async function renderFittedLayout(
  request: RenderMeasuredTextRequest,
  layout: FittedLayout,
  safeInsetPx: number
): Promise<MeasuredTextFit> {
  const usableWidth = request.maxWidthPx - safeInsetPx * 2
  const usableHeight = request.maxHeightPx - safeInsetPx * 2
  const verticalOffset =
    request.style.verticalAlign === 'top'
      ? safeInsetPx
      : request.style.verticalAlign === 'bottom'
        ? safeInsetPx + usableHeight - layout.totalHeight
        : safeInsetPx + Math.floor((usableHeight - layout.totalHeight) / 2)
  const composites: TextComposite[] = []
  const physicalLines: MeasuredPhysicalLine[] = []
  const blockGap = Math.ceil(layout.fontSizePx * request.style.blockGapEm)
  let y = verticalOffset

  layout.lines.forEach((line, index) => {
    const availableWidth = usableWidth - line.indentPx
    const x =
      request.style.align === 'left'
        ? safeInsetPx + line.indentPx
        : request.style.align === 'right'
          ? safeInsetPx + usableWidth - line.rendered.width
          : safeInsetPx +
            line.indentPx +
            Math.floor((availableWidth - line.rendered.width) / 2)
    const lineTop = y + Math.floor((line.rowHeight - line.rendered.height) / 2)
    composites.push({ input: line.rendered.buffer, left: x, top: lineTop })
    physicalLines.push({
      blockId: line.blockId,
      text: line.text,
      indentLevel: line.indentLevel,
      inkBoundsPx: {
        left: x + line.rendered.inkBounds.left,
        top: lineTop + line.rendered.inkBounds.top,
        width: line.rendered.inkBounds.width,
        height: line.rendered.inkBounds.height
      }
    })
    y += line.rowHeight
    if (layout.blockEndIndexes.has(index) && index < layout.lines.length - 1) {
      y += blockGap
    }
  })

  const layerPng = await sharp({
    create: {
      width: request.maxWidthPx,
      height: request.maxHeightPx,
      channels: 4,
      background: '#00000000'
    }
  })
    .composite(composites)
    .png()
    .toBuffer()
  const inkBoundsPx = await measureAlphaBounds(layerPng)
  if (!inkBoundsPx) throw new Error('Fitted text layer produced no visible ink')
  assertSafeBounds(request, inkBoundsPx, safeInsetPx)

  return {
    status: 'fit',
    sourceBlocks: request.blocks,
    fontSizePx: layout.fontSizePx,
    strokeWidthPx: strokeWidthPx(request.style, layout.fontSizePx),
    physicalLines,
    layerPng,
    layerWidthPx: request.maxWidthPx,
    layerHeightPx: request.maxHeightPx,
    inkBoundsPx
  }
}

function strokeWidthPx(style: MeasuredTextStyle, fontSizePx: number): number {
  const widthEm = style.stroke?.widthEm ?? 0
  return widthEm > 0 ? Math.max(1, Math.ceil(widthEm * fontSizePx)) : 0
}

async function measureAlphaBounds(
  buffer: Buffer
): Promise<MeasuredPixelBounds | null> {
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
      if (!data[(y * info.width + x) * info.channels + 3]) continue
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

function assertSafeBounds(
  request: RenderMeasuredTextRequest,
  bounds: MeasuredPixelBounds,
  safeInsetPx: number
) {
  if (
    bounds.left < safeInsetPx ||
    bounds.top < safeInsetPx ||
    bounds.left + bounds.width > request.maxWidthPx - safeInsetPx ||
    bounds.top + bounds.height > request.maxHeightPx - safeInsetPx
  ) {
    throw new Error('Measured text escaped its verified safe inset')
  }
}

function validateRequest(request: RenderMeasuredTextRequest) {
  for (const [name, value] of [
    ['maxWidthPx', request.maxWidthPx],
    ['maxHeightPx', request.maxHeightPx],
    ['minimumFontSizePx', request.minimumFontSizePx],
    ['maximumFontSizePx', request.maximumFontSizePx]
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive integer`)
    }
  }
  if (request.minimumFontSizePx > request.maximumFontSizePx) {
    throw new TypeError('minimumFontSizePx cannot exceed maximumFontSizePx')
  }
  if (
    request.maximumPhysicalLines !== undefined &&
    (!Number.isInteger(request.maximumPhysicalLines) ||
      request.maximumPhysicalLines <= 0)
  ) {
    throw new TypeError('maximumPhysicalLines must be a positive integer')
  }
  const safeInsetPx = request.safeInsetPx ?? 0
  if (!Number.isInteger(safeInsetPx) || safeInsetPx < 0) {
    throw new TypeError('safeInsetPx must be a non-negative integer')
  }
  if (
    safeInsetPx * 2 >= request.maxWidthPx ||
    safeInsetPx * 2 >= request.maxHeightPx
  ) {
    throw new TypeError('safeInsetPx leaves no usable rendering area')
  }
  if (
    !request.blocks.length ||
    request.blocks.some(({ id, text }) => !id || !text)
  ) {
    throw new TypeError('Every measured text block needs an id and exact text')
  }
  if (
    new Set(request.blocks.map(({ id }) => id)).size !== request.blocks.length
  ) {
    throw new TypeError('Measured text block ids must be unique')
  }
  if (
    request.style.lineHeight <= 0 ||
    request.style.blockGapEm < 0 ||
    request.style.indentEm < 0 ||
    (request.style.stroke?.widthEm ?? 0) < 0
  ) {
    throw new TypeError('Text spacing and stroke values must be non-negative')
  }
  for (const color of [request.style.fill, request.style.stroke?.color]) {
    if (color && !/^#[\da-f]{6}$/iu.test(color)) {
      throw new TypeError('Text colors must use six-digit hexadecimal notation')
    }
  }
}

function escapeMarkup(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function pangoWeight(weight: number): string {
  if (weight >= 900) return 'Black'
  if (weight >= 800) return 'ExtraBold'
  if (weight >= 700) return 'Bold'
  if (weight >= 600) return 'SemiBold'
  if (weight >= 500) return 'Medium'
  if (weight <= 300) return 'Light'
  return 'Regular'
}
