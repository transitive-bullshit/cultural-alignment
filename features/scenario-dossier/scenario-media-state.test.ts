import { describe, expect, it } from 'vitest'

import {
  clampMediaTime,
  formatMediaTime,
  MEDIA_SEEK_STEP_SECONDS
} from './scenario-media-state'

describe('scenario media state', () => {
  it('uses a conventional ten-second keyboard seek step', () => {
    expect(MEDIA_SEEK_STEP_SECONDS).toBe(10)
  })

  it('clamps seeks to the playable range', () => {
    expect(clampMediaTime(-5, 120)).toBe(0)
    expect(clampMediaTime(35, 120)).toBe(35)
    expect(clampMediaTime(125, 120)).toBe(120)
  })

  it('allows forward seeking while duration metadata is unavailable', () => {
    expect(clampMediaTime(35, 0)).toBe(35)
  })

  it('formats short and hour-long timestamps', () => {
    expect(formatMediaTime(0)).toBe('0:00')
    expect(formatMediaTime(65.9)).toBe('1:05')
    expect(formatMediaTime(3723)).toBe('1:02:03')
  })
})
