import { contentSnapshotSchema, type ContentSnapshot } from './schema'

export type ContentValidationIssueCode =
  | 'invalid-schema'
  | 'duplicate-id'
  | 'duplicate-slug'
  | 'missing-relation'
  | 'invalid-source-episode'

export type ContentValidationIssue = {
  readonly code: ContentValidationIssueCode
  readonly path: string
  readonly message: string
}

export class ContentValidationError extends Error {
  readonly issues: readonly ContentValidationIssue[]

  constructor(summary: string, issues: readonly ContentValidationIssue[]) {
    super(
      `${summary}:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`
    )
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

type EntityCollectionName =
  | 'scenarios'
  | 'sources'
  | 'franchises'
  | 'riskFamilies'
  | 'concepts'

type IdentifiedRecord = {
  readonly id: string
  readonly slug: string
  readonly shortName?: string
  readonly title?: string
}

const collectionLabels = {
  scenarios: 'scenario',
  sources: 'source',
  franchises: 'franchise',
  riskFamilies: 'risk family',
  concepts: 'safety concept'
} as const satisfies Record<EntityCollectionName, string>

export function validateContentSnapshot(input: unknown): ContentSnapshot {
  const result = contentSnapshotSchema.safeParse(input)

  if (!result.success) {
    const issues = result.error.issues.map<ContentValidationIssue>((issue) => {
      const record = unknownRecordAtPath(input, issue.path)
      return {
        code: 'invalid-schema',
        path: formatPath(issue.path),
        message: record
          ? `${issue.message}; ${formatRecordReference(record.collection, record)}`
          : issue.message
      }
    })

    throw new ContentValidationError(
      'Content snapshot schema validation failed',
      issues
    )
  }

  const snapshot = result.data
  const issues: ContentValidationIssue[] = []

  appendUniquenessIssues('scenarios', snapshot.scenarios, issues)
  appendUniquenessIssues('sources', snapshot.sources, issues)
  appendUniquenessIssues('franchises', snapshot.franchises, issues)
  appendUniquenessIssues('riskFamilies', snapshot.riskFamilies, issues)
  appendUniquenessIssues('concepts', snapshot.concepts, issues)
  appendRelationIssues(snapshot, issues)

  if (issues.length > 0) {
    throw new ContentValidationError(
      'Content snapshot integrity validation failed',
      issues
    )
  }

  return snapshot
}

function appendUniquenessIssues(
  collectionName: EntityCollectionName,
  records: readonly IdentifiedRecord[],
  issues: ContentValidationIssue[]
) {
  const firstIndexById = new Map<string, number>()
  const firstIndexBySlug = new Map<string, number>()

  records.forEach((record, index) => {
    const firstIdIndex = firstIndexById.get(record.id)

    if (firstIdIndex === undefined) {
      firstIndexById.set(record.id, index)
    } else {
      issues.push({
        code: 'duplicate-id',
        path: `${collectionName}[${index}].id`,
        message: `Duplicate id ${JSON.stringify(record.id)} for ${formatRecordReference(collectionName, record)}; first declared by ${formatRecordReference(collectionName, records[firstIdIndex]!)} at ${collectionName}[${firstIdIndex}].id`
      })
    }

    const firstSlugIndex = firstIndexBySlug.get(record.slug)

    if (firstSlugIndex === undefined) {
      firstIndexBySlug.set(record.slug, index)
    } else {
      issues.push({
        code: 'duplicate-slug',
        path: `${collectionName}[${index}].slug`,
        message: `Duplicate slug ${JSON.stringify(record.slug)} for ${formatRecordReference(collectionName, record)}; first declared by ${formatRecordReference(collectionName, records[firstSlugIndex]!)} at ${collectionName}[${firstSlugIndex}].slug`
      })
    }
  })
}

function appendRelationIssues(
  snapshot: ContentSnapshot,
  issues: ContentValidationIssue[]
) {
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.id, source])
  )
  const franchiseIds = new Set(
    snapshot.franchises.map((franchise) => franchise.id)
  )
  const riskFamilyIds = new Set(
    snapshot.riskFamilies.map((family) => family.id)
  )
  const conceptIds = new Set(snapshot.concepts.map((concept) => concept.id))

  snapshot.scenarios.forEach((scenario, scenarioIndex) => {
    const source = sourceById.get(scenario.sourceId)

    if (!source) {
      issues.push({
        code: 'missing-relation',
        path: `scenarios[${scenarioIndex}].sourceId`,
        message: `${formatRecordReference('scenarios', scenario)} references unknown source id ${JSON.stringify(scenario.sourceId)}`
      })
    } else if (scenario.episode && source.sourceType !== 'tv-show') {
      issues.push({
        code: 'invalid-source-episode',
        path: `scenarios[${scenarioIndex}].episode`,
        message: `${formatRecordReference('scenarios', scenario)} has episode metadata, but ${formatRecordReference('sources', source)} is ${source.sourceType}`
      })
    }

    scenario.riskFamilyIds.forEach((riskFamilyId, relationIndex) => {
      if (!riskFamilyIds.has(riskFamilyId)) {
        issues.push({
          code: 'missing-relation',
          path: `scenarios[${scenarioIndex}].riskFamilyIds[${relationIndex}]`,
          message: `${formatRecordReference('scenarios', scenario)} references unknown risk-family id ${JSON.stringify(riskFamilyId)}`
        })
      }
    })

    scenario.conceptIds.forEach((conceptId, relationIndex) => {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          code: 'missing-relation',
          path: `scenarios[${scenarioIndex}].conceptIds[${relationIndex}]`,
          message: `${formatRecordReference('scenarios', scenario)} references unknown safety-concept id ${JSON.stringify(conceptId)}`
        })
      }
    })
  })

  snapshot.sources.forEach((source, sourceIndex) => {
    source.franchiseIds.forEach((franchiseId, relationIndex) => {
      if (franchiseIds.has(franchiseId)) return

      issues.push({
        code: 'missing-relation',
        path: `sources[${sourceIndex}].franchiseIds[${relationIndex}]`,
        message: `${formatRecordReference('sources', source)} references unknown franchise id ${JSON.stringify(franchiseId)}`
      })
    })

    source.relatedSourceIds.forEach((relatedSourceId, relationIndex) => {
      if (sourceById.has(relatedSourceId)) return

      issues.push({
        code: 'missing-relation',
        path: `sources[${sourceIndex}].relatedSourceIds[${relationIndex}]`,
        message: `${formatRecordReference('sources', source)} references unknown source id ${JSON.stringify(relatedSourceId)}`
      })
    })
  })
}

