import { describe, expect, it } from 'vitest'

import { serializeJsonLd } from './json-ld'

describe('JSON-LD serialization', () => {
  it('escapes markup-significant less-than characters', () => {
    const serialized = serializeJsonLd({
      description: '</script><script>alert(1)</script>'
    })

    expect(serialized).not.toContain('<')
    expect(JSON.parse(serialized)).toEqual({
      description: '</script><script>alert(1)</script>'
    })
  })
})
