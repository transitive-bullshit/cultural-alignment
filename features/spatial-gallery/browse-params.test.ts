import { describe, expect, it } from 'vitest'

import {
  createBrowseGalleryHref,
  parseBrowseGalleryParams
} from './browse-params'

const validFamilies = new Set(['misalignment', 'malicious-use'])

describe('browse gallery URL state', () => {
  it('parses a valid single family', () => {
    expect(
      parseBrowseGalleryParams({ family: 'misalignment' }, validFamilies)
    ).toEqual({ family: 'misalignment' })
  })

  it('falls back to all families for invalid input', () => {
    expect(
      parseBrowseGalleryParams(
        { family: ['missing', 'misalignment'] },
        validFamilies
      )
    ).toEqual({ family: null })
  })

  it('builds stable filter URLs', () => {
    expect(createBrowseGalleryHref({ family: null })).toBe('/scenarios')
    expect(
      createBrowseGalleryHref({
        family: 'malicious-use'
      })
    ).toBe('/scenarios?family=malicious-use')
  })
})