function formatRecordReference(
  collection: EntityCollectionName,
  record: {
    readonly id?: unknown
    readonly shortName?: unknown
    readonly title?: unknown
  }
) {
  const title =
    typeof record.title === 'string'
      ? record.title.trim()
      : typeof record.shortName === 'string'
        ? record.shortName.trim()
        : ''
  const id = typeof record.id === 'string' ? record.id : null
  const label = title
    ? `${collectionLabels[collection]} ${JSON.stringify(title)}`
    : collectionLabels[collection]

  return id ? `${label} (ID: ${id})` : label
}

function unknownRecordAtPath(input: unknown, path: readonly PropertyKey[]) {
  const [collection, index] = path
  if (
    typeof collection !== 'string' ||
    !Object.hasOwn(collectionLabels, collection) ||
    typeof index !== 'number' ||
    !input ||
    typeof input !== 'object'
  ) {
    return null
  }

  const records = (input as Record<string, unknown>)[collection]
  if (!Array.isArray(records)) return null
  const record: unknown = records[index]
  if (!record || typeof record !== 'object') return null

  return {
    ...(record as {
      readonly id?: unknown
      readonly shortName?: unknown
      readonly title?: unknown
    }),
    collection: collection as EntityCollectionName
  }
}

function formatPath(path: readonly PropertyKey[]) {
  if (path.length === 0) return '$'

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') return `${formatted}[${segment}]`

    const key = String(segment)

    if (/^[A-Za-z_$][\w$]*$/.test(key)) {
      return formatted ? `${formatted}.${key}` : key
    }

    return `${formatted}[${JSON.stringify(key)}]`
  }, '')
}
