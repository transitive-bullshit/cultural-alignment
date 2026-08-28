import type { CSSProperties, ReactNode } from 'react'
import { ViewTransition } from 'react'
import Link from 'next/link'

import { ScrambleLink } from '@/components/motion/scramble-link'
import { SpoilerWarning } from '@/features/spoiler/spoiler-warning'
import { GlobalSearch } from '@/features/search/global-search'
import type { ScenarioPage, TaxonomyLink } from '@/lib/content/catalog'

import { ScenarioMedia } from './scenario-media'
import styles from './scenario-dossier.module.css'
import { hasDistinctEpisodeLabel } from './source-meta'

/**
 * The production Dossier. The scenario view model is its only interface;
 * route policy and the approved hierarchy stay private to this module.
 */
export function ScenarioDossier({ scenario }: { scenario: ScenarioPage }) {
  return (
    <main className={`${styles.page} experience-scope`}>
      <DossierHeader />

      <article>
        <section className={styles.opening}>
          <div className={styles.mediaColumn}>
            <ViewTransition
              name={`scenario-media-${scenario.id}`}
              share='scenario-media'
              default='none'
            >
              <ScenarioMedia
                media={{
                  title: scenario.title,
                  sourceTitle: scenario.source.title,
                  image: scenario.image,
                  video: scenario.video
                }}
              />
            </ViewTransition>
          </div>

          <div className={styles.narrativeColumn}>
            <div className={styles.titleBlock}>
              <h1>{scenario.title}</h1>
              <SourceMeta scenario={scenario} />
            </div>
          </div>
        </section>

        <section className={styles.reading}>
          <CopySection index='01' title='Scene'>
            <p>{scenario.scene}</p>
          </CopySection>

          <CopySection index='02' title='Why this analogy works' prominent>
            <p>{scenario.whyAnalogyWorks}</p>
          </CopySection>

          <CopySection index='03' title='Where the analogy breaks'>
            <p>{scenario.caveats}</p>
          </CopySection>

          <Taxonomy scenario={scenario} />
        </section>
      </article>

      <SpoilerWarning className={styles.detailSpoiler} />
    </main>
  )
}

function DossierHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.identity} href='/'>
        Cultural Alignment
      </Link>
      <p>Familiar stories for unfamiliar AI problems.</p>
      <nav aria-label='Primary navigation'>
        <GlobalSearch className={styles.headerSearch} />
        <Link href='/scenarios' transitionTypes={['scenario-back']}>
          Gallery
        </Link>
      </nav>
    </header>
  )
}

function SourceMeta({ scenario }: { scenario: ScenarioPage }) {
  const year = scenario.releaseDate?.slice(0, 4) ?? 'Date unknown'
  const showEpisode = hasDistinctEpisodeLabel(
    scenario.source.title,
    scenario.episode?.label
  )

  return (
    <ul className={styles.sourceMeta} aria-label='Source details'>
      <li>
        <Link href={`/sources/${scenario.source.slug}`}>
          {scenario.source.title}
        </Link>
      </li>
      {showEpisode && scenario.episode ? (
        <li>
          <span>{scenario.episode.label}</span>
        </li>
      ) : null}
      <li>
        {scenario.releaseDate ? (
          <time dateTime={scenario.releaseDate}>{year}</time>
        ) : (
          <span>{year}</span>
        )}
      </li>
    </ul>
  )
}

function CopySection({
  children,
  index,
  prominent = false,
  title
}: {
  readonly children: ReactNode
  readonly index: string
  readonly prominent?: boolean
  readonly title: string
}) {
  return (
    <section
      className={styles.copySection}
      data-prominent={prominent || undefined}
    >
      <h2 className={styles.sectionLabel}>
        <span>{index}</span>
        {title}
      </h2>
      <div className={styles.sectionCopy}>{children}</div>
    </section>
  )
}

function Taxonomy({ scenario }: { scenario: ScenarioPage }) {
  return (
    <section className={styles.taxonomy} aria-label='Scenario taxonomy'>
      <TaxonomyList label='Risk families' items={scenario.riskFamilies} />
      <TaxonomyList label='AI safety concepts' items={scenario.concepts} />
    </section>
  )
}

function TaxonomyList({
  items,
  label
}: {
  readonly items: readonly TaxonomyLink[]
  readonly label: string
}) {
  return (
    <div>
      <h2 className={styles.taxonomyHeading}>{label}</h2>
      <ol>
        {items.map((item, index) => {
          const delay = 90 + index * 48
          const animationStyle = {
            '--taxonomy-delay': `${delay}ms`
          } as CSSProperties

          return (
            <li key={item.id} style={animationStyle}>
              <span aria-hidden='true'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <ScrambleLink
                className={styles.taxonomyLink}
                href={item.href}
                delay={delay}
              >
                {item.title}
              </ScrambleLink>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
