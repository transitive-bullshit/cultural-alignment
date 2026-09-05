import { balanceWrappedTextLines } from './balanced-wrap'

export const memeEvalCanvas = { width: 1200, height: 800 } as const

interface MemeCaptionLine {
  readonly text: string
}

interface MemeTextZone {
  readonly line_indexes: readonly number[]
  readonly bounds_pct: readonly [number, number, number, number]
  readonly font_size_pct: number
  readonly style: 'impact' | 'dialogue' | 'code' | 'label' | 'status'
  readonly indent_levels: readonly number[]
}

export interface MemeTextLayoutLine {
  readonly text: string
  readonly indentCharacters: number
}

export interface MemeTextLayout {
  readonly lines: readonly MemeTextLayoutLine[]
  readonly fontSize: number
  readonly lineHeight: number
  readonly blockHeight: number
}

export function layoutMemeTextZone(
  captionLines: readonly MemeCaptionLine[],
  zone: MemeTextZone
): MemeTextLayout {
  const zoneWidth = (zone.bounds_pct[2] / 100) * memeEvalCanvas.width
  const fontSize = (zone.font_size_pct / 100) * memeEvalCanvas.width
  const lineHeight = fontSize * (zone.style === 'code' ? 1.28 : 1.06)
  const isCode = zone.style === 'code'
  const lines = zone.line_indexes.flatMap((lineIndex, index) => {
    const indentCharacters = isCode ? (zone.indent_levels[index] ?? 0) * 2 : 0
    const text = captionLines[lineIndex]?.text ?? ''
    const wrapped = wrapTextGreedily(
      text,
      zoneWidth,
      fontSize,
      indentCharacters,
      zone.style === 'impact' ? 0.5 : 0.58
    )
    return (isCode ? wrapped : balanceWrappedTextLines(wrapped)).map(
      (wrappedText) => ({ text: wrappedText, indentCharacters })
    )
  })

  return {
    lines,
    fontSize,
    lineHeight,
    blockHeight: lines.length * lineHeight
  }
}

export function wrapTextGreedily(
  text: string,
  width: number,
  fontSize: number,
  indentCharacters = 0,
  averageGlyphWidthEm = 0.58
): string[] {
  const capacity = Math.max(
    1,
    Math.floor(width / (fontSize * averageGlyphWidthEm)) - indentCharacters
  )
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && next.length > capacity) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}
