import type { ReactNode } from 'react'

import type { ScenarioCollectionLayout } from './scenario-collection-list'

export type ScenarioSort = 'default' | 'newest' | 'oldest'

export type SortableScenarioEntry = Readonly<{
  content: ReactNode
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
  Item extends Pick<SortableScenarioEntry, 'releaseDate'>
>(items: readonly Item[], sort: ScenarioSort): readonly Item[] {
  if (sort === 'default') return items

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
