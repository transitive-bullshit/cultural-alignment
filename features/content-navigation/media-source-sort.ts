import {
  sortCollectionItemsByReleaseDate,
  type CollectionSort
} from '@/features/collection-sort/collection-sort'

type MediaSourceSortEntry = Readonly<{
  releaseDate: string | null
  title: string
}>

export function sortMediaSources<Item extends MediaSourceSortEntry>(
  sources: readonly Item[],
  sort: CollectionSort
): readonly Item[] {
  const alphabeticalSources = sources.toSorted((left, right) =>
    left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  )

  return sortCollectionItemsByReleaseDate(alphabeticalSources, sort)
}
