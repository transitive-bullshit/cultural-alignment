import { z } from 'zod'

const idSchema = z.string().trim().min(1)
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const remoteMediaUrlSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  )
}, 'Remote media URL must use HTTPS without credentials, query parameters, or fragments')

const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, 'URL must use HTTP or HTTPS')

const citationTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) => !/^canonical source(?:\s+\d+)?$/i.test(value),
    'Citation title must not expose the canonical-source field name'
  )

export const focalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
})

export const blurDataUrlSchema = z
  .string()
  .max(512)
  .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/)

export const contentImageSchema = z.object({
  gallerySrc: remoteMediaUrlSchema,
  detailSrc: remoteMediaUrlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1),
  blurDataURL: blurDataUrlSchema,
  focalPoint: focalPointSchema.optional()
})

export const scenarioImageSchema = contentImageSchema

export const scenarioVideoSchema = z.object({
  provider: z.literal('youtube'),
  id: z.string().trim().min(1),
  startSeconds: z.number().int().nonnegative().optional()
})

export const citationSchema = z.object({
  href: httpUrlSchema,
  title: citationTitleSchema,
  publisher: z.string().trim().min(1).max(100).nullable()
})

const searchKeywordsSchema = z.array(z.string().trim().min(1)).default([])

export const scenarioRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1),
  keywords: searchKeywordsSchema,
  sourceId: idSchema,
  episode: z
    .object({
      label: z.string().trim().min(1),
      href: z.url().optional()
    })
    .optional(),
  releaseDate: z.iso.date().nullable(),
  featured: z.boolean(),
  riskFamilyIds: z.array(idSchema).min(1),
  conceptIds: z.array(idSchema).min(1),
  image: scenarioImageSchema,
  memes: z.array(contentImageSchema).default([]),
  video: scenarioVideoSchema.nullable(),
  scene: z.string().trim().min(1),
  whyAnalogyWorks: z.string().trim().min(1),
  caveats: z.string().trim().min(1)
})

export const sourceRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1),
  keywords: searchKeywordsSchema,
  sourceType: z.enum(['movie', 'tv-show']),
  description: z.string().trim().min(1).nullable(),
  releaseDate: z.iso.date().nullable(),
  poster: contentImageSchema.nullable(),
  imdbUrl: z.url().nullable(),
  rottenTomatoesUrl: z.url().nullable(),
  youtubeTrailerUrl: z.url().nullable(),
  relatedSourceIds: z.array(idSchema)
})

export const riskFamilyRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  shortName: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  description: z.string().trim().min(1),
  wikipediaUrl: z.url().nullable(),
  citations: z.array(citationSchema).min(1).max(3)
})

export const conceptRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  shortName: z.string().trim().min(1),
  longName: z.string().trim().min(1),
  keywords: searchKeywordsSchema,
  description: z.string().trim().min(1),
  wikipediaUrl: z.url().nullable(),
  citations: z.array(citationSchema).min(1).max(3)
})

export const contentSnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  scenarios: z.array(scenarioRecordSchema),
  sources: z.array(sourceRecordSchema),
  riskFamilies: z.array(riskFamilyRecordSchema),
  concepts: z.array(conceptRecordSchema)
})

export type FocalPoint = z.infer<typeof focalPointSchema>
export type ContentImage = z.infer<typeof contentImageSchema>
export type ScenarioImage = ContentImage
export type ScenarioVideo = z.infer<typeof scenarioVideoSchema>
export type Citation = z.infer<typeof citationSchema>
export type ScenarioRecord = z.infer<typeof scenarioRecordSchema>
export type SourceRecord = z.infer<typeof sourceRecordSchema>
export type RiskFamilyRecord = z.infer<typeof riskFamilyRecordSchema>
export type ConceptRecord = z.infer<typeof conceptRecordSchema>
export type ContentSnapshot = z.infer<typeof contentSnapshotSchema>
