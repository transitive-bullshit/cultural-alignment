import Image from 'next/image'
import Link from 'next/link'

import type { GalleryScenario, TaxonomyLink } from '@/lib/content/catalog'
import { focalPointToObjectPosition } from '@/lib/media/crop'

import styles from './scenario-collection.module.css'

export type ScenarioConnections = Readonly<{
  concepts: readonly TaxonomyLink[]
  riskFamilies: readonly TaxonomyLink[]
}>

export type ScenarioCollectionItem = Readonly<{
  connections?: ScenarioConnections
  scenario: GalleryScenario
}>

export type ScenarioCollectionLayout = 'continuous' | 'preview'
export type ScenarioCollectionImageTreatment = 'color' | 'muted'

export function ScenarioCollection({
  imageTreatment = 'color',
  items,
  layout
}: {
  readonly imageTreatment?: ScenarioCollectionImageTreatment
  readonly items: readonly ScenarioCollectionItem[]
  readonly layout: ScenarioCollectionLayout
}) {
  const imageSizes =
    layout === 'continuous'
      ? '(max-width: 680px) calc(100vw - 36px), (max-width: 860px) 46vw, 31vw'
      : '(max-width: 620px) calc(100vw - 36px), (max-width: 1279px) 46vw, (max-width: 1439px) 30vw, 420px'

  return (
    <ol
      className={styles.collection}
      data-image-treatment={imageTreatment}
      data-layout={layout}
    >
      {items.map(({ connections, scenario }, index) => (
        <li key={scenario.id}>
          <ScenarioCollectionCard
            connections={connections}
            imageSizes={imageSizes}
            index={index}
            scenario={scenario}
          />
        </li>
      ))}
    </ol>
  )
}

function ScenarioCollectionCard({
  connections,
  imageSizes,
  index,
  scenario
}: {
  readonly connections?: ScenarioConnections
  readonly imageSizes: string
  readonly index: number
  readonly scenario: GalleryScenario
}) {
  const year = scenario.releaseDate?.slice(0, 4) ?? 'Date unknown'

  return (
    <Link
      className={styles.card}
      href={scenario.href}
      aria-label={`View scenario: ${scenario.title}`}
    >
      <figure>
        <Image
          src={scenario.image.gallerySrc}
          alt={scenario.image.alt}
          fill
          sizes={imageSizes}
          style={{
            objectFit: 'cover',
            objectPosition: focalPointToObjectPosition(
              scenario.image.focalPoint
            )
          }}
        />
      </figure>
      <div className={styles.cardBody}>
        <p className={styles.cardMeta}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span>{scenario.source.title}</span>
          <span>{year}</span>
        </p>
        <h3>{scenario.title}</h3>
        {connections ? <ConnectionSummary connections={connections} /> : null}
        <span className={styles.open} aria-hidden='true'>
          View scenario ↗
        </span>
      </div>
    </Link>
  )
}

function ConnectionSummary({
  connections
}: {
  readonly connections: ScenarioConnections
}) {
  return (
    <dl className={styles.connectionSummary}>
      {connections.riskFamilies.length > 0 ? (
        <div>
          <dt>Risk</dt>
          <dd>{formatTaxonomyTitles(connections.riskFamilies)}</dd>
        </div>
      ) : null}
      {connections.concepts.length > 0 ? (
        <div>
          <dt>Concept</dt>
          <dd>{formatTaxonomyTitles(connections.concepts)}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function formatTaxonomyTitles(items: readonly TaxonomyLink[]) {
  return items.map(({ title }) => title).join(' · ')
}
