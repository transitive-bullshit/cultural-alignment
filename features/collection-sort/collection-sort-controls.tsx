'use client'

import { useId, useLayoutEffect, useState } from 'react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { isCollectionSort, type CollectionSort } from './collection-sort'
import styles from './collection-sort-controls.module.css'

const DEFAULT_SORT: CollectionSort = 'default'
const options = [
  { label: 'Default', value: 'default' },
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' }
] as const satisfies readonly {
  readonly label: string
  readonly value: CollectionSort
}[]

export function CollectionSortControls({
  announcement,
  collectionId,
  label,
  onValueChange,
  value
}: {
  readonly announcement: string
  readonly collectionId: string
  readonly label: string
  readonly onValueChange: (value: CollectionSort) => void
  readonly value: CollectionSort
}) {
  const labelId = `${useId()}-sort-label`

  const handleValueChange = (nextValue: string) => {
    if (isCollectionSort(nextValue)) onValueChange(nextValue)
  }

  return (
    <div className={styles.controls} data-collection-sort-controls>
      <p id={labelId} className={styles.label}>
        {label}
      </p>
      <ToggleGroup
        className={styles.options}
        type='single'
        orientation='horizontal'
        value={value}
        variant='outline'
        size='sm'
        aria-controls={collectionId}
        aria-labelledby={labelId}
        onValueChange={handleValueChange}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            className={styles.option}
            data-collection-sort-option={option.value}
            value={option.value}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className='sr-only' role='status' aria-live='polite'>
        {announcement}
      </span>
    </div>
  )
}

export function usePersistedCollectionSort(
  storageKey: string,
  getAnnouncement: (value: CollectionSort) => string
) {
  const [sort, setSort] = useState<CollectionSort>(DEFAULT_SORT)
  const [announcement, setAnnouncement] = useState('')

  useLayoutEffect(() => {
    setSort(getStoredPreference(storageKey))

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return

      setSort(parsePreference(event.newValue))
    }

    window.addEventListener('storage', handleStorage)

    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey])

  const handleSortChange = (value: CollectionSort) => {
    setSort(value)
    setAnnouncement(getAnnouncement(value))
    persistPreference(storageKey, value)
  }

  return { announcement, handleSortChange, sort } as const
}

function getStoredPreference(storageKey: string): CollectionSort {
  try {
    return parsePreference(window.localStorage.getItem(storageKey))
  } catch {
    return DEFAULT_SORT
  }
}

function persistPreference(storageKey: string, value: CollectionSort) {
  try {
    if (value === DEFAULT_SORT) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, value)
    }
  } catch {
    // The in-memory preference still works when storage is unavailable.
  }
}

function parsePreference(value: string | null): CollectionSort {
  return isCollectionSort(value) ? value : DEFAULT_SORT
}
