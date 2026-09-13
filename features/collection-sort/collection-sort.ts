export type CollectionSort = 'default' | 'newest' | 'oldest'

type DatedCollectionEntry = Readonly<{
  releaseDate: string | null
}>

export function isCollectionSort(value: unknown): value is CollectionSort {
  return value === 'default' || value === 'newest' || value === 'oldest'
}

export function sortCollectionItemsByReleaseDate<
  Item extends DatedCollectionEntry
>(items: readonly Item[], sort: CollectionSort): readonly Item[] {
  if (sort === 'default') return items

  return items.toSorted((left, right) => {
    const leftDate = left.releaseDate
    const rightDate = right.releaseDate

    if (leftDate === rightDate) return 0
    if (leftDate === null) return 1
    if (rightDate === null) return -1

    const dateOrder = leftDate < rightDate ? -1 : 1

    return sort === 'oldest' ? dateOrder : -dateOrder
  })
}
