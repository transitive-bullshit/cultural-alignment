import { describe, expect, it } from 'vitest'

import type {
  AbsentMediaDescriptor,
  ImageMediaDescriptor,
  MediaSourceIdentity
} from './media-descriptor'
import { descriptorMatchesSource, mediaDescriptorFastPath } from './media-reuse'

const pageLastEditedTime = '2026-08-31T08:15:00.000Z'
const pipelineVersion = 3
type NotionFileSource = Extract<
  MediaSourceIdentity,
  { readonly type: 'notion'; readonly kind: 'file' }
>
type FallbackSource = Extract<
  MediaSourceIdentity,
  { readonly type: 'fallback' }
>
type NotionFileDescriptor = ImageMediaDescriptor & {
  readonly source: NotionFileSource
}
type FallbackDescriptor = ImageMediaDescriptor & {
  readonly source: FallbackSource
}

describe('mediaDescriptorFastPath', () => {
  it('reuses a matching image without further inspection', () => {
    const descriptor = imageDescriptor()

    expect(
      mediaDescriptorFastPath({
        descriptor,
        pageLastEditedTime,
        pipelineVersion,
        force: false
      })
    ).toEqual({ kind: 'image', descriptor, needsDescriptorWrite: false })
  })

  it('reuses an unchanged absent poster', () => {
    expect(
      mediaDescriptorFastPath({
        descriptor: absentDescriptor(),
        pageLastEditedTime,
        pipelineVersion,
        force: false
      })
    ).toEqual({ kind: 'absent' })
  })

  it('inspects when forced or when the page or pipeline changed', () => {
    const descriptor = imageDescriptor()
    for (const input of [
      { force: true, pageLastEditedTime, pipelineVersion },
      {
        force: false,
        pageLastEditedTime: '2026-08-31T08:16:00.000Z',
        pipelineVersion
      },
      { force: false, pageLastEditedTime, pipelineVersion: 4 }
    ]) {
      expect(mediaDescriptorFastPath({ descriptor, ...input })).toEqual({
        kind: 'inspect'
      })
    }
  })

  it('checks fallback identity and refreshes fallback caption', () => {
    const descriptor = fallbackDescriptor()

    expect(
      mediaDescriptorFastPath({
        descriptor,
        pageLastEditedTime,
        pipelineVersion,
        force: false,
        fallback: {
          imageBlockId: 'youtube-thumbnail:new',
          url: descriptor.source.url,
          caption: descriptor.media.caption
        }
      })
    ).toEqual({ kind: 'inspect' })

    const result = mediaDescriptorFastPath({
      descriptor,
      pageLastEditedTime,
      pipelineVersion,
      force: false,
      fallback: {
        imageBlockId: descriptor.source.imageBlockId,
        url: descriptor.source.url,
        caption: 'Updated source title'
      }
    })
    expect(result.kind).toBe('image')
    if (result.kind !== 'image') throw new Error('Expected image reuse')
    expect(result.needsDescriptorWrite).toBe(true)
    expect(result.descriptor.media.caption).toBe('Updated source title')
  })
})

describe('descriptorMatchesSource', () => {
  it('requires image state, current pipeline, and exact source identity', () => {
    const descriptor = imageDescriptor()

    expect(
      descriptorMatchesSource(descriptor, descriptor.source, pipelineVersion)
    ).toBe(true)
    expect(
      descriptorMatchesSource(
        descriptor,
        { ...descriptor.source, blockLastEditedTime: pageLastEditedTime },
        pipelineVersion
      )
    ).toBe(false)
    expect(
      descriptorMatchesSource(
        absentDescriptor(),
        descriptor.source,
        pipelineVersion
      )
    ).toBe(false)
  })
})

function imageDescriptor(): NotionFileDescriptor {
  const notionId = '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa'
  const galleryHash = 'b'.repeat(64)
  const detailHash = 'c'.repeat(64)
  const root = `media/generated/scenarios/${notionId.replaceAll('-', '')}`
  return {
    schemaVersion: 1,
    collection: 'scenarios',
    notionId,
    pageLastEditedTime,
    pipelineVersion,
    state: 'image',
    source: {
      type: 'notion',
      kind: 'file',
      blockId: '4d7fec38-0350-41aa-961a-65ef58bf5192',
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
      additionalImageCount: 0,
      caption: 'A still'
    }
  }
}

function fallbackDescriptor(): FallbackDescriptor {
  return {
    ...imageDescriptor(),
    source: {
      type: 'fallback',
      imageBlockId: 'youtube-thumbnail:current',
      url: 'https://i.ytimg.com/vi/current/hqdefault.jpg'
    }
  }
}

function absentDescriptor(): AbsentMediaDescriptor {
  return {
    schemaVersion: 1,
    collection: 'sources',
    notionId: '3caedb27-f124-8031-9026-e39581c85c47',
    pageLastEditedTime,
    pipelineVersion,
    state: 'absent'
  }
}
