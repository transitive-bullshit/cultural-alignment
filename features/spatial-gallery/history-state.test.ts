import { describe, expect, it } from 'vitest'

import {
  mergeGalleryHistoryState,
  readGalleryHistoryState
} from './history-state'

const galleryState = {
  itemId: 'scenario-2',
  offsetX: -12.75,
  version: 1
} as const

describe('spatial gallery history state', () => {
  it('preserves Next history fields and other gallery entries', () => {
    const existing = mergeGalleryHistoryState({ __NA: true }, 'featured', {
      itemId: 'scenario-1',
      offsetX: 2,
      version: 1
    })
    const merged = mergeGalleryHistoryState(
      existing,
      'browse:all',
      galleryState
    )

    expect((merged as { __NA?: unknown }).__NA).toBe(true)
    expect(
      readGalleryHistoryState(
        merged,
        'featured',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual({ itemId: 'scenario-1', offsetX: 2, version: 1 })
    expect(
      readGalleryHistoryState(
        merged,
        'browse:all',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual(galleryState)
  })

  it('restores only finite positions for items in the current result set', () => {
    const merged = mergeGalleryHistoryState(null, 'featured', galleryState)

    expect(
      readGalleryHistoryState(
        merged,
        'featured',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual(galleryState)
    expect(
      readGalleryHistoryState(merged, 'featured', new Set(['scenario-1']))
    ).toBeNull()
  })

  it('never restores an offset across different gallery topologies', () => {
    const merged = mergeGalleryHistoryState(
      null,
      'browse:misalignment',
      galleryState
    )

    expect(
      readGalleryHistoryState(
        merged,
        'browse:malicious-use',
        new Set(['scenario-2'])
      )
    ).toBeNull()
    expect(
      readGalleryHistoryState(merged, 'browse:all', new Set(['scenario-2']))
    ).toBeNull()
  })

  it('rejects malformed or version-mismatched browser state', () => {
    const malformed = mergeGalleryHistoryState(null, 'featured', {
      ...galleryState,
      offsetX: Number.NaN
    })
    const versionMismatched = structuredClone(
      mergeGalleryHistoryState(null, 'featured', galleryState)
    )
    const envelope = versionMismatched as Record<string, unknown>
    const galleryStates = Object.values(envelope).find(
      (value) => typeof value === 'object' && value !== null
    ) as Record<string, Record<string, unknown>>
    galleryStates.featured!.version = 2

    expect(
      readGalleryHistoryState(malformed, 'featured', new Set(['scenario-2']))
    ).toBeNull()
    expect(
      readGalleryHistoryState(
        versionMismatched,
        'featured',
        new Set(['scenario-2'])
      )
    ).toBeNull()
  })
})
