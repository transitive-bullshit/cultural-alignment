import { describe, expect, it } from 'vitest'

import {
  MEME_MEDIA_PIPELINE_VERSION,
  memeMediaDescriptorFastPath,
  memeMediaDescriptorObjectKey,
  memeMediaDescriptorSchema,
  parseMemeMediaDescriptor,
  parseMemeMediaDescriptorJson,
  type MemeMediaDescriptor
} from './meme-media-descriptor'

const notionId = '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa'

describe('memeMediaDescriptorSchema', () => {
  it('preserves an ordered bundle of hosted and external meme media', () => {
    const descriptor = memeDescriptor()

    expect(parseMemeMediaDescriptor(descriptor)).toEqual(descriptor)
    expect(
      parseMemeMediaDescriptor(descriptor).memes.map(
        ({ source }) => source.name
      )
    ).toEqual(['hosted-meme.jpg', 'external-meme.png'])
    expect(parseMemeMediaDescriptor(descriptor).memes[1]?.source).toEqual({
      kind: 'external',
      name: 'external-meme.png',
      url: 'https://images.example.com/meme.png?version=2#asset'
    })
  })

  it('accepts an empty bundle as durable absent-media state', () => {
    const descriptor = { ...memeDescriptor(), memes: [] }

    expect(parseMemeMediaDescriptor(descriptor)).toEqual(descriptor)
  })

  it('never accepts a signed URL or expiry marker for a hosted source', () => {
    const signedUrl = structuredClone(memeDescriptor())
    Object.assign(signedUrl.memes[0]!.source, {
      url: 'https://notion.example.com/temporary-signed-url?signature=secret'
    })
    const expiry = structuredClone(memeDescriptor())
    Object.assign(expiry.memes[0]!.source, {
      expiryTime: '2026-08-31T09:15:00.000Z'
    })

    expect(memeMediaDescriptorSchema.safeParse(signedUrl).success).toBe(false)
    expect(memeMediaDescriptorSchema.safeParse(expiry).success).toBe(false)
  })

  it('requires safe exact URL identities for external sources', () => {
    const unsafe = structuredClone(memeDescriptor())
    const source = unsafe.memes[1]!.source
    if (source.kind !== 'external') throw new Error('Expected external source')
    source.url = 'https://user:password@images.example.com/meme.png'

    expect(memeMediaDescriptorSchema.safeParse(unsafe).success).toBe(false)
  })

  it('rejects unknown descriptor, item, and payload fields', () => {
    const descriptorField = {
      ...memeDescriptor(),
      sourceUrls: ['https://notion.example.com/signed']
    }
    const itemField = structuredClone(memeDescriptor())
    Object.assign(itemField.memes[0]!, { index: 0 })
    const mediaField = structuredClone(memeDescriptor())
    Object.assign(mediaField.memes[0]!.media, {
      gallerySrc: 'https://media.example.com/meme.webp'
    })

    expect(memeMediaDescriptorSchema.safeParse(descriptorField).success).toBe(
      false
    )
    expect(memeMediaDescriptorSchema.safeParse(itemField).success).toBe(false)
    expect(memeMediaDescriptorSchema.safeParse(mediaField).success).toBe(false)
  })

  it('binds every generated key to the record, variant, and output hash', () => {
    const wrongOwner = structuredClone(memeDescriptor())
    wrongOwner.memes[0]!.media.galleryKey =
      wrongOwner.memes[0]!.media.galleryKey.replace(
        notionId.replaceAll('-', ''),
        'a'.repeat(32)
      )
    const wrongVariant = structuredClone(memeDescriptor())
    wrongVariant.memes[0]!.media.galleryKey =
      wrongVariant.memes[0]!.media.galleryKey.replace('/gallery-', '/detail-')
    const wrongHash = structuredClone(memeDescriptor())
    wrongHash.memes[0]!.media.detailKey =
      wrongHash.memes[0]!.media.detailKey.replace(
        'c'.repeat(64),
        '0'.repeat(64)
      )

    expect(memeMediaDescriptorSchema.safeParse(wrongOwner).success).toBe(false)
    expect(memeMediaDescriptorSchema.safeParse(wrongVariant).success).toBe(
      false
    )
    expect(memeMediaDescriptorSchema.safeParse(wrongHash).success).toBe(false)
  })
})

