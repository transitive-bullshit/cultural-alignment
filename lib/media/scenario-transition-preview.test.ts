import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearScenarioTransitionPreview,
  readScenarioTransitionPreview,
  stageScenarioTransitionPreview
} from './scenario-transition-preview'

describe('scenario transition preview', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hands the staged preview only to its matching scenario', () => {
    stageScenarioTransitionPreview({
      scenarioId: 'scenario-1',
      src: '/gallery-1.webp'
    })

    expect(readScenarioTransitionPreview('scenario-2')).toBeNull()

    const preview = readScenarioTransitionPreview('scenario-1')
    expect(preview?.src).toBe('/gallery-1.webp')

    clearScenarioTransitionPreview(preview!.token)
    expect(readScenarioTransitionPreview('scenario-1')).toBeNull()
  })

  it('expires previews left behind by an interrupted navigation', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-29T00:00:00Z'))

    stageScenarioTransitionPreview({
      scenarioId: 'scenario-1',
      src: '/gallery-1.webp'
    })
    vi.advanceTimersByTime(60_001)

    expect(readScenarioTransitionPreview('scenario-1')).toBeNull()
  })

  it('does not let an older destination clear a newer handoff', () => {
    stageScenarioTransitionPreview({
      scenarioId: 'scenario-1',
      src: '/gallery-1.webp'
    })
    const olderPreview = readScenarioTransitionPreview('scenario-1')!

    stageScenarioTransitionPreview({
      scenarioId: 'scenario-2',
      src: '/gallery-2.webp'
    })
    clearScenarioTransitionPreview(olderPreview.token)

    const newerPreview = readScenarioTransitionPreview('scenario-2')
    expect(newerPreview).not.toBeNull()
    if (!newerPreview) throw new Error('Expected the newer preview to remain')
    expect(newerPreview.src).toBe('/gallery-2.webp')
    clearScenarioTransitionPreview(newerPreview.token)
  })
})
