import { describe, expect, it } from 'vitest'

import {
  mediaDescriptorObjectKey,
  mediaDescriptorSchema,
  mediaSourceImageBlockId,
  parseMediaDescriptor,
  parseMediaDescriptorJson
} from './media-descriptor'

const notionId = '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa'
const blockId = '4d7fec38-0350-41aa-961a-65ef58bf5192'
const galleryHash = 'b'.repeat(64)
const detailHash = 'c'.repeat(64)

describe('mediaDescriptorSchema', () => {
  it('accepts a hosted Notion file identity and its reusable image payload', () => {
    const descriptor = hostedFileDescriptor()

    expect(parseMediaDescriptor(descriptor)).toEqual(descriptor)
  })

  it('accepts a franchise image in its separately owned collection', () => {
    const descriptor = hostedFileDescriptor()
    const franchise = {
      ...descriptor,
      collection: 'franchises' as const,
      media: {
        ...descriptor.media,
        galleryKey: descriptor.media.galleryKey.replace(
          '/scenarios/',
          '/franchises/'
        ),
        detailKey: descriptor.media.detailKey.replace(
          '/scenarios/',
          '/franchises/'
        )
      }
    }

    expect(parseMediaDescriptor(franchise)).toEqual(franchise)
  })

  it('accepts a strict absent-media descriptor', () => {
    const descriptor = {
      schemaVersion: 1 as const,
      collection: 'sources' as const,
      notionId,
      pageLastEditedTime: '2026-08-31T08:15:00.000Z',
      pipelineVersion: 3,
      state: 'absent' as const
    }

    expect(parseMediaDescriptor(descriptor)).toEqual(descriptor)
    expect(
      mediaDescriptorSchema.safeParse({
        ...descriptor,
        media: hostedFileDescriptor().media
      }).success
    ).toBe(false)
    expect(
      mediaDescriptorSchema.safeParse({
        ...descriptor,
        collection: 'scenarios'
      }).success
    ).toBe(false)
    expect(
      mediaDescriptorSchema.safeParse({
        ...descriptor,
        collection: 'franchises'
      }).success
    ).toBe(false)
  })

  it('accepts external Notion and configured fallback identities', () => {
    const external = {
      ...hostedFileDescriptor(),
      source: {
        type: 'notion' as const,
        kind: 'external' as const,
        blockId,
        blockLastEditedTime: '2026-08-31T08:14:00.000Z',
        url: 'https://images.example.com/still.jpg?version=2'
      }
    }
    const fallback = {
      ...hostedFileDescriptor(),
      source: {
        type: 'fallback' as const,
        imageBlockId: 'youtube-thumbnail:2yfXgu37iyI',
        url: 'https://i.ytimg.com/vi/2yfXgu37iyI/hqdefault.jpg'
      }
    }

    expect(parseMediaDescriptor(external)).toEqual(external)
    expect(parseMediaDescriptor(fallback)).toEqual(fallback)
    expect(mediaSourceImageBlockId(external.source)).toBe(blockId)
    expect(mediaSourceImageBlockId(fallback.source)).toBe(
      'youtube-thumbnail:2yfXgu37iyI'
    )
  })

  it('keeps each source identity shape strict', () => {
    const fileWithSignedUrl = {
      ...hostedFileDescriptor(),
      source: {
        ...hostedFileDescriptor().source,
        url: 'https://notion.example.com/temporary-signed-url'
      }
    }
    const externalWithoutUrl = {
      ...hostedFileDescriptor(),
      source: {
        ...hostedFileDescriptor().source,
        kind: 'external'
      }
    }
    const fallbackWithBlockTimestamp = {
      ...hostedFileDescriptor(),
      source: {
        type: 'fallback',
        imageBlockId: 'configured:fallback',
        url: 'https://images.example.com/fallback.jpg',
        blockLastEditedTime: '2026-08-31T08:14:00.000Z'
      }
    }

    expect(mediaDescriptorSchema.safeParse(fileWithSignedUrl).success).toBe(
      false
    )
    expect(mediaDescriptorSchema.safeParse(externalWithoutUrl).success).toBe(
      false
    )
    expect(
      mediaDescriptorSchema.safeParse(fallbackWithBlockTimestamp).success
    ).toBe(false)
  })

  it('rejects unknown descriptor and media fields', () => {
    const descriptorWithUnknownField = {
      ...hostedFileDescriptor(),
      generation: 'unused'
    }
    const descriptorWithUnknownMediaField = {
      ...hostedFileDescriptor(),
      media: {
        ...hostedFileDescriptor().media,
        gallerySrc: 'https://media.example.com/gallery.webp'
      }
    }

    expect(
      mediaDescriptorSchema.safeParse(descriptorWithUnknownField).success
    ).toBe(false)
    expect(
      mediaDescriptorSchema.safeParse(descriptorWithUnknownMediaField).success
    ).toBe(false)
  })

  it('rejects generated keys that do not match the record, variant, or hash', () => {
    const wrongCollection = structuredClone(hostedFileDescriptor())
    wrongCollection.media.galleryKey = wrongCollection.media.galleryKey.replace(
      '/scenarios/',
      '/sources/'
    )
    const wrongVariant = structuredClone(hostedFileDescriptor())
    wrongVariant.media.galleryKey = wrongVariant.media.galleryKey.replace(
      '/gallery-',
      '/detail-'
    )
    const wrongHash = structuredClone(hostedFileDescriptor())
    wrongHash.media.detailKey = wrongHash.media.detailKey.replace(
      detailHash,
      'd'.repeat(64)
    )

    expect(mediaDescriptorSchema.safeParse(wrongCollection).success).toBe(false)
    expect(mediaDescriptorSchema.safeParse(wrongVariant).success).toBe(false)
    expect(mediaDescriptorSchema.safeParse(wrongHash).success).toBe(false)
  })
})

