import { z } from 'zod'

import { blurDataUrlSchema, type ContentSnapshot } from '../lib/content/schema'
import {
  generatedMediaObjectKey,
  isGeneratedMediaPublicPath
} from './sync-utils'

export const MEDIA_PIPELINE_VERSION = 3
export const SYNC_MANIFEST_VERSION = 4

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const legacyGeneratedMediaPathSchema = z
  .string()
  .refine(isGeneratedMediaPublicPath, 'Invalid generated media path')
const generatedMediaObjectKeySchema = z
  .string()
  .regex(
    /^media\/generated\/(?:franchises|scenarios|sources)\/[0-9a-f]{32}\/(?:gallery|detail)-[0-9a-f]{64}\.webp$/
  )
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
}, 'Generated media URL must use HTTPS without credentials, query parameters, or fragments')

const syncEntryBaseSchema = z.object({
  lastEditedTime: z.string(),
  imageBlockId: z.string(),
  additionalImageCount: z.number().int().nonnegative(),
  sourceHash: sha256Schema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string()
})

export const previousSyncEntrySchema = syncEntryBaseSchema.extend({
  pipelineVersion: z.number().int().positive().optional(),
  galleryHash: sha256Schema.optional(),
  detailHash: sha256Schema.optional(),
  galleryKey: generatedMediaObjectKeySchema.optional(),
  detailKey: generatedMediaObjectKeySchema.optional(),
  gallerySrc: z.union([legacyGeneratedMediaPathSchema, remoteMediaUrlSchema]),
  detailSrc: z.union([legacyGeneratedMediaPathSchema, remoteMediaUrlSchema]),
  blurDataURL: blurDataUrlSchema.optional()
})

export const reusableSyncEntrySchema = syncEntryBaseSchema.extend({
  pipelineVersion: z.union([z.literal(2), z.literal(MEDIA_PIPELINE_VERSION)]),
  galleryHash: sha256Schema,
  detailHash: sha256Schema,
  galleryKey: generatedMediaObjectKeySchema,
  detailKey: generatedMediaObjectKeySchema,
  gallerySrc: remoteMediaUrlSchema,
  detailSrc: remoteMediaUrlSchema,
  blurDataURL: blurDataUrlSchema.optional()
})

export const syncEntrySchema = reusableSyncEntrySchema.extend({
  pipelineVersion: z.literal(MEDIA_PIPELINE_VERSION),
  blurDataURL: blurDataUrlSchema
})

const slugMapSchema = z.record(
  z.string().min(1),
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
)

const historicalSlugMapsSchema = z.object({
  scenarios: slugMapSchema,
  sources: slugMapSchema,
  riskFamilies: slugMapSchema,
  concepts: slugMapSchema
})

const slugMapsSchema = historicalSlugMapsSchema.extend({
  franchises: slugMapSchema
})

const legacySyncManifestSchema = z.object({
  schemaVersion: z.literal(1),
  slugs: historicalSlugMapsSchema,
  entries: z.record(z.string(), previousSyncEntrySchema)
})

const previousCurrentSyncManifestSchema = z.object({
  schemaVersion: z.literal(2),
  slugs: historicalSlugMapsSchema,
  entries: z.object({
    scenarios: z.record(z.string(), previousSyncEntrySchema),
    sources: z.record(z.string(), previousSyncEntrySchema)
  })
})

const previousSyncManifestHistorySchema = z.object({
  schemaVersion: z.literal(3),
  slugs: historicalSlugMapsSchema
})

const currentSyncManifestHistorySchema = z.object({
  schemaVersion: z.literal(4),
  slugs: slugMapsSchema
})

const notionCollectionSchema = z.object({
  databaseId: z.string().min(1),
  dataSourceId: z.string().min(1)
})

const syncManifestContract = {
  notion: z.object({
    apiVersion: z.string().min(1),
    dataSources: z.object({
      scenarios: notionCollectionSchema,
      sources: notionCollectionSchema,
      franchises: notionCollectionSchema,
      riskFamilies: notionCollectionSchema,
      concepts: notionCollectionSchema
    })
  }),
  counts: z.object({
    scenarios: z.number().int().nonnegative(),
    sources: z.number().int().nonnegative(),
    franchises: z.number().int().nonnegative(),
    riskFamilies: z.number().int().nonnegative(),
    concepts: z.number().int().nonnegative()
  }),
  fixtureScenarioIds: z.array(z.string().min(1)),
  slugs: slugMapsSchema
}

