import { describe, expect, it } from 'vitest'

import {
  mergeGalleryHistoryState,
  readGalleryHistoryState
} from './history-state'

const galleryState = {
  itemId: 'scenario-2',
  offsetX: -12.75,
  topology: 'desktop',
  version: 2
} as const

describe('spatial gallery history state', () => {
  it('preserves Next history fields and other gallery entries', () => {
    const existing = mergeGalleryHistoryState({ __NA: true }, 'archive:home', {
      itemId: 'scenario-1',
      offsetX: 2,
      topology: 'mobile',
      version: 2
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
        'archive:home',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual({
      itemId: 'scenario-1',
      offsetX: 2,
      topology: 'mobile',
      version: 2
    })
    expect(
      readGalleryHistoryState(
        merged,
        'browse:all',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual(galleryState)
  })

  it('restores only finite positions for items in the current result set', () => {
    const merged = mergeGalleryHistoryState(null, 'archive:all', galleryState)

    expect(
      readGalleryHistoryState(
        merged,
        'archive:all',
        new Set(['scenario-1', 'scenario-2'])
      )
    ).toEqual(galleryState)
    expect(
      readGalleryHistoryState(merged, 'archive:all', new Set(['scenario-1']))
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
    const malformed = mergeGalleryHistoryState(null, 'archive:all', {
      ...galleryState,
      offsetX: Number.NaN
    })
    const versionMismatched = structuredClone(
      mergeGalleryHistoryState(null, 'archive:all', galleryState)
    )
    const envelope = versionMismatched as Record<string, unknown>
    const galleryStates = Object.values(envelope).find(
      (value) => typeof value === 'object' && value !== null
    ) as Record<string, Record<string, unknown>>
    galleryStates['archive:all']!.version = 3

    expect(
      readGalleryHistoryState(malformed, 'archive:all', new Set(['scenario-2']))
    ).toBeNull()
    expect(
      readGalleryHistoryState(
        versionMismatched,
        'archive:all',
        new Set(['scenario-2'])
      )
    ).toBeNull()
  })

  it('keeps legacy selection history but discards its topology assumption', () => {
    const legacy = {
      culturalAlignmentGallery: {
        'archive:all': {
          itemId: 'scenario-2',
          offsetX: -12.75,
          version: 1
        }
      }
    }

    expect(
      readGalleryHistoryState(legacy, 'archive:all', new Set(['scenario-2']))
    ).toEqual({
      itemId: 'scenario-2',
      offsetX: -12.75,
      topology: null,
      version: 2
    })
  })
})
