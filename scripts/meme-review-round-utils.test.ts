import { describe, expect, it } from 'vitest'

import {
  stripTerminalMemePeriod,
  stripTerminalMemePeriods
} from './meme-review-round-utils'

describe('stripTerminalMemePeriod', () => {
  it('removes one formal period from the end of a caption line', () => {
    expect(stripTerminalMemePeriod('SHIP IT.')).toBe('SHIP IT')
    expect(stripTerminalMemePeriod('SHIP IT.  ')).toBe('SHIP IT  ')
  })

  it('removes a period before trailing quotes, brackets, and parentheses', () => {
    expect(stripTerminalMemePeriod('“SHIP IT.”')).toBe('“SHIP IT”')
    expect(stripTerminalMemePeriod("'SHIP IT.'")).toBe("'SHIP IT'")
    expect(stripTerminalMemePeriod('[DEPLOYMENT FAILED.]')).toBe(
      '[DEPLOYMENT FAILED]'
    )
    expect(stripTerminalMemePeriod('{READY.}')).toBe('{READY}')
    expect(stripTerminalMemePeriod('MODEL (ALIGNED.)')).toBe('MODEL (ALIGNED)')
    expect(stripTerminalMemePeriod('“SHIP IT (PROBABLY.)”  ')).toBe(
      '“SHIP IT (PROBABLY)”  '
    )
  })

  it('preserves ellipses', () => {
    expect(stripTerminalMemePeriod('WAIT..')).toBe('WAIT..')
    expect(stripTerminalMemePeriod('WAIT...')).toBe('WAIT...')
    expect(stripTerminalMemePeriod('“WAIT...”')).toBe('“WAIT...”')
    expect(stripTerminalMemePeriod('WAIT…')).toBe('WAIT…')
  })

  it('preserves decimal points and meaningful internal dots', () => {
    expect(stripTerminalMemePeriod('GPT-4.5')).toBe('GPT-4.5')
    expect(stripTerminalMemePeriod('VERSION 2.0.')).toBe('VERSION 2.0')
    expect(stripTerminalMemePeriod('U.S.A. IS ONLINE.')).toBe(
      'U.S.A. IS ONLINE'
    )
    expect(stripTerminalMemePeriod('agent.run()')).toBe('agent.run()')
  })

  it('preserves terminal abbreviation punctuation', () => {
    expect(stripTerminalMemePeriod('F.B.I.')).toBe('F.B.I.')
    expect(stripTerminalMemePeriod('“F.B.I.”')).toBe('“F.B.I.”')
    expect(stripTerminalMemePeriod('MONSTERS, INC.')).toBe('MONSTERS, INC.')
    expect(stripTerminalMemePeriod('THE F.B.I. IS HERE.')).toBe(
      'THE F.B.I. IS HERE'
    )
  })

  it('leaves lines without a formal terminal period unchanged', () => {
    expect(stripTerminalMemePeriod('SHIP IT')).toBe('SHIP IT')
    expect(stripTerminalMemePeriod('SHIP IT?')).toBe('SHIP IT?')
    expect(stripTerminalMemePeriod('SHIP IT!')).toBe('SHIP IT!')
    expect(stripTerminalMemePeriod('')).toBe('')
  })
})

describe('stripTerminalMemePeriods', () => {
  it('applies the rule independently to every caption line', () => {
    const lines = ['SHIP IT.', '“WAIT...”', 'ACCURACY: 99.9%.'] as const

    expect(stripTerminalMemePeriods(lines)).toEqual([
      'SHIP IT',
      '“WAIT...”',
      'ACCURACY: 99.9%'
    ])
    expect(lines).toEqual(['SHIP IT.', '“WAIT...”', 'ACCURACY: 99.9%.'])
  })
})
