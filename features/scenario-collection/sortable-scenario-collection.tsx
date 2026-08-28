'use client'

import { useId, useLayoutEffect, useMemo, useState } from 'react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import type { ScenarioCollectionImageTreatment } from './scenario-collection-list'
import {
  isScenarioSort,
  sortScenarioCollectionItems,
  type ScenarioSort,
  type SortableScenarioEntry
} from './scenario-sort'
import styles from './scenario-collection.module.css'

const DEFAULT_SORT: ScenarioSort = 'default'
const STORAGE_KEY = 'cultural-alignment:scenario-collection-sort:v1'

export function SortableScenarioCollection({
  entries,
  imageTreatment
}: {
  readonly entries: readonly SortableScenarioEntry[]
  readonly imageTreatment: ScenarioCollectionImageTreatment
}) {
  const [sort, setSort] = useState<ScenarioSort>(DEFAULT_SORT)
  const [announcement, setAnnouncement] = useState('')
  const id = useId()
  const collectionId = `${id}-scenarios`
  const sortLabelId = `${id}-sort-label`
  const sortedEntries = useMemo(
    () => sortScenarioCollectionItems(entries, sort),
    [entries, sort]
  )

  useLayoutEffect(() => {
    setSort(getStoredPreference())

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return

      setSort(parsePreference(event.newValue))
    }

    window.addEventListener('storage', handleStorage)

    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const handleSortChange = (value: string) => {
    if (!isScenarioSort(value)) return

    setSort(value)
    setAnnouncement(getSortAnnouncement(value))
    persistPreference(value)
  }

  return (
    <div>
      <div className={styles.sortControls}>
        <p id={sortLabelId} className={styles.sortLabel}>
          Sort scenes
        </p>
        <ToggleGroup
          className={styles.sortOptions}
          type='single'
          orientation='horizontal'
          value={sort}
          variant='outline'
          size='sm'
          aria-controls={collectionId}
          aria-labelledby={sortLabelId}
          onValueChange={handleSortChange}
        >
          <ToggleGroupItem className={styles.sortOption} value='default'>
            Default
          </ToggleGroupItem>
          <ToggleGroupItem className={styles.sortOption} value='newest'>
            Newest first
          </ToggleGroupItem>
          <ToggleGroupItem className={styles.sortOption} value='oldest'>
            Oldest first
          </ToggleGroupItem>
        </ToggleGroup>
        <span className='sr-only' role='status' aria-live='polite'>
          {announcement}
        </span>
      </div>

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

function getStoredPreference(): ScenarioSort {
  try {
    return parsePreference(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_SORT
  }
}

function persistPreference(value: ScenarioSort) {
  try {
    if (value === DEFAULT_SORT) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
  } catch {
    // The in-memory preference still works when storage is unavailable.
  }
}

function parsePreference(value: string | null): ScenarioSort {
  return isScenarioSort(value) ? value : DEFAULT_SORT
}

function getSortAnnouncement(value: ScenarioSort) {
  if (value === 'newest') return 'Scenes sorted newest first'
  if (value === 'oldest') return 'Scenes sorted oldest first'

  return 'Scenes restored to their listed order'
}
