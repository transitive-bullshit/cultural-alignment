import { describe, expect, it } from 'vitest'

import { summarizeAnalogy } from './analogy-summary'

describe('summarizeAnalogy', () => {
  it('keeps a substantial first sentence on its own', () => {
    expect(
      summarizeAnalogy(
        'Once reputation becomes a numerical target, relationships turn performative. The metric consumes what it measured.',
        60
      )
    ).toBe(
      'Once reputation becomes a numerical target, relationships turn performative.'
    )
  })

  it('adds sentences until the summary carries the mapping', () => {
    expect(
      summarizeAnalogy(
        'Scores start as evidence. Once careers depend on them, scores replace learning. A third sentence.',
        60
      )
    ).toBe(
      'Scores start as evidence. Once careers depend on them, scores replace learning.'
    )
  })

  it('does not split on abbreviations or decimals', () => {
    const text =
      'A rating moves from 4.2 to 4.5 while e.g. friendships become props.'

    expect(summarizeAnalogy(text)).toBe(text)
  })
})
