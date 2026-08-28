import { contentSnapshotSchema, type ContentSnapshot } from './schema'

export type ContentValidationIssueCode =
  | 'invalid-schema'
  | 'duplicate-id'
  | 'duplicate-slug'
  | 'missing-relation'

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
  | 'riskFamilies'
  | 'concepts'

type IdentifiedRecord = {
  readonly id: string
  readonly slug: string
}

export function validateContentSnapshot(input: unknown): ContentSnapshot {
  const result = contentSnapshotSchema.safeParse(input)

  if (!result.success) {
    const issues = result.error.issues.map<ContentValidationIssue>((issue) => ({
      code: 'invalid-schema',
      path: formatPath(issue.path),
      message: issue.message
    }))

    throw new ContentValidationError(
      'Content snapshot schema validation failed',
      issues
    )
  }

  const snapshot = result.data
  const issues: ContentValidationIssue[] = []

  appendUniquenessIssues('scenarios', snapshot.scenarios, issues)
  appendUniquenessIssues('sources', snapshot.sources, issues)
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
        message: `Duplicate id ${JSON.stringify(record.id)}; first declared at ${collectionName}[${firstIdIndex}].id`
      })
    }

    const firstSlugIndex = firstIndexBySlug.get(record.slug)

    if (firstSlugIndex === undefined) {
      firstIndexBySlug.set(record.slug, index)
    } else {
      issues.push({
        code: 'duplicate-slug',
        path: `${collectionName}[${index}].slug`,
        message: `Duplicate slug ${JSON.stringify(record.slug)}; first declared at ${collectionName}[${firstSlugIndex}].slug`
      })
    }
  })
}

function appendRelationIssues(
  snapshot: ContentSnapshot,
  issues: ContentValidationIssue[]
) {
  const sourceIds = new Set(snapshot.sources.map((source) => source.id))
  const riskFamilyIds = new Set(
    snapshot.riskFamilies.map((family) => family.id)
  )
  const conceptIds = new Set(snapshot.concepts.map((concept) => concept.id))

  snapshot.scenarios.forEach((scenario, scenarioIndex) => {
    if (!sourceIds.has(scenario.sourceId)) {
      issues.push({
        code: 'missing-relation',
        path: `scenarios[${scenarioIndex}].sourceId`,
        message: `Unknown source id ${JSON.stringify(scenario.sourceId)}`
      })
    }

    scenario.riskFamilyIds.forEach((riskFamilyId, relationIndex) => {
      if (!riskFamilyIds.has(riskFamilyId)) {
        issues.push({
          code: 'missing-relation',
          path: `scenarios[${scenarioIndex}].riskFamilyIds[${relationIndex}]`,
          message: `Unknown risk-family id ${JSON.stringify(riskFamilyId)}`
        })
      }
    })

    scenario.conceptIds.forEach((conceptId, relationIndex) => {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          code: 'missing-relation',
          path: `scenarios[${scenarioIndex}].conceptIds[${relationIndex}]`,
          message: `Unknown concept id ${JSON.stringify(conceptId)}`
        })
      }
    })
  })
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
