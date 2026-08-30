import { z } from 'zod'

import { blurDataUrlSchema } from '../lib/content/schema'
import { generatedMediaObjectKey } from './sync-utils'

const notionIdPattern =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const sha256Pattern = /^[0-9a-f]{64}$/
const generatedMediaObjectKeyPattern =
  /^media\/generated\/(?:scenarios|sources)\/[0-9a-f]{32}\/(?:gallery|detail)-[0-9a-f]{64}\.webp$/

const notionIdSchema = z.string().regex(notionIdPattern)
const sha256Schema = z.string().regex(sha256Pattern)
const generatedMediaObjectKeySchema = z
  .string()
  .regex(generatedMediaObjectKeyPattern)
const sourceUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    !url.username &&
    !url.password
  )
}, 'Image source URL must use HTTP or HTTPS without credentials')

export const mediaCollectionSchema = z.enum(['scenarios', 'sources'])

const notionFileSourceSchema = z.strictObject({
  type: z.literal('notion'),
  kind: z.literal('file'),
  blockId: notionIdSchema,
  blockLastEditedTime: z.iso.datetime({ offset: true })
})

const notionExternalSourceSchema = z.strictObject({
  type: z.literal('notion'),
  kind: z.literal('external'),
  blockId: notionIdSchema,
  blockLastEditedTime: z.iso.datetime({ offset: true }),
  url: sourceUrlSchema
})

const fallbackSourceSchema = z.strictObject({
  type: z.literal('fallback'),
  imageBlockId: z.string().min(1),
  url: sourceUrlSchema
})

export const mediaSourceIdentitySchema = z.union([
  notionFileSourceSchema,
  notionExternalSourceSchema,
  fallbackSourceSchema
])

export const reusableMediaPayloadSchema = z.strictObject({
  sourceHash: sha256Schema,
  galleryHash: sha256Schema,
  detailHash: sha256Schema,
  galleryKey: generatedMediaObjectKeySchema,
  detailKey: generatedMediaObjectKeySchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataURL: blurDataUrlSchema,
  additionalImageCount: z.number().int().nonnegative(),
  caption: z.string()
})

const mediaDescriptorRecordFields = {
  schemaVersion: z.literal(1),
  collection: mediaCollectionSchema,
  notionId: notionIdSchema,
  pageLastEditedTime: z.iso.datetime({ offset: true }),
  pipelineVersion: z.number().int().positive()
}

export const mediaDescriptorSchema = z
  .discriminatedUnion('state', [
    z.strictObject({
      ...mediaDescriptorRecordFields,
      state: z.literal('image'),
      source: mediaSourceIdentitySchema,
      media: reusableMediaPayloadSchema
    }),
    z.strictObject({
      ...mediaDescriptorRecordFields,
      collection: z.literal('sources'),
      state: z.literal('absent')
    })
  ])
  .superRefine((descriptor, context) => {
    if (descriptor.state === 'absent') return

    for (const variant of ['gallery', 'detail'] as const) {
      const hash = descriptor.media[`${variant}Hash`]
      const actualKey = descriptor.media[`${variant}Key`]
      const expectedKey = generatedMediaObjectKey(
        descriptor.collection,
        descriptor.notionId,
        variant,
        hash
      )

      if (actualKey !== expectedKey) {
        context.addIssue({
          code: 'custom',
          message: `${variant}Key is not bound to this descriptor`,
          path: ['media', `${variant}Key`]
        })
      }
    }
  })

export type MediaCollection = z.infer<typeof mediaCollectionSchema>
export type MediaSourceIdentity = z.infer<typeof mediaSourceIdentitySchema>
export type ReusableMediaPayload = z.infer<typeof reusableMediaPayloadSchema>
export type MediaDescriptor = z.infer<typeof mediaDescriptorSchema>
export type ImageMediaDescriptor = Extract<
  MediaDescriptor,
  { readonly state: 'image' }
>
export type AbsentMediaDescriptor = Extract<
  MediaDescriptor,
  { readonly state: 'absent' }
>

export type MediaDescriptorBinding = {
  readonly collection: MediaCollection
  readonly notionId: string
}

export function mediaDescriptorObjectKey(
  collection: MediaCollection,
  notionId: string
) {
  return `media/state/${collection}/${compactNotionId(notionId)}.json`
}

export function parseMediaDescriptor(
  input: unknown,
  binding?: MediaDescriptorBinding
): MediaDescriptor {
  const descriptor = mediaDescriptorSchema.parse(input)
  if (!binding) return descriptor

  const expectedNotionId = compactNotionId(binding.notionId)
  const actualNotionId = compactNotionId(descriptor.notionId)
  if (
    descriptor.collection !== binding.collection ||
    actualNotionId !== expectedNotionId
  ) {
    throw new Error(
      `Media descriptor is bound to ${descriptor.collection}/${actualNotionId}, not ${binding.collection}/${expectedNotionId}`
    )
  }

  return descriptor
}

export function parseMediaDescriptorJson(
  body: string,
  binding?: MediaDescriptorBinding
) {
  let input: unknown
  try {
    input = JSON.parse(body) as unknown
  } catch (err) {
    throw new Error('Media descriptor body is not valid JSON', { cause: err })
  }
  return parseMediaDescriptor(input, binding)
}

export function mediaSourceImageBlockId(source: MediaSourceIdentity) {
  return source.type === 'notion' ? source.blockId : source.imageBlockId
}

function compactNotionId(notionId: string) {
  if (!notionIdPattern.test(notionId)) {
    throw new Error(`Invalid Notion ID for media descriptor: ${notionId}`)
  }
  return notionId.replaceAll('-', '').toLowerCase()
}
