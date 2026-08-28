import type { CSSProperties, ReactNode } from 'react'
import { ViewTransition } from 'react'
import Link from 'next/link'

import { ScrambleLink } from '@/components/motion/scramble-link'
import { SiteHeader } from '@/components/site-header'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SpoilerWarning } from '@/features/spoiler/spoiler-warning'
import type { ScenarioPage, TaxonomyLink } from '@/lib/content/catalog'
import { siteUrl } from '@/lib/site'

import { CopyScenarioMarkdown } from './copy-scenario-markdown'
import { ScenarioMedia } from './scenario-media'
import { ScenarioDiscovery } from './scenario-discovery'
import styles from './scenario-dossier.module.css'
import { formatScenarioAsMarkdown } from './scenario-markdown'
import { shouldShowEpisode } from './source-meta'
import { TaxonomyHelp } from './taxonomy-help'

/**
 * The production Dossier. The scenario view model is its only interface;
 * route policy and the approved hierarchy stay private to this module.
 */
export function ScenarioDossier({ scenario }: { scenario: ScenarioPage }) {
  return (
    <main className={`${styles.page} experience-scope`} data-scenario-dossier>
      <SiteHeader
        context='Familiar stories for unfamiliar AI problems.'
        galleryTransitionTypes={['scenario-back']}
      />

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
          <CopySection index='01' title='Scenario'>
            <p>{scenario.scene}</p>
          </CopySection>

          <CopySection index='02' title='AI safety Analogy' prominent>
            <p>{scenario.whyAnalogyWorks}</p>
          </CopySection>

          <CopySection index='03' title='Where the analogy breaks'>
            <p>{scenario.caveats}</p>
          </CopySection>

          <Taxonomy scenario={scenario} />

          <div className={styles.copyScenarioAction}>
            <CopyScenarioMarkdown
              markdown={formatScenarioAsMarkdown(scenario, siteUrl)}
            />
          </div>
        </section>

        <ScenarioDiscovery scenario={scenario} />
      </article>

      <SpoilerWarning className={styles.detailSpoiler} />
    </main>
  )
}

function SourceMeta({ scenario }: { scenario: ScenarioPage }) {
  const year = scenario.releaseDate?.slice(0, 4) ?? 'Date unknown'
  const showEpisode = shouldShowEpisode(
    scenario.source.sourceType,
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
        <li data-scenario-episode>
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
    <TooltipProvider delayDuration={200}>
      <section className={styles.taxonomy} aria-label='Scenario taxonomy'>
        <TaxonomyList
          label='AI Risk families'
          description={
            scenario.riskFamilies.length > 1
              ? 'This scenario is an example of the following types of AI risk.'
              : 'This scenario is an example of this type of AI risk.'
          }
          items={scenario.riskFamilies}
        />
        <TaxonomyList
          label='AI safety concepts'
          description={
            scenario.concepts.length > 1
              ? 'This scenario is related to the following AI safety concepts.'
              : 'This scenario is related to the following AI safety concept.'
          }
          items={scenario.concepts}
        />
      </section>
    </TooltipProvider>
  )
}

function TaxonomyList({
  description,
  items,
  label
}: {
  readonly description: string
  readonly items: readonly TaxonomyLink[]
  readonly label: string
}) {
  return (
    <div>
      <div className={styles.taxonomyHeader}>
        <h2 className={styles.taxonomyHeading}>{label}</h2>
        <TaxonomyHelp description={description} label={label} />
      </div>
      <ol>
        {items.map((item, index) => {
          const delay = 90 + index * 48
          const animationStyle = {
            '--taxonomy-delay': `${delay}ms`
          } as CSSProperties

          return (
            <li key={item.id} style={animationStyle}>
              <ScrambleLink
                className={styles.taxonomyLink}
                href={item.href}
                delay={delay}
                leadingContent={
                  <span className={styles.taxonomyIndex} aria-hidden='true'>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                }
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
