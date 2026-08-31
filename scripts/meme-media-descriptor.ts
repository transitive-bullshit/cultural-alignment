import { z } from 'zod'

import { blurDataUrlSchema } from '../lib/content/schema'
import { generatedMemeMediaObjectKey } from './sync-utils'

export const MEME_MEDIA_PIPELINE_VERSION = 1

const notionIdPattern =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const sha256Pattern = /^[0-9a-f]{64}$/
const generatedMemeMediaObjectKeyPattern =
  /^media\/generated\/scenarios\/[0-9a-f]{32}\/memes\/(?:gallery|detail)-[0-9a-f]{64}\.webp$/

const notionIdSchema = z.string().regex(notionIdPattern)
const sha256Schema = z.string().regex(sha256Pattern)
const generatedMemeMediaObjectKeySchema = z
  .string()
  .regex(generatedMemeMediaObjectKeyPattern)
const sourceNameSchema = z.string().min(1)
const externalSourceUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    !url.username &&
    !url.password
  )
}, 'External meme source URL must use HTTP or HTTPS without credentials')

const hostedMemeMediaSourceIdentitySchema = z.strictObject({
  kind: z.literal('file'),
  name: sourceNameSchema
})

const externalMemeMediaSourceIdentitySchema = z.strictObject({
  kind: z.literal('external'),
  name: sourceNameSchema,
  url: externalSourceUrlSchema
})

export const memeMediaSourceIdentitySchema = z.discriminatedUnion('kind', [
  hostedMemeMediaSourceIdentitySchema,
  externalMemeMediaSourceIdentitySchema
])

export const memeMediaPayloadSchema = z.strictObject({
  sourceHash: sha256Schema,
  galleryHash: sha256Schema,
  detailHash: sha256Schema,
  galleryKey: generatedMemeMediaObjectKeySchema,
  detailKey: generatedMemeMediaObjectKeySchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataURL: blurDataUrlSchema
})

export const memeMediaItemSchema = z.strictObject({
  source: memeMediaSourceIdentitySchema,
  media: memeMediaPayloadSchema
})

export const memeMediaDescriptorSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    collection: z.literal('scenario-memes'),
    notionId: notionIdSchema,
    pageLastEditedTime: z.iso.datetime({ offset: true }),
    pipelineVersion: z.number().int().positive(),
    state: z.literal('bundle'),
    memes: z.array(memeMediaItemSchema)
  })
  .superRefine((descriptor, context) => {
    descriptor.memes.forEach(({ media }, index) => {
      for (const variant of ['gallery', 'detail'] as const) {
        const hash = media[`${variant}Hash`]
        const actualKey = media[`${variant}Key`]
        const expectedKey = generatedMemeMediaObjectKey(
          descriptor.notionId,
          variant,
          hash
        )

        if (actualKey !== expectedKey) {
          context.addIssue({
            code: 'custom',
            message: `${variant}Key is not bound to this meme descriptor`,
            path: ['memes', index, 'media', `${variant}Key`]
          })
        }
      }
    })
  })

export type MemeMediaSourceIdentity = z.infer<
  typeof memeMediaSourceIdentitySchema
>
export type MemeMediaPayload = z.infer<typeof memeMediaPayloadSchema>
export type MemeMediaItem = z.infer<typeof memeMediaItemSchema>
export type MemeMediaDescriptor = z.infer<typeof memeMediaDescriptorSchema>

export type MemeMediaDescriptorBinding = {
  readonly notionId: string
}

export function memeMediaDescriptorObjectKey(notionId: string) {
  return `media/state/scenario-memes/${compactNotionId(notionId)}.json`
}

export function parseMemeMediaDescriptor(
  input: unknown,
  binding?: MemeMediaDescriptorBinding
): MemeMediaDescriptor {
  const descriptor = memeMediaDescriptorSchema.parse(input)
  if (!binding) return descriptor

  const expectedNotionId = compactNotionId(binding.notionId)
  const actualNotionId = compactNotionId(descriptor.notionId)
  if (actualNotionId !== expectedNotionId) {
    throw new Error(
      `Meme media descriptor is bound to ${actualNotionId}, not ${expectedNotionId}`
    )
  }

  return descriptor
}

export function parseMemeMediaDescriptorJson(
  body: string,
  binding?: MemeMediaDescriptorBinding
) {
  let input: unknown
  try {
    input = JSON.parse(body) as unknown
  } catch (err) {
    throw new Error('Meme media descriptor body is not valid JSON', {
      cause: err
    })
  }
  return parseMemeMediaDescriptor(input, binding)
}

export function memeMediaDescriptorFastPath(input: {
  readonly descriptor: MemeMediaDescriptor | null
  readonly pageLastEditedTime: string
  readonly force: boolean
  readonly sources: readonly MemeMediaSourceIdentity[]
}) {
  const descriptor = input.descriptor
  if (
    input.force ||
    !descriptor ||
    descriptor.pipelineVersion !== MEME_MEDIA_PIPELINE_VERSION ||
    descriptor.pageLastEditedTime !== input.pageLastEditedTime ||
    descriptor.memes.length !== input.sources.length ||
    descriptor.memes.some(
      (item, index) =>
        !memeMediaSourceIdentitiesEqual(item.source, input.sources[index]!)
    )
  ) {
    return null
  }

  return descriptor
}

function memeMediaSourceIdentitiesEqual(
  left: MemeMediaSourceIdentity,
  right: MemeMediaSourceIdentity
) {
  if (left.kind !== right.kind || left.name !== right.name) return false
  return left.kind === 'file' || right.kind === 'file' || left.url === right.url
}

function compactNotionId(notionId: string) {
  if (!notionIdPattern.test(notionId)) {
    throw new Error(`Invalid Notion ID for meme media descriptor: ${notionId}`)
  }
  return notionId.replaceAll('-', '').toLowerCase()
}
