import { isDeepStrictEqual } from 'node:util'

import type {
  ImageMediaDescriptor,
  MediaDescriptor,
  MediaSourceIdentity
} from './media-descriptor'

type CurrentFallback = {
  readonly imageBlockId: string
  readonly url: string
  readonly caption: string
}

type MediaDescriptorFastPath =
  | { readonly kind: 'inspect' }
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'image'
      readonly descriptor: ImageMediaDescriptor
      readonly needsDescriptorWrite: boolean
    }

export function mediaDescriptorFastPath(input: {
  readonly descriptor: MediaDescriptor | null
  readonly pageLastEditedTime: string
  readonly pipelineVersion: number
  readonly force: boolean
  readonly fallback?: CurrentFallback
}): MediaDescriptorFastPath {
  const descriptor = input.descriptor
  if (
    input.force ||
    !descriptor ||
    descriptor.pipelineVersion !== input.pipelineVersion ||
    descriptor.pageLastEditedTime !== input.pageLastEditedTime
  ) {
    return { kind: 'inspect' }
  }

  if (descriptor.state === 'absent') return { kind: 'absent' }
  if (descriptor.source.type !== 'fallback') {
    return { kind: 'image', descriptor, needsDescriptorWrite: false }
  }

  const fallback = input.fallback
  if (
    !fallback ||
    descriptor.source.imageBlockId !== fallback.imageBlockId ||
    descriptor.source.url !== fallback.url
  ) {
    return { kind: 'inspect' }
  }

  if (descriptor.media.caption === fallback.caption) {
    return { kind: 'image', descriptor, needsDescriptorWrite: false }
  }

  return {
    kind: 'image',
    descriptor: {
      ...descriptor,
      media: { ...descriptor.media, caption: fallback.caption }
    },
    needsDescriptorWrite: true
  }
}

export function descriptorMatchesSource(
  descriptor: MediaDescriptor | null,
  source: MediaSourceIdentity,
  pipelineVersion: number
): descriptor is ImageMediaDescriptor {
  return (
    descriptor?.state === 'image' &&
    descriptor.pipelineVersion === pipelineVersion &&
    isDeepStrictEqual(descriptor.source, source)
  )
}
