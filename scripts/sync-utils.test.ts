import type { RichTextItemResponse } from '@notionhq/client'
import { describe, expect, it } from 'vitest'

import {
  allocateStableSlugs,
  generatedMediaFilePath,
  generatedMediaObjectKey,
  generatedMemeMediaObjectKey,
  generatedMediaPublicPaths,
  isGeneratedMediaUrlFor,
  isGeneratedMemeMediaUrlFor,
  parseSearchKeywords,
  richTextToMarkdown,
  retrieveRelationIds
} from './sync-utils'

describe('parseSearchKeywords', () => {
  it('normalizes and deduplicates comma-delimited keywords', () => {
    expect(
      parseSearchKeywords(
        '  AI Safety, Anime, ai   safety, Café, , ＲＯＢＯＴ  '
      )
    ).toEqual(['ai safety', 'anime', 'café', 'robot'])
  })
})

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

  it('resolves deterministic source poster variant paths', () => {
    expect(
      generatedMediaFilePath(
        '/workspace',
        '/media/generated/sources/3caedb27f12480319026e39581c85c47/detail.webp'
      )
    ).toBe(
      '/workspace/public/media/generated/sources/3caedb27f12480319026e39581c85c47/detail.webp'
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

describe('generatedMediaPublicPaths', () => {
  it('builds stable source poster paths from a Notion page ID', () => {
    expect(
      generatedMediaPublicPaths(
        'sources',
        '3caedb27-f124-8031-9026-e39581c85c47'
      )
    ).toEqual({
      gallerySrc:
        '/media/generated/sources/3caedb27f12480319026e39581c85c47/gallery.webp',
      detailSrc:
        '/media/generated/sources/3caedb27f12480319026e39581c85c47/detail.webp'
    })
  })

  it('builds stable franchise image paths from a Notion page ID', () => {
    expect(
      generatedMediaPublicPaths(
        'franchises',
        '3cdedb27-f124-80c3-850f-dadca165c684'
      )
    ).toEqual({
      gallerySrc:
        '/media/generated/franchises/3cdedb27f12480c3850fdadca165c684/gallery.webp',
      detailSrc:
        '/media/generated/franchises/3cdedb27f12480c3850fdadca165c684/detail.webp'
    })
  })
})

describe('generatedMediaObjectKey', () => {
  it('includes the final-byte hash in a stable variant key', () => {
    expect(
      generatedMediaObjectKey(
        'scenarios',
        '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa',
        'detail',
        'a'.repeat(64)
      )
    ).toBe(
      `media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/detail-${'a'.repeat(64)}.webp`
    )
  })

  it('owns franchise variants in their own collection', () => {
    expect(
      generatedMediaObjectKey(
        'franchises',
        '3cdedb27-f124-80c3-850f-dadca165c684',
        'gallery',
        'd'.repeat(64)
      )
    ).toBe(
      `media/generated/franchises/3cdedb27f12480c3850fdadca165c684/gallery-${'d'.repeat(64)}.webp`
    )
  })

  it('rejects malformed IDs and hashes', () => {
    expect(() =>
      generatedMediaObjectKey('sources', 'not-a-notion-id', 'gallery', 'a')
    ).toThrow('Invalid Notion page ID')
    expect(() =>
      generatedMediaObjectKey(
        'sources',
        '3caedb27-f124-8031-9026-e39581c85c47',
        'gallery',
        'not-a-hash'
      )
    ).toThrow('Invalid generated media SHA-256 hash')
  })
})

describe('generatedMemeMediaObjectKey', () => {
  it('nests content-addressed meme variants beneath their scenario owner', () => {
    expect(
      generatedMemeMediaObjectKey(
        '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa',
        'detail',
        'a'.repeat(64)
      )
    ).toBe(
      `media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/memes/detail-${'a'.repeat(64)}.webp`
    )
  })

  it('rejects malformed owner IDs and hashes', () => {
    expect(() =>
      generatedMemeMediaObjectKey('not-a-notion-id', 'gallery', 'a'.repeat(64))
    ).toThrow('Invalid Notion page ID')
    expect(() =>
      generatedMemeMediaObjectKey(
        '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa',
        'gallery',
        'not-a-hash'
      )
    ).toThrow('Invalid generated media SHA-256 hash')
  })
})

describe('isGeneratedMediaUrlFor', () => {
  const pageId = '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa'
  const key = `media/generated/scenarios/${pageId.replaceAll('-', '')}/gallery-${'a'.repeat(64)}.webp`

  it('accepts an owned key with or without a public URL path prefix', () => {
    expect(
      isGeneratedMediaUrlFor(
        `https://media.example.com/${key}`,
        'scenarios',
        pageId,
        'gallery'
      )
    ).toBe(true)
    expect(
      isGeneratedMediaUrlFor(
        `https://media.example.com/assets/${key}`,
        'scenarios',
        pageId,
        'gallery'
      )
    ).toBe(true)
  })

  it('rejects the wrong owner, variant, hash, or URL contract', () => {
    expect(
      isGeneratedMediaUrlFor(
        `https://media.example.com/${key}`,
        'sources',
        pageId,
        'gallery'
      )
    ).toBe(false)
    expect(
      isGeneratedMediaUrlFor(
        `https://media.example.com/${key}`,
        'scenarios',
        pageId,
        'detail'
      )
    ).toBe(false)
    expect(
      isGeneratedMediaUrlFor(
        `https://media.example.com/${key}?download=1`,
        'scenarios',
        pageId,
        'gallery'
      )
    ).toBe(false)
    expect(
      isGeneratedMediaUrlFor('not-a-url', 'scenarios', pageId, 'gallery')
    ).toBe(false)
  })

  it('accepts only the matching franchise image owner', () => {
    const franchiseId = '3cdedb27-f124-80c3-850f-dadca165c684'
    const franchiseKey = `media/generated/franchises/${franchiseId.replaceAll('-', '')}/detail-${'d'.repeat(64)}.webp`
    const url = `https://media.example.com/${franchiseKey}`

    expect(
      isGeneratedMediaUrlFor(url, 'franchises', franchiseId, 'detail')
    ).toBe(true)
    expect(isGeneratedMediaUrlFor(url, 'sources', franchiseId, 'detail')).toBe(
      false
    )
  })
})

describe('isGeneratedMemeMediaUrlFor', () => {
  const pageId = '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa'
  const key = `media/generated/scenarios/${pageId.replaceAll('-', '')}/memes/gallery-${'a'.repeat(64)}.webp`

  it('accepts only a safe URL with the expected scenario, variant, and hash', () => {
    expect(
      isGeneratedMemeMediaUrlFor(
        `https://media.example.com/assets/${key}`,
        pageId,
        'gallery'
      )
    ).toBe(true)
    expect(
      isGeneratedMemeMediaUrlFor(
        `https://media.example.com/assets/${key}`,
        pageId,
        'detail'
      )
    ).toBe(false)
    expect(
      isGeneratedMemeMediaUrlFor(
        `https://media.example.com/assets/${key}`,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'gallery'
      )
    ).toBe(false)
    expect(
      isGeneratedMemeMediaUrlFor(
        `https://media.example.com/assets/${key}?download=1`,
        pageId,
        'gallery'
      )
    ).toBe(false)
  })
})

describe('allocateStableSlugs', () => {
  it('prunes deleted IDs and releases their slugs for new records', () => {
    expect(
      allocateStableSlugs([{ id: 'new-page-abcdef', title: 'Old title' }], {
        'removed-page': 'old-title'
      })
    ).toEqual({
      'new-page-abcdef': 'old-title'
    })
  })

  it('preserves a surviving ID’s slug when its title changes', () => {
    expect(
      allocateStableSlugs([{ id: 'page-1', title: 'A new title' }], {
        'page-1': 'the-original-url'
      })
    ).toEqual({ 'page-1': 'the-original-url' })
  })

  it('resolves new-record collisions deterministically by ID', () => {
    expect(
      allocateStableSlugs(
        [
          { id: '00000000-0000-0000-0000-000000abcdef', title: 'Same' },
          { id: '00000000-0000-0000-0000-000000123456', title: 'Same' }
        ],
        {}
      )
    ).toEqual({
      '00000000-0000-0000-0000-000000123456': 'same',
      '00000000-0000-0000-0000-000000abcdef': 'same-abcdef'
    })
  })
})

describe('retrieveRelationIds', () => {
  it('preserves the authored order of inline franchise relations', async () => {
    const retrieve = async () => {
      throw new Error('Inline relations should not require retrieval')
    }

    await expect(
      retrieveRelationIds(
        'source-1',
        'media-franchises',
        [{ id: 'spider-man' }, { id: 'marvel' }],
        retrieve
      )
    ).resolves.toEqual(['spider-man', 'marvel'])
  })

  it('retrieves every page when the inline relation reaches Notion’s limit', async () => {
    const inline = Array.from({ length: 25 }, (_, index) => ({
      id: `inline-${index}`
    }))

    const ids = await retrieveRelationIds(
      'scenario-1',
      'relation-property',
      inline,
      async ({ start_cursor: startCursor }) =>
        startCursor
          ? relationPage([{ id: 'related-26' }], null)
          : relationPage([{ id: 'related-1' }], 'next-page')
    )

    expect(ids).toEqual(['related-1', 'related-26'])
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

function relationPage(
  relations: readonly { id: string }[],
  nextCursor: string | null
) {
  return {
    type: 'property_item' as const,
    property_item: {
      type: 'relation' as const,
      relation: {},
      next_url: null,
      id: 'relation-property'
    },
    object: 'list' as const,
    next_cursor: nextCursor,
    has_more: nextCursor !== null,
    results: relations.map(({ id }) => ({
      type: 'relation' as const,
      relation: { id },
      object: 'property_item' as const,
      id: 'relation-property'
    }))
  }
}
