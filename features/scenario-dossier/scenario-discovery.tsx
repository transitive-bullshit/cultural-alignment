import type { ReactNode } from 'react'
import Link from 'next/link'

import {
  ScenarioCollection,
  type ScenarioCollectionItem
} from '@/features/scenario-collection/scenario-collection'
import type { ScenarioPage } from '@/lib/content/catalog'

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
          <ScenarioCollection
            items={scenario.moreFromSource.map((related) => ({
              scenario: related
            }))}
            layout='preview'
          />
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
          <ScenarioCollection
            items={scenario.relatedScenarios.map(
              (related): ScenarioCollectionItem => ({
                scenario: related,
                connections: {
                  riskFamilies: related.sharedRiskFamilies,
                  concepts: related.sharedConcepts
                }
              })
            )}
            imageTreatment='muted'
            layout='preview'
          />
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
