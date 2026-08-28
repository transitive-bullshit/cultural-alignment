import { describe, expect, it } from 'vitest'

import {
  createBrowseGalleryHref,
  parseBrowseGalleryParams
} from './browse-params'

const validFamilies = new Set(['misalignment', 'malicious-use'])

describe('browse gallery URL state', () => {
  it('parses a valid single family and oldest-first sort', () => {
    expect(
      parseBrowseGalleryParams(
        { family: 'misalignment', sort: 'release-asc' },
        validFamilies
      )
    ).toEqual({ family: 'misalignment', sort: 'release-asc' })
  })

  it('falls back to all families and newest first for invalid input', () => {
    expect(
      parseBrowseGalleryParams(
        { family: ['missing', 'misalignment'], sort: 'sideways' },
        validFamilies
      )
    ).toEqual({ family: null, sort: 'release-desc' })
  })

  it('builds stable URLs that always expose sort state', () => {
    expect(
      createBrowseGalleryHref({ family: null, sort: 'release-desc' })
    ).toBe('/scenarios?sort=release-desc')
    expect(
      createBrowseGalleryHref({
        family: 'malicious-use',
        sort: 'release-asc'
      })
    ).toBe('/scenarios?family=malicious-use&sort=release-asc')
  })
})
