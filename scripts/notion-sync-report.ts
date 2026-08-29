export const notionSyncCollections = [
  'scenarios',
  'sources',
  'riskFamilies',
  'concepts'
] as const

export type NotionSyncCollection = (typeof notionSyncCollections)[number]

export type NotionRecordReference = {
  readonly id: string
  readonly title?: string
}

type NotionSyncTotals = Readonly<Record<NotionSyncCollection, number>>

type NotionSyncOutput = {
  readonly log: (message: string) => void
  readonly warn: (message: string) => void
}

const collectionLabels = {
  scenarios: { singular: 'scenario', plural: 'Scenarios' },
  sources: { singular: 'source', plural: 'Sources' },
  riskFamilies: { singular: 'risk family', plural: 'Risk families' },
  concepts: { singular: 'safety concept', plural: 'Safety concepts' }
} as const satisfies Record<
  NotionSyncCollection,
  { readonly singular: string; readonly plural: string }
>

const defaultOutput: NotionSyncOutput = {
  log: (message) => console.log(message),
  warn: (message) => console.warn(message)
}

export class NotionSyncReport {
  readonly #totals: NotionSyncTotals
  readonly #output: NotionSyncOutput
  readonly #errorIds = new Map<NotionSyncCollection, Set<string>>(
    notionSyncCollections.map((collection) => [collection, new Set()])
  )

  constructor(
    totals: NotionSyncTotals,
    output: NotionSyncOutput = defaultOutput
  ) {
    this.#totals = totals
    this.#output = output
  }

  async capture<T>(
    collection: NotionSyncCollection,
    record: NotionRecordReference,
    operation: string,
    run: () => Promise<T> | T
  ): Promise<T | null> {
    try {
      return await run()
    } catch (err) {
      this.recordError(collection, record, operation, err)
      return null
    }
  }

  recordError(
    collection: NotionSyncCollection,
    record: NotionRecordReference,
    operation: string,
    err: unknown
  ) {
    this.#errorIds.get(collection)!.add(record.id)
    this.#output.warn(
      boldWarning(
        `Failed while ${operation} ${collectionLabels[collection].singular} ${formatNotionRecord(record)}: ${errorMessage(err)}`
      )
    )
  }

  get hasErrors() {
    return notionSyncCollections.some(
      (collection) => this.#errorIds.get(collection)!.size > 0
    )
  }

  counts(collection: NotionSyncCollection) {
    const total = this.#totals[collection]
    const errors = this.#errorIds.get(collection)!.size
    return {
      total,
      succeeded: Math.max(0, total - errors),
      errors
    }
  }

  printSummary() {
    this.#output.log('Notion record sync summary:')
    for (const collection of notionSyncCollections) {
      const { succeeded, errors } = this.counts(collection)
      this.#output.log(
        `- ${collectionLabels[collection].plural}: ${succeeded} succeeded, ${errors} encountered ${errors === 1 ? 'an error' : 'errors'}`
      )
    }
  }
}

export function formatNotionRecord(record: NotionRecordReference) {
  const title = record.title?.trim()
  return title
    ? `${JSON.stringify(title)} (Notion ID: ${record.id})`
    : `(Notion ID: ${record.id})`
}

export function boldWarning(message: string) {
  return `\u001B[1mWARNING:\u001B[22m ${message}`
}

export function formatImageBatchSummary(
  label: string,
  results: readonly ({ readonly uploaded: boolean } | null)[]
) {
  const images = results.filter((result) => result !== null)
  const uploaded = images.filter((image) => image.uploaded).length
  const alreadySynced = images.length - uploaded
  return `${label}: ${uploaded} changed and uploaded, ${alreadySynced} already synced.`
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message || err.name
  return String(err)
}
