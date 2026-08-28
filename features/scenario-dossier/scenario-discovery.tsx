import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import type {
  GalleryScenario,
  ScenarioPage,
  TaxonomyLink
} from '@/lib/content/catalog'
import { focalPointToObjectPosition } from '@/lib/media/crop'

import styles from './scenario-dossier.module.css'

export function ScenarioDiscovery({ scenario }: { scenario: ScenarioPage }) {
  const hasMoreFromSource = scenario.moreFromSource.length > 0
  const hasRelatedScenarios = scenario.relatedScenarios.length > 0
  const moreFromSourceHeadingId = `more-from-source-${scenario.slug}`
  const relatedScenariosHeadingId = `related-scenarios-${scenario.slug}`

  if (!hasMoreFromSource && !hasRelatedScenarios) return null

  return (
    <div className={styles.discovery}>
      {hasMoreFromSource ? (
        <section
          className={styles.discoverySection}
          aria-labelledby={moreFromSourceHeadingId}
        >
          <DiscoveryHeader
            eyebrow='Source continuation'
            title={`More from ${scenario.source.title}`}
            id={moreFromSourceHeadingId}
            action={
              <Link
                className={styles.discoveryAction}
                href={scenario.source.href}
              >
                View all {scenario.source.scenarioCount}{' '}
                {scenario.source.scenarioCount === 1 ? 'scenario' : 'scenarios'}
                <span aria-hidden='true'>↗</span>
              </Link>
            }
          />
          <ol className={styles.discoveryGrid}>
            {scenario.moreFromSource.map((related, index) => (
              <li key={related.id}>
                <ScenarioCard scenario={related} index={index} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {hasRelatedScenarios ? (
        <section
          className={styles.discoverySection}
          aria-labelledby={relatedScenariosHeadingId}
        >
          <DiscoveryHeader
            eyebrow='Taxonomy neighbors'
            title='Related scenarios'
            id={relatedScenariosHeadingId}
            description='Selected from other sources by shared risk families and AI safety concepts.'
          />
          <ol className={styles.discoveryGrid}>
            {scenario.relatedScenarios.map((related, index) => (
              <li key={related.id}>
                <ScenarioCard
                  scenario={related}
                  index={index}
                  connections={{
                    riskFamilies: related.sharedRiskFamilies,
                    concepts: related.sharedConcepts
                  }}
                />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}

function DiscoveryHeader({
  action,
  description,
  eyebrow,
  id,
  title
}: {
  readonly action?: ReactNode
  readonly description?: string
  readonly eyebrow: string
  readonly id: string
  readonly title: string
}) {
  return (
    <header className={styles.discoveryHeader}>
      <div>
        <p>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {description ? (
        <p className={styles.discoveryDescription}>{description}</p>
      ) : null}
      {action}
    </header>
  )
}

type ScenarioConnections = Readonly<{
  concepts: readonly TaxonomyLink[]
  riskFamilies: readonly TaxonomyLink[]
}>

function ScenarioCard({
  connections,
  index,
  scenario
}: {
  readonly connections?: ScenarioConnections
  readonly index: number
  readonly scenario: GalleryScenario
}) {
  const year = scenario.releaseDate?.slice(0, 4) ?? 'Date unknown'

  return (
    <Link
      className={styles.discoveryCard}
      href={scenario.href}
      aria-label={`View scenario: ${scenario.title}`}
    >
      <figure>
        <Image
          src={scenario.image.gallerySrc}
          alt={scenario.image.alt}
          fill
          sizes='(max-width: 620px) 100vw, (max-width: 1100px) 45vw, 36vw'
          style={{
            objectFit: 'cover',
            objectPosition: focalPointToObjectPosition(
              scenario.image.focalPoint
            )
          }}
        />
      </figure>
      <div className={styles.discoveryCardBody}>
        <p className={styles.discoveryCardMeta}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span>{scenario.source.title}</span>
          <span>{year}</span>
        </p>
        <h3>{scenario.title}</h3>
        {connections ? <ConnectionSummary connections={connections} /> : null}
        <span className={styles.discoveryOpen} aria-hidden='true'>
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