describe('meme descriptor binding and reuse', () => {
  it('uses one separately keyed state bundle per scenario', () => {
    expect(memeMediaDescriptorObjectKey(notionId.toUpperCase())).toBe(
      'media/state/scenario-memes/3c6edb27f12480cc92d5c8f2f2e3a7fa.json'
    )
    expect(() => memeMediaDescriptorObjectKey('../not-a-notion-id')).toThrow(
      'Invalid Notion ID for meme media descriptor'
    )
  })

  it('accepts equivalent Notion ID spellings and rejects another record', () => {
    expect(
      parseMemeMediaDescriptor(memeDescriptor(), {
        notionId: notionId.replaceAll('-', '').toUpperCase()
      })
    ).toEqual(memeDescriptor())
    expect(() =>
      parseMemeMediaDescriptor(memeDescriptor(), {
        notionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      })
    ).toThrow('Meme media descriptor is bound to')
  })

  it('parses JSON and distinguishes malformed descriptor bodies', () => {
    const descriptor = memeDescriptor()

    expect(
      parseMemeMediaDescriptorJson(JSON.stringify(descriptor), { notionId })
    ).toEqual(descriptor)
    expect(() => parseMemeMediaDescriptorJson('{')).toThrow(
      'Meme media descriptor body is not valid JSON'
    )
  })

  it('reuses only the current pipeline and exact page edit marker', () => {
    const descriptor = memeDescriptor()
    const input = {
      descriptor,
      pageLastEditedTime: descriptor.pageLastEditedTime,
      force: false,
      sources: descriptor.memes.map(({ source }) => source)
    }

    expect(memeMediaDescriptorFastPath(input)).toBe(descriptor)
    expect(memeMediaDescriptorFastPath({ ...input, force: true })).toBeNull()
    expect(
      memeMediaDescriptorFastPath({
        ...input,
        pageLastEditedTime: '2026-08-31T08:16:00.000Z'
      })
    ).toBeNull()
    expect(
      memeMediaDescriptorFastPath({
        ...input,
        descriptor: { ...descriptor, pipelineVersion: 999 }
      })
    ).toBeNull()
    expect(
      memeMediaDescriptorFastPath({ ...input, descriptor: null })
    ).toBeNull()
  })

  it('uses an empty bundle as durable state and rejects stale media', () => {
    const descriptor = memeDescriptor()
    const emptyDescriptor = { ...descriptor, memes: [] }
    const input = {
      pageLastEditedTime: descriptor.pageLastEditedTime,
      force: false,
      sources: []
    }

    expect(
      memeMediaDescriptorFastPath({ ...input, descriptor: emptyDescriptor })
    ).toBe(emptyDescriptor)
    expect(memeMediaDescriptorFastPath({ ...input, descriptor })).toBeNull()
  })

  it('requires the current ordered source identities for reuse', () => {
    const descriptor = memeDescriptor()
    const sources = descriptor.memes.map(({ source }) => source)

    expect(
      memeMediaDescriptorFastPath({
        descriptor,
        pageLastEditedTime: descriptor.pageLastEditedTime,
        force: false,
        sources: [...sources].reverse()
      })
    ).toBeNull()
  })
})

function memeDescriptor(): MemeMediaDescriptor {
  const root = `media/generated/scenarios/${notionId.replaceAll('-', '')}/memes`

  return {
    schemaVersion: 1,
    collection: 'scenario-memes',
    notionId,
    pageLastEditedTime: '2026-08-31T08:15:00.000Z',
    pipelineVersion: MEME_MEDIA_PIPELINE_VERSION,
    state: 'bundle',
    memes: [
      {
        source: { kind: 'file', name: 'hosted-meme.jpg' },
        media: memePayload(root, 'a', 'b', 'c')
      },
      {
        source: {
          kind: 'external',
          name: 'external-meme.png',
          url: 'https://images.example.com/meme.png?version=2#asset'
        },
        media: memePayload(root, 'd', 'e', 'f')
      }
    ]
  }
}

function memePayload(
  root: string,
  sourceCharacter: string,
  galleryCharacter: string,
  detailCharacter: string
) {
  const galleryHash = galleryCharacter.repeat(64)
  const detailHash = detailCharacter.repeat(64)

  return {
    sourceHash: sourceCharacter.repeat(64),
    galleryHash,
    detailHash,
    galleryKey: `${root}/gallery-${galleryHash}.webp`,
    detailKey: `${root}/detail-${detailHash}.webp`,
    width: 1920,
    height: 1080,
    blurDataURL:
      'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA=='
  }
}
