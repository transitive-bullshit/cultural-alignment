import { describe, expect, it } from 'vitest'

import { createBrowseGalleryHref } from './browse-params'

describe('browse gallery URL state', () => {
  it('builds stable filter URLs', () => {
    expect(createBrowseGalleryHref({ family: null })).toBe('/scenarios')
    expect(
      createBrowseGalleryHref({
        family: 'malicious-use'
      })
    ).toBe('/scenarios/family/malicious-use')
  })
})
