import type { ContentImage } from '../lib/content/schema'

export type PreviousSnapshotMedia = {
  readonly scenarios: readonly {
    readonly id: string
    readonly title: string
    readonly sourceId: string
    readonly image: ContentImage
    readonly memes: readonly ContentImage[]
  }[]
  readonly sources: readonly {
    readonly id: string
    readonly title: string
    readonly poster: ContentImage | null
  }[]
  readonly franchises: readonly {
    readonly id: string
    readonly title: string
    readonly image: ContentImage
  }[]
}

export type CurrentMediaRecords = {
  readonly scenarios: readonly {
    readonly id: string
    readonly title: string
    readonly sourceId: string
  }[]
  readonly sources: readonly {
    readonly id: string
    readonly title: string
  }[]
  readonly franchises: readonly {
    readonly id: string
    readonly title: string
  }[]
}

export function reuseSnapshotMedia(
  snapshot: PreviousSnapshotMedia,
  current: CurrentMediaRecords
) {
  const scenarioById = new Map(
    snapshot.scenarios.map((scenario) => [scenario.id, scenario])
  )
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.id, source])
  )
  const franchiseById = new Map(
    snapshot.franchises.map((franchise) => [franchise.id, franchise])
  )
  const currentSourceById = new Map(
    current.sources.map((source) => [source.id, source])
  )
  const missing = [
    missingMedia('scenarios', current.scenarios, scenarioById),
    missingMedia('sources', current.sources, sourceById),
    missingMedia('franchises', current.franchises, franchiseById)
  ].filter((value): value is string => value !== null)

  if (missing.length > 0) {
    throw new Error(
      `--fast cannot reuse media for records missing from the existing snapshot (${missing.join('; ')}). Run "pnpm content:sync" without --fast to process their images.`
    )
  }

  const scenarios = current.scenarios.map((record) => ({
    current: record,
    previous: scenarioById.get(record.id)!
  }))
  const sources = current.sources.map((record) => ({
    current: record,
    previous: sourceById.get(record.id)!
  }))
  const franchises = current.franchises.map((record) => ({
    current: record,
    previous: franchiseById.get(record.id)!
  }))

  return {
    scenarioImages: scenarios.map(({ current, previous }) =>
      refreshGeneratedAlt(
        previous.image,
        sourceById.has(previous.sourceId)
          ? scenarioImageAlt(
              sourceById.get(previous.sourceId)!.title,
              previous.title
            )
          : null,
        currentSourceById.has(current.sourceId)
          ? scenarioImageAlt(
              currentSourceById.get(current.sourceId)!.title,
              current.title
            )
          : null
      )
    ),
    scenarioMemes: scenarios.map(({ current, previous }) =>
      previous.memes.map((meme, index, memes) =>
        refreshGeneratedAlt(
          meme,
          scenarioMemeAlt(previous.title, index, memes.length),
          scenarioMemeAlt(current.title, index, memes.length)
        )
      )
    ),
    sourcePosters: sources.map(({ current, previous }) =>
      previous.poster
        ? refreshGeneratedAlt(
            previous.poster,
            sourcePosterAlt(previous.title),
            sourcePosterAlt(current.title)
          )
        : null
    ),
    franchiseImages: franchises.map(({ current, previous }) =>
      refreshGeneratedAlt(
        previous.image,
        franchiseImageAlt(previous.title),
        franchiseImageAlt(current.title)
      )
    )
  }
}

export function scenarioImageAlt(sourceTitle: string, scenarioTitle: string) {
  return `Still from ${sourceTitle} illustrating ${scenarioTitle}`
}

export function scenarioMemeAlt(
  scenarioTitle: string,
  index: number,
  total: number
) {
  const position = total > 1 ? ` ${index + 1} of ${total}` : ''
  return `Generated meme${position} related to ${scenarioTitle}`
}

export function sourcePosterAlt(sourceTitle: string) {
  return `Poster for ${sourceTitle}`
}

export function franchiseImageAlt(franchiseTitle: string) {
  return `Representative image for ${franchiseTitle}`
}

function refreshGeneratedAlt(
  image: ContentImage,
  previousAlt: string | null,
  currentAlt: string | null
) {
  return previousAlt && currentAlt && image.alt === previousAlt
    ? { ...image, alt: currentAlt }
    : image
}

function missingMedia<T extends { readonly id: string }>(
  collection: string,
  current: readonly T[],
  records: ReadonlyMap<string, T>
) {
  const missingIds = current
    .map((record) => record.id)
    .filter((id) => !records.has(id))
  if (missingIds.length === 0) return null
  return `${collection}: ${missingIds.map((id) => JSON.stringify(id)).join(', ')}`
}
