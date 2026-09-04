import Link from 'next/link'

import type { ResourceSummary } from '@/lib/content/catalog'

import styles from './resource-pages.module.css'

export function DirectResourceListItem({
  headingLevel = 2,
  index,
  releaseDate,
  resource
}: {
  readonly headingLevel?: 2 | 3
  readonly index: number
  readonly releaseDate?: string | null
  readonly resource: ResourceSummary
}) {
  const ResourceTitle = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <li
      data-resource-id={resource.id}
      data-resource-release-date={releaseDate ?? undefined}
    >
      <Link href={resource.href}>
        <span className={styles.indexNumber}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <ResourceTitle>{resource.title}</ResourceTitle>
        <span className={styles.itemCount}>
          {formatScenarioCount(resource.scenarioCount)}
        </span>
        <span className={styles.openMark} aria-hidden='true'>
          ↗
        </span>
      </Link>
    </li>
  )
}

export function formatScenarioCount(count: number) {
  return `${count} ${count === 1 ? 'scenario' : 'scenarios'}`
}
