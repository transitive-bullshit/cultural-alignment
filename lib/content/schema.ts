import { z } from 'zod'

const idSchema = z.string().trim().min(1)
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const localMediaPathSchema = z
  .string()
  .startsWith('/media/')
  .refine((value) => {
    try {
      const segments = decodeURIComponent(value).split('/')
      return (
        !value.includes('\\') &&
        !value.includes('\0') &&
        !segments.includes('.') &&
        !segments.includes('..')
      )
    } catch {
      return false
    }
  }, 'Media path must remain under /media')

export const focalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
})

export const scenarioImageSchema = z.object({
  gallerySrc: localMediaPathSchema,
  detailSrc: localMediaPathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1),
  focalPoint: focalPointSchema.optional()
})

export const scenarioVideoSchema = z.object({
  provider: z.literal('youtube'),
  id: z.string().trim().min(1),
  startSeconds: z.number().int().nonnegative().optional()
})

export const scenarioRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1),
  sourceId: idSchema,
  episode: z
    .object({
      label: z.string().trim().min(1),
      href: z.url().optional()
    })
    .optional(),
  releaseDate: z.iso.date().nullable(),
  featured: z.boolean(),
  riskFamilyIds: z.array(idSchema),
  conceptIds: z.array(idSchema),
  image: scenarioImageSchema,
  video: scenarioVideoSchema.nullable(),
  scene: z.string().trim().min(1),
  whyAnalogyWorks: z.string().trim().min(1),
  caveats: z.string().trim().min(1)
})

export const sourceRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1),
  kind: z.enum(['film', 'television', 'unknown']),
  description: z.string().trim().min(1).optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        href: z.url()
      })
    )
    .optional()
})

export const riskFamilyRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  canonicalUrl: z.url().optional(),
  artworkSrc: localMediaPathSchema.optional(),
  accentToken: z.string().trim().min(1).optional()
})

export const conceptRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  canonicalUrls: z.array(z.url()).optional(),
  artworkSrc: localMediaPathSchema.optional()
})

export const contentSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  scenarios: z.array(scenarioRecordSchema),
  sources: z.array(sourceRecordSchema),
  riskFamilies: z.array(riskFamilyRecordSchema),
  concepts: z.array(conceptRecordSchema)
})

export type FocalPoint = z.infer<typeof focalPointSchema>
export type ScenarioImage = z.infer<typeof scenarioImageSchema>
export type ScenarioVideo = z.infer<typeof scenarioVideoSchema>
export type ScenarioRecord = z.infer<typeof scenarioRecordSchema>
export type SourceRecord = z.infer<typeof sourceRecordSchema>
export type RiskFamilyRecord = z.infer<typeof riskFamilyRecordSchema>
export type ConceptRecord = z.infer<typeof conceptRecordSchema>
export type ContentSnapshot = z.infer<typeof contentSnapshotSchema>
