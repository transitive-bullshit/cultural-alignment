'use client'

import { useId, useMemo } from 'react'

import {
  CollectionSortControls,
  usePersistedCollectionSort
} from '@/features/collection-sort/collection-sort-controls'
import type { CollectionSort } from '@/features/collection-sort/collection-sort'
import type { SourceResourceSummary } from '@/lib/content/catalog'

import { MediaResourceCard } from './media-resource-card'
import { groupMediaSources, sortMediaSources } from './media-source-sort'
import styles from './resource-pages.module.css'

const STORAGE_KEY = 'cultural-alignment:media-source-collection-sort:v1'
const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

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
  const groups = useMemo(
    () => groupMediaSources(sortMediaSources(resources, sort), sort),
    [resources, sort]
  )
  const isAlphabetical = sort === 'default'
  const groupByLabel = new Map(groups.map((group) => [group.label, group]))
  // The alphabet stays whole so a missing letter reads as absent, not broken.
  const jumpLabels = isAlphabetical
    ? ALPHABET
    : groups.map(({ label }) => label)

  return (
    <div>
      <CollectionSortControls
        announcement={announcement}
        collectionId={collectionId}
        defaultLabel='A–Z'
        label='Sort media sources'
        value={sort}
        onValueChange={handleSortChange}
      />

      <nav
        className={styles.jumpBar}
        aria-label={isAlphabetical ? 'Jump to letter' : 'Jump to decade'}
        data-source-jump-bar={isAlphabetical ? 'letter' : 'decade'}
      >
        <ol>
          {jumpLabels.map((label) => {
            const group = groupByLabel.get(label)

            return (
              <li key={label}>
                {group ? (
                  <a
                    href={`#${group.id}`}
                    aria-label={`${label === '#' ? 'Numbers and symbols' : label}, ${group.items.length}`}
                    data-source-jump-link={label}
                  >
                    {label}
                  </a>
                ) : (
                  <span aria-hidden='true'>{label}</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div
        id={collectionId}
        data-resource-list
        data-resource-kind='source'
        data-resource-sort={sort}
      >
        {groups.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className={styles.sourceGroup}
            aria-labelledby={`${group.id}-heading`}
            data-source-group={group.label}
          >
            <h2
              id={`${group.id}-heading`}
              className={styles.sourceGroupHeading}
            >
              <span>{group.label}</span>
              <span className={styles.sourceGroupCount} aria-hidden='true'>
                {group.items.length}
              </span>
            </h2>
            <ol className={styles.mediaGrid} data-media-art='poster'>
              {group.items.map((resource) => (
                <MediaResourceCard
                  key={resource.id}
                  headingLevel={3}
                  resource={resource}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}

function getSortAnnouncement(value: CollectionSort) {
  if (value === 'newest') return 'Media sources sorted newest first'
  if (value === 'oldest') return 'Media sources sorted oldest first'

  return 'Media sources sorted alphabetically'
}
