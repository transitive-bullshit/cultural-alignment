import { z } from 'zod'

import type { ContentSnapshot } from '../lib/content/schema'
import {
  generatedMediaPublicPaths,
  isGeneratedMediaPublicPath
} from './sync-utils'

export const MEDIA_PIPELINE_VERSION = 1

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const generatedMediaPathSchema = z
  .string()
  .refine(isGeneratedMediaPublicPath, 'Invalid generated media path')

const syncEntryBaseSchema = z.object({
  lastEditedTime: z.string(),
  imageBlockId: z.string(),
  additionalImageCount: z.number().int().nonnegative(),
  sourceHash: sha256Schema,
  gallerySrc: generatedMediaPathSchema,
  detailSrc: generatedMediaPathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string()
})

export const previousSyncEntrySchema = syncEntryBaseSchema.extend({
  pipelineVersion: z.number().int().positive().optional(),
  galleryHash: sha256Schema.optional(),
  detailHash: sha256Schema.optional()
})

export const syncEntrySchema = syncEntryBaseSchema.extend({
  pipelineVersion: z.literal(MEDIA_PIPELINE_VERSION),
  galleryHash: sha256Schema,
  detailHash: sha256Schema
})

const slugMapSchema = z.record(
  z.string().min(1),
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
)

const slugMapsSchema = z.object({
  scenarios: slugMapSchema,
  sources: slugMapSchema,
  riskFamilies: slugMapSchema,
  concepts: slugMapSchema
})

const legacySyncManifestSchema = z.object({
  schemaVersion: z.literal(1),
  slugs: slugMapsSchema,
  entries: z.record(z.string(), previousSyncEntrySchema)
})

const previousCurrentSyncManifestSchema = z.object({
  schemaVersion: z.literal(2),
  slugs: slugMapsSchema,
  entries: z.object({
    scenarios: z.record(z.string(), previousSyncEntrySchema),
    sources: z.record(z.string(), previousSyncEntrySchema)
  })
})

const notionCollectionSchema = z.object({
  databaseId: z.string().min(1),
  dataSourceId: z.string().min(1)
})

export const syncManifestSchema = z.object({
  schemaVersion: z.literal(2),
  notion: z.object({
    apiVersion: z.string().min(1),
    dataSources: z.object({
      scenarios: notionCollectionSchema,
      sources: notionCollectionSchema,
      riskFamilies: notionCollectionSchema,
      concepts: notionCollectionSchema
    })
  }),
  counts: z.object({
    scenarios: z.number().int().nonnegative(),
    sources: z.number().int().nonnegative(),
    riskFamilies: z.number().int().nonnegative(),
    concepts: z.number().int().nonnegative()
  }),
  fixtureScenarioIds: z.array(z.string().min(1)),
  slugs: slugMapsSchema,
  entries: z.object({
    scenarios: z.record(z.string(), syncEntrySchema),
    sources: z.record(z.string(), syncEntrySchema)
  })
})

export type SyncEntry = z.infer<typeof syncEntrySchema>
export type SyncManifest = z.infer<typeof syncManifestSchema>
export type PreviousSyncEntry = z.infer<typeof previousSyncEntrySchema>
export type SlugMaps = z.infer<typeof slugMapsSchema>

export type PreviousSyncManifest = {
  readonly slugs: SlugMaps
  readonly entries: {
    readonly scenarios: Record<string, PreviousSyncEntry>
    readonly sources: Record<string, PreviousSyncEntry>
  }
}

export const emptyPreviousSyncManifest: PreviousSyncManifest = {
  slugs: {
    scenarios: {},
    sources: {},
    riskFamilies: {},
    concepts: {}
  },
  entries: {
    scenarios: {},
    sources: {}
  }
}

export function parsePreviousSyncManifest(
  input: unknown
): PreviousSyncManifest {
  const current = previousCurrentSyncManifestSchema.safeParse(input)
  if (current.success) {
    return {
      slugs: current.data.slugs,
      entries: current.data.entries
    }
  }

  const legacy = legacySyncManifestSchema.parse(input)

  return {
    slugs: emptyPreviousSyncManifest.slugs,
    entries: {
      scenarios: legacy.entries,
      sources: {}
    }
  }
}

export function parseSyncManifest(input: unknown): SyncManifest {
  return syncManifestSchema.parse(input)
}

export function validateSyncManifest(
  input: unknown,
  snapshot: ContentSnapshot
): SyncManifest {
  const manifest = parseSyncManifest(input)
  const collections = [
    ['scenarios', snapshot.scenarios],
    ['sources', snapshot.sources],
    ['riskFamilies', snapshot.riskFamilies],
    ['concepts', snapshot.concepts]
  ] as const

  for (const [name, records] of collections) {
    if (manifest.counts[name] !== records.length) {
      throw new Error(
        `Manifest ${name} count ${manifest.counts[name]} does not match snapshot count ${records.length}`
      )
    }
    const expectedSlugs = Object.fromEntries(
      records.map((record) => [record.id, record.slug])
    )
    if (!recordsMatch(manifest.slugs[name], expectedSlugs)) {
      throw new Error(`Manifest ${name} slugs do not match the snapshot`)
    }
  }

  const scenarioIds = new Set(snapshot.scenarios.map((scenario) => scenario.id))
  for (const fixtureId of manifest.fixtureScenarioIds) {
    if (!scenarioIds.has(fixtureId)) {
      throw new Error(
        `Manifest fixture references unknown scenario ${fixtureId}`
      )
    }
  }

  validateMediaOwnership(
    'scenario',
    'scenarios',
    manifest.entries.scenarios,
    snapshot.scenarios.map((scenario) => ({
      id: scenario.id,
      image: scenario.image
    }))
  )
  validateMediaOwnership(
    'source',
    'sources',
    manifest.entries.sources,
    snapshot.sources.flatMap((source) =>
      source.poster ? [{ id: source.id, image: source.poster }] : []
    )
  )

  return manifest
}

function validateMediaOwnership(
  label: 'scenario' | 'source',
  collection: 'scenarios' | 'sources',
  entries: Readonly<Record<string, SyncEntry>>,
  records: readonly {
    readonly id: string
    readonly image: {
      readonly gallerySrc: string
      readonly detailSrc: string
      readonly width: number
      readonly height: number
    }
  }[]
) {
  const expectedIds = records.map((record) => record.id).toSorted()
  const actualIds = Object.keys(entries).toSorted()
  if (!arraysMatch(actualIds, expectedIds)) {
    throw new Error(
      `Manifest ${label} image ownership does not match snapshot ${label === 'source' ? 'posters' : 'images'}`
    )
  }

  for (const { id, image } of records) {
    const entry = entries[id]!
    const expectedPaths = generatedMediaPublicPaths(collection, id)
    if (
      entry.gallerySrc !== expectedPaths.gallerySrc ||
      entry.detailSrc !== expectedPaths.detailSrc ||
      entry.gallerySrc !== image.gallerySrc ||
      entry.detailSrc !== image.detailSrc ||
      entry.width !== image.width ||
      entry.height !== image.height
    ) {
      throw new Error(
        `Manifest ${label} image entry ${id} does not match its snapshot image`
      )
    }
  }
}

function recordsMatch(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>
) {
  const leftEntries = Object.entries(left).toSorted(([a], [b]) =>
    a.localeCompare(b)
  )
  const rightEntries = Object.entries(right).toSorted(([a], [b]) =>
    a.localeCompare(b)
  )
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries)
}

function arraysMatch(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}
