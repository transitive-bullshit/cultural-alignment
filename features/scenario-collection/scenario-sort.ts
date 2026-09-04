import type { ReactNode } from 'react'

import {
  isCollectionSort,
  sortCollectionItemsByReleaseDate,
  type CollectionSort
} from '@/features/collection-sort/collection-sort'

import type { ScenarioCollectionLayout } from './scenario-collection-list'

export type ScenarioSort = CollectionSort

export type SortableScenarioEntry = Readonly<{
  content: ReactNode
  featured: boolean
  releaseDate: string | null
}>

export function isScenarioSort(value: unknown): value is ScenarioSort {
  return isCollectionSort(value)
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

  return sortCollectionItemsByReleaseDate(items, sort)
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
