'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  createBrowseGalleryHref,
  type BrowseGalleryParams
} from '@/features/spatial-gallery/browse-params'
import type { ResourceSummary } from '@/lib/content/catalog'

import styles from '@/features/spatial-gallery/gallery-page-shell.module.css'

export function BrowseToolbar({
  families,
  params,
  resultCount
}: {
  readonly families: readonly ResourceSummary[]
  readonly params: BrowseGalleryParams
  readonly resultCount: number
}) {
  const activeFilterRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const activeFilter = activeFilterRef.current
    const filterList = activeFilter?.closest('[role="radiogroup"]')

    if (!(filterList instanceof HTMLElement) || !activeFilter) return

    filterList.scrollLeft = Math.max(
      0,
      activeFilter.offsetLeft -
        (filterList.clientWidth - activeFilter.clientWidth) / 2
    )
  }, [params.family])

  return (
    <nav
      className={styles.browseToolbar}
      aria-label='Scenario gallery controls'
    >
      <ToggleGroup
        className={styles.filterList}
        data-scenario-family-filters
        type='single'
        value={params.family ?? 'all'}
        variant='outline'
        size='sm'
        aria-label='Filter by risk family'
      >
        <ToggleGroupItem className={styles.filterLink} value='all' asChild>
          <Link
            ref={params.family === null ? activeFilterRef : undefined}
            href={createBrowseGalleryHref({ ...params, family: null })}
            scroll={false}
          >
            All
          </Link>
        </ToggleGroupItem>
        {families.map((family) => (
          <ToggleGroupItem
            key={family.id}
            className={styles.filterLink}
            value={family.slug}
            asChild
          >
            <Link
              ref={params.family === family.slug ? activeFilterRef : undefined}
              href={createBrowseGalleryHref({
                ...params,
                family: family.slug
              })}
              scroll={false}
            >
              {family.title}
            </Link>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className={styles.resultCount} aria-live='polite'>
        <strong>{String(resultCount).padStart(3, '0')}</strong> scenarios
      </p>
    </nav>
  )
}
