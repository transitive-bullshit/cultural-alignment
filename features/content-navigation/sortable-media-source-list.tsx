'use client'

import { useId, useMemo } from 'react'

import {
  CollectionSortControls,
  usePersistedCollectionSort
} from '@/features/collection-sort/collection-sort-controls'
import type { CollectionSort } from '@/features/collection-sort/collection-sort'
import type { SourceResourceSummary } from '@/lib/content/catalog'

import { DirectResourceListItem } from './direct-resource-list-item'
import { sortMediaSources } from './media-source-sort'
import styles from './resource-pages.module.css'

const STORAGE_KEY = 'cultural-alignment:media-source-collection-sort:v1'

export function SortableMediaSourceList({
  resources
}: {
  readonly resources: readonly SourceResourceSummary[]
}) {
  const collectionId = `${useId()}-media-sources`
  const { announcement, handleSortChange, sort } = usePersistedCollectionSort(
    STORAGE_KEY,
    getSortAnnouncement
  )
  const sortedResources = useMemo(
    () => sortMediaSources(resources, sort),
    [resources, sort]
  )

  return (
    <div>
      <CollectionSortControls
        announcement={announcement}
        collectionId={collectionId}
        label='Sort media sources'
        value={sort}
        onValueChange={handleSortChange}
      />

      <ol
        id={collectionId}
        className={styles.resourceIndex}
        data-resource-kind='source'
        data-resource-list
        data-resource-sort={sort}
      >
        {sortedResources.map((resource, index) => (
          <DirectResourceListItem
            key={resource.id}
            index={index}
            releaseDate={resource.releaseDate}
            resource={resource}
          />
        ))}
      </ol>
    </div>
  )
}

function getSortAnnouncement(value: CollectionSort) {
  if (value === 'newest') return 'Media sources sorted newest first'
  if (value === 'oldest') return 'Media sources sorted oldest first'

  return 'Media sources sorted alphabetically'
}
