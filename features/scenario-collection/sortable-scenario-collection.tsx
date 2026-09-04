'use client'

import { useId, useMemo } from 'react'

import {
  CollectionSortControls,
  usePersistedCollectionSort
} from '@/features/collection-sort/collection-sort-controls'

import type { ScenarioCollectionImageTreatment } from './scenario-collection-list'
import {
  sortScenarioCollectionItems,
  type ScenarioSort,
  type SortableScenarioEntry
} from './scenario-sort'
import styles from './scenario-collection.module.css'

const STORAGE_KEY = 'cultural-alignment:scenario-collection-sort:v1'

export function SortableScenarioCollection({
  entries,
  imageTreatment
}: {
  readonly entries: readonly SortableScenarioEntry[]
  readonly imageTreatment: ScenarioCollectionImageTreatment
}) {
  const id = useId()
  const collectionId = `${id}-scenarios`
  const { announcement, handleSortChange, sort } = usePersistedCollectionSort(
    STORAGE_KEY,
    getSortAnnouncement
  )
  const sortedEntries = useMemo(
    () => sortScenarioCollectionItems(entries, sort),
    [entries, sort]
  )

  return (
    <div>
      <CollectionSortControls
        announcement={announcement}
        collectionId={collectionId}
        label='Sort scenes'
        value={sort}
        onValueChange={handleSortChange}
      />

      <ol
        id={collectionId}
        className={styles.collection}
        data-scenario-collection
        data-image-treatment={imageTreatment}
        data-layout='continuous'
      >
        {sortedEntries.map(({ content }) => content)}
      </ol>
    </div>
  )
}

function getSortAnnouncement(value: ScenarioSort) {
  if (value === 'newest') return 'Scenes sorted newest first'
  if (value === 'oldest') return 'Scenes sorted oldest first'

  return 'Scenes sorted with featured scenes first'
}