describe('descriptor binding', () => {
  it('accepts the expected collection and equivalent Notion ID spelling', () => {
    expect(
      parseMediaDescriptor(hostedFileDescriptor(), {
        collection: 'scenarios',
        notionId: notionId.replaceAll('-', '').toUpperCase()
      })
    ).toEqual(hostedFileDescriptor())
  })

  it('parses the JSON body and reports malformed JSON separately', () => {
    const descriptor = hostedFileDescriptor()
    expect(
      parseMediaDescriptorJson(JSON.stringify(descriptor), {
        collection: 'scenarios',
        notionId
      })
    ).toEqual(descriptor)
    expect(() => parseMediaDescriptorJson('{')).toThrow(
      'Media descriptor body is not valid JSON'
    )
  })

  it('rejects a descriptor fetched for another collection or record', () => {
    expect(() =>
      parseMediaDescriptor(hostedFileDescriptor(), {
        collection: 'sources',
        notionId
      })
    ).toThrow('Media descriptor is bound to')
    expect(() =>
      parseMediaDescriptor(hostedFileDescriptor(), {
        collection: 'scenarios',
        notionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      })
    ).toThrow('Media descriptor is bound to')
  })

  it('builds one canonical state descriptor key per collection and record', () => {
    expect(mediaDescriptorObjectKey('scenarios', notionId.toUpperCase())).toBe(
      'media/state/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa.json'
    )
    expect(() =>
      mediaDescriptorObjectKey('sources', '../not-a-notion-id')
    ).toThrow('Invalid Notion ID for media descriptor')
  })
})

function hostedFileDescriptor() {
  const root = `media/generated/scenarios/${notionId.replaceAll('-', '')}`

  return {
    schemaVersion: 1 as const,
    collection: 'scenarios' as const,
    notionId,
    pageLastEditedTime: '2026-08-31T08:15:00.000Z',
    pipelineVersion: 3,
    state: 'image' as const,
    source: {
      type: 'notion' as const,
      kind: 'file' as const,
      blockId,
      blockLastEditedTime: '2026-08-31T08:14:00.000Z'
    },
    media: {
      sourceHash: 'a'.repeat(64),
      galleryHash,
      detailHash,
      galleryKey: `${root}/gallery-${galleryHash}.webp`,
      detailKey: `${root}/detail-${detailHash}.webp`,
      width: 1920,
      height: 1080,
      blurDataURL:
        'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
      additionalImageCount: 1,
      caption: 'A still'
    }
  }
}
