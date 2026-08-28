import type { RichTextItemResponse } from '@notionhq/client'
import { describe, expect, it } from 'vitest'

import {
  allocateStableSlugs,
  generatedMediaFilePath,
  richTextToMarkdown,
  sha256
} from './sync-utils'

describe('generatedMediaFilePath', () => {
  it('resolves only deterministic scenario variant paths', () => {
    expect(
      generatedMediaFilePath(
        '/workspace',
        '/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/gallery.webp'
      )
    ).toBe(
      '/workspace/public/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/gallery.webp'
    )
  })

  it.each([
    '/media/generated/../../package.json',
    '/media/generated/scenarios/not-a-page/detail.webp',
    '/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/original.png'
  ])('rejects unsafe or unowned path %s', (publicPath) => {
    expect(() => generatedMediaFilePath('/workspace', publicPath)).toThrow(
      'Refusing unexpected generated media path'
    )
  })
})

describe('allocateStableSlugs', () => {
  it('preserves tombstones and prevents old URLs from being reassigned', () => {
    expect(
      allocateStableSlugs([{ id: 'new-page-abcdef', title: 'Old title' }], {
        'removed-page': 'old-title'
      })
    ).toEqual({
      'removed-page': 'old-title',
      'new-page-abcdef': 'old-title-abcdef'
    })
  })
})

describe('richTextToMarkdown', () => {
  it('preserves links and annotations while escaping authored punctuation', () => {
    const items = [
      text('Literal *text* '),
      text('bold', { bold: true }),
      text(' docs', {}, 'https://example.com/a_(b)>'),
      text(' '),
      text('a`b', { code: true })
    ]

    expect(richTextToMarkdown(items)).toBe(
      'Literal \\*text\\* **bold**[ docs](<https://example.com/a_(b)%3E>) ``a`b``'
    )
  })
})

describe('sha256', () => {
  it('hashes generated outputs deterministically', () => {
    expect(sha256(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })
})

function text(
  plainText: string,
  overrides: Partial<RichTextItemResponse['annotations']> = {},
  href?: string
): RichTextItemResponse {
  return {
    type: 'text',
    text: {
      content: plainText,
      link: href ? { url: href } : null
    },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default',
      ...overrides
    },
    plain_text: plainText,
    href: href ?? null
  }
}
