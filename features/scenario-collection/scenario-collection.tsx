import {
  createSortableScenarioEntries,
  ScenarioCollectionList,
  type ScenarioCollectionImageTreatment,
  type ScenarioCollectionItem,
  type ScenarioCollectionLayout
} from './scenario-collection-list'
import {
  shouldEnableScenarioSorting,
  sortFeaturedItemsFirst
} from './scenario-sort'
import { SortableScenarioCollection } from './sortable-scenario-collection'

export type {
  ScenarioCollectionImageTreatment,
  ScenarioCollectionItem,
  ScenarioCollectionLayout,
  ScenarioConnections
} from './scenario-collection-list'

export function ScenarioCollection({
  imageTreatment = 'muted',
  items,
  layout
}: {
  readonly imageTreatment?: ScenarioCollectionImageTreatment
  readonly items: readonly ScenarioCollectionItem[]
  readonly layout: ScenarioCollectionLayout
}) {
  if (shouldEnableScenarioSorting(layout, items.length)) {
    return (
      <SortableScenarioCollection
        entries={createSortableScenarioEntries(items)}
        imageTreatment={imageTreatment}
      />
    )
  }

  const listedItems =
    layout === 'continuous'
      ? sortFeaturedItemsFirst(items, ({ scenario }) => scenario.featured)
      : items

  return (
    <ScenarioCollectionList
      imageTreatment={imageTreatment}
      items={listedItems}
      layout={layout}
    />
  )
}