export const syncManifestSchema = z.strictObject({
  schemaVersion: z.literal(SYNC_MANIFEST_VERSION),
  ...syncManifestContract
})

const transitionalSyncManifestSchema = z.strictObject({
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
  slugs: historicalSlugMapsSchema,
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
    readonly franchises: Record<string, PreviousSyncEntry>
  }
}

export const emptyPreviousSyncManifest: PreviousSyncManifest = {
  slugs: {
    scenarios: {},
    sources: {},
    franchises: {},
    riskFamilies: {},
    concepts: {}
  },
  entries: {
    scenarios: {},
    sources: {},
    franchises: {}
  }
}

export function parsePreviousSyncManifest(
  input: unknown
): PreviousSyncManifest {
  const current = currentSyncManifestHistorySchema.safeParse(input)
  if (current.success) {
    return {
      slugs: current.data.slugs,
      entries: emptyPreviousSyncManifest.entries
    }
  }

  const previousCurrent = previousSyncManifestHistorySchema.safeParse(input)
  if (previousCurrent.success) {
    return {
      slugs: {
        ...previousCurrent.data.slugs,
        franchises: {}
      },
      entries: emptyPreviousSyncManifest.entries
    }
  }

  const previous = previousCurrentSyncManifestSchema.safeParse(input)
  if (previous.success) {
    return {
      slugs: {
        ...previous.data.slugs,
        franchises: {}
      },
      entries: {
        ...previous.data.entries,
        franchises: {}
      }
    }
  }

  const legacy = legacySyncManifestSchema.parse(input)

  return {
    slugs: emptyPreviousSyncManifest.slugs,
    entries: {
      scenarios: legacy.entries,
      sources: {},
      franchises: {}
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
  validateSnapshotContract(manifest, snapshot)

  return manifest
}

export function validateCheckedSyncManifest(
  input: unknown,
  snapshot: ContentSnapshot
) {
  const current = syncManifestSchema.safeParse(input)
  if (current.success) {
    validateSnapshotContract(current.data, snapshot)
    return current.data
  }

  const manifest = transitionalSyncManifestSchema.parse(input)
  validateHistoricalSnapshotContract(manifest, snapshot)
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

function validateSnapshotContract(
  manifest: Pick<SyncManifest, 'counts' | 'fixtureScenarioIds' | 'slugs'>,
  snapshot: ContentSnapshot
) {
  const collections = [
    ['scenarios', snapshot.scenarios],
    ['sources', snapshot.sources],
    ['franchises', snapshot.franchises],
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

  validateFixtureScenarioIds(manifest.fixtureScenarioIds, snapshot)
}

function validateHistoricalSnapshotContract(
  manifest: z.infer<typeof transitionalSyncManifestSchema>,
  snapshot: ContentSnapshot
) {
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

  validateFixtureScenarioIds(manifest.fixtureScenarioIds, snapshot)
}

function validateFixtureScenarioIds(
  fixtureScenarioIds: readonly string[],
  snapshot: ContentSnapshot
) {
  const scenarioIds = new Set(snapshot.scenarios.map((scenario) => scenario.id))
  for (const fixtureId of fixtureScenarioIds) {
    if (!scenarioIds.has(fixtureId)) {
      throw new Error(
        `Manifest fixture references unknown scenario ${fixtureId}`
      )
    }
  }
}

function validateMediaOwnership(
  label: 'franchise' | 'scenario' | 'source',
  collection: 'franchises' | 'scenarios' | 'sources',
  entries: Readonly<Record<string, SyncEntry>>,
  records: readonly {
    readonly id: string
    readonly image: {
      readonly gallerySrc: string
      readonly detailSrc: string
      readonly width: number
      readonly height: number
      readonly blurDataURL: string
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
    if (
      entry.gallerySrc !== image.gallerySrc ||
      entry.detailSrc !== image.detailSrc ||
      entry.width !== image.width ||
      entry.height !== image.height ||
      entry.blurDataURL !== image.blurDataURL
    ) {
      throw new Error(
        `Manifest ${label} image entry ${id} does not match its snapshot image`
      )
    }

    const galleryKey = generatedMediaObjectKey(
      collection,
      id,
      'gallery',
      entry.galleryHash
    )
    const detailKey = generatedMediaObjectKey(
      collection,
      id,
      'detail',
      entry.detailHash
    )
    if (entry.galleryKey !== galleryKey || entry.detailKey !== detailKey) {
      throw new Error(
        `Manifest ${label} image entry ${id} has invalid content-addressed keys`
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
