import {
  sortCollectionItemsByReleaseDate,
  type CollectionSort
} from '@/features/collection-sort/collection-sort'

type MediaSourceSortEntry = Readonly<{
  releaseDate: string | null
  title: string
}>

type MediaSourceGroup<Item> = Readonly<{
  /** Stable fragment for the jump bar, e.g. `sources-a` or `sources-1990s`. */
  id: string
  /** A letter, `#` for titles that start with a digit or symbol, or a decade. */
  label: string
  items: readonly Item[]
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

/**
 * Wayfinding sections for an already sorted list: first letters for the
 * alphabetical sort and release decades for the date sorts. Groups keep the
 * order of their first item, so a sorted list yields contiguous sections.
 */
export function groupMediaSources<Item extends MediaSourceSortEntry>(
  sortedSources: readonly Item[],
  sort: CollectionSort
): readonly MediaSourceGroup<Item>[] {
  const getLabel = sort === 'default' ? titleInitial : releaseDecade
  const groups = new Map<string, Item[]>()

  for (const source of sortedSources) {
    const label = getLabel(source)
    const group = groups.get(label)

    if (group) group.push(source)
    else groups.set(label, [source])
  }

  return [...groups].map(([label, items]) => ({
    id: `sources-${groupFragment(label)}`,
    label,
    items
  }))
}

function titleInitial({ title }: MediaSourceSortEntry) {
  const initial = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .charAt(0)
    .toUpperCase()

  return /^[A-Z]$/.test(initial) ? initial : '#'
}

function releaseDecade({ releaseDate }: MediaSourceSortEntry) {
  const year = releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) : NaN

  return Number.isFinite(year) ? `${Math.floor(year / 10) * 10}s` : 'Undated'
}

function groupFragment(label: string) {
  return label === '#' ? 'numbers' : label.toLowerCase()
}
