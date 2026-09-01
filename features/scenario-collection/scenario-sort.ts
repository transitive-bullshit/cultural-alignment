import type { ReactNode } from 'react'

import type { ScenarioCollectionLayout } from './scenario-collection-list'

export type ScenarioSort = 'default' | 'newest' | 'oldest'

export type SortableScenarioEntry = Readonly<{
  content: ReactNode
  featured: boolean
  releaseDate: string | null
}>

export function isScenarioSort(value: unknown): value is ScenarioSort {
  return value === 'default' || value === 'newest' || value === 'oldest'
}

export function shouldEnableScenarioSorting(
  layout: ScenarioCollectionLayout,
  itemCount: number
) {
  return layout === 'continuous' && itemCount > 3
}

export function sortScenarioCollectionItems<
  Item extends Pick<SortableScenarioEntry, 'featured' | 'releaseDate'>
>(items: readonly Item[], sort: ScenarioSort): readonly Item[] {
  if (sort === 'default') {
    return sortFeaturedItemsFirst(items, ({ featured }) => featured)
  }

  return items
    .map((item, index) => ({ index, item }))
    .toSorted((left, right) => {
      const leftDate = left.item.releaseDate
      const rightDate = right.item.releaseDate

      if (leftDate === rightDate) return left.index - right.index
      if (leftDate === null) return 1
      if (rightDate === null) return -1

      const dateOrder = leftDate < rightDate ? -1 : 1

      return sort === 'oldest' ? dateOrder : -dateOrder
    })
    .map(({ item }) => item)
}

export function sortFeaturedItemsFirst<Item>(
  items: readonly Item[],
  isFeatured: (item: Item) => boolean
): readonly Item[] {
  const featuredItems: Item[] = []
  const otherItems: Item[] = []
  let foundOtherItem = false
  let requiresReordering = false

  for (const item of items) {
    if (isFeatured(item)) {
      featuredItems.push(item)
      if (foundOtherItem) requiresReordering = true
    } else {
      otherItems.push(item)
      foundOtherItem = true
    }
  }

  return requiresReordering ? [...featuredItems, ...otherItems] : items
}
