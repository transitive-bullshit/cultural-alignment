import { describe, expect, it } from 'vitest'

import { layoutMemeTextZone, wrapTextGreedily } from './text-layout'

describe('meme text layout', () => {
  it('wraps whole words greedily instead of estimating from total length', () => {
    expect(
      wrapTextGreedily('AAAAAAAAAAAA BBBBBBBBBBBB CCCCCCCCCCCC', 960, 69.6)
    ).toEqual(['AAAAAAAAAAAA', 'BBBBBBBBBBBB', 'CCCCCCCCCCCC'])
  })

  it('reserves renderer width for code indentation', () => {
    const layout = layoutMemeTextZone(
      [{ text: 'aaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbb' }],
      {
        line_indexes: [0],
        bounds_pct: [15, 34, 70, 42],
        font_size_pct: 3.3,
        style: 'code',
        indent_levels: [1]
      }
    )

    expect(layout.lines).toEqual([
      { text: 'aaaaaaaaaaaaaaaaa', indentCharacters: 2 },
      { text: 'bbbbbbbbbbbbbbbbb', indentCharacters: 2 }
    ])
    expect(layout.lineHeight).toBeCloseTo(50.688)
    expect(layout.blockHeight).toBeCloseTo(101.376)
  })

  it('calibrates default-style wrap estimates for the narrower Impact face', () => {
    const caption = 'THE MONITOR SAYS ALL CLEAR'
    const layout = layoutMemeTextZone([{ text: caption }], {
      line_indexes: [0],
      bounds_pct: [2.5, 1.5, 95, 27.5],
      font_size_pct: 7,
      style: 'impact',
      indent_levels: [0]
    })

    expect(layout.lines.map(({ text }) => text)).toEqual([caption])
  })

  it('balances non-code estimates without adding lines or orphaning the last word', () => {
    const caption = 'WHEN THE MODEL KNOWS THE TEST IS WATCHING YOU'
    const zone = {
      line_indexes: [0],
      bounds_pct: [2, 2, 44, 24] as const,
      font_size_pct: 4,
      style: 'impact' as const,
      indent_levels: [0]
    }
    const greedy = wrapTextGreedily(
      caption,
      (zone.bounds_pct[2] / 100) * 1200,
      (zone.font_size_pct / 100) * 1200,
      0,
      0.5
    )
    const balanced = layoutMemeTextZone([{ text: caption }], zone).lines.map(
      ({ text }) => text
    )

    expect(greedy.at(-1)!.split(/\s+/u)).toHaveLength(1)
    expect(balanced).toHaveLength(greedy.length)
    expect(balanced.join(' ')).toBe(caption)
    expect(balanced.at(-1)!.split(/\s+/u).length).toBeGreaterThan(1)
  })
})
