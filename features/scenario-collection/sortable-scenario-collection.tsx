'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

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

/** Long collections open with this many cards so later sections stay near. */
const COLLAPSED_SCENE_COUNT = 12

export function SortableScenarioCollection({
  entries,
  imageTreatment
}: {
  readonly entries: readonly SortableScenarioEntry[]
  readonly imageTreatment: ScenarioCollectionImageTreatment
}) {
  const id = useId()
  const collectionId = `${id}-scenarios`
  const listRef = useRef<HTMLOListElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const { announcement, handleSortChange, sort } = usePersistedCollectionSort(
    STORAGE_KEY,
    getSortAnnouncement
  )
  const sortedEntries = useMemo(
    () => sortScenarioCollectionItems(entries, sort),
    [entries, sort]
  )
  const isCollapsed = !isExpanded && entries.length > COLLAPSED_SCENE_COUNT
  const visibleEntries = isCollapsed
    ? sortedEntries.slice(0, COLLAPSED_SCENE_COUNT)
    : sortedEntries

  const expand = () => {
    flushSync(() => setIsExpanded(true))
    listRef.current?.children
      .item(COLLAPSED_SCENE_COUNT)
      ?.querySelector<HTMLElement>('a')
      ?.focus()
  }

  return (
    <div>
      <CollectionSortControls
        announcement={announcement}
        collectionId={collectionId}
        defaultLabel='Featured first'
        label='Sort scenes'
        value={sort}
        onValueChange={handleSortChange}
      />

      <ol
        ref={listRef}
        id={collectionId}
        className={styles.collection}
        data-scenario-collection
        data-image-treatment={imageTreatment}
        data-layout='continuous'
        data-collapsed={isCollapsed ? true : undefined}
      >
        {visibleEntries.map(({ content }) => content)}
      </ol>

      {isCollapsed ? (
        <button
          className={styles.showAll}
          type='button'
          aria-controls={collectionId}
          aria-expanded='false'
          data-scenario-collection-expand
          onClick={expand}
        >
          Show all {entries.length} scenes
        </button>
      ) : null}
    </div>
  )
}

function getSortAnnouncement(value: ScenarioSort) {
  if (value === 'newest') return 'Scenes sorted newest first'
  if (value === 'oldest') return 'Scenes sorted oldest first'

  return 'Scenes sorted with featured scenes first'
}
