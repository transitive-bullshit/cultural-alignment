import Link from 'next/link'
import Image from 'next/image'

import { ScrambleLink } from '@/components/motion/scramble-link'
import { SiteHeader } from '@/components/site-header'
import { ScenarioCollection } from '@/features/scenario-collection/scenario-collection'
import type {
  ResourceKind,
  ResourcePage,
  ResourceSummary
} from '@/lib/content/catalog'

import styles from './resource-pages.module.css'

const PRESENTATION = {
  source: {
    eyebrow: 'Cultural source index',
    indexTitle: 'Media Sources',
    singular: 'Media Source',
    breadcrumbLabel: 'Media sources',
    description:
      'A curated collection of TV shows, movies, and anime from popular culture which contain useful scenes for improving our understanding of AI safety.',
    indexHref: '/sources'
  },
  'risk-family': {
    eyebrow: 'AI risk taxonomy',
    indexTitle: 'AI Risk Families',
    singular: 'Risk family',
    breadcrumbLabel: 'Risk families',
    description:
      'A high-level categorization of ways that capable AI systems can create harm, each grounded in recognizable scenes from pop culture.',
    indexHref: '/risk-families'
  },
  concept: {
    eyebrow: 'AI safety index',
    indexTitle: 'AI Safety Concepts',
    singular: 'AI safety concept',
    breadcrumbLabel: 'AI safety concepts',
    description:
      'A collection of important concepts from AI safety, alignment, risks, governance, and human–AI interaction.',
    indexHref: '/concepts'
  }
} as const satisfies Record<
  ResourceKind,
  {
    readonly eyebrow: string
    readonly indexTitle: string
    readonly singular: string
    readonly breadcrumbLabel: string
    readonly description: string
    readonly indexHref: string
  }
>

export function ResourceIndexPage({
  kind,
  resources
}: {
  readonly kind: ResourceKind
  readonly resources: readonly ResourceSummary[]
}) {
  const presentation = PRESENTATION[kind]

  return (
    <main className={`experience-scope ${styles.page}`}>
      <SiteHeader inset context={`${presentation.indexTitle}`} />

      <section className={styles.indexIntro}>
        <p className={styles.eyebrow}>{presentation.eyebrow}</p>
        <h1>{presentation.indexTitle}</h1>
        <p className={styles.introCopy}>{presentation.description}</p>
        <p className={styles.recordCount}>
          {String(resources.length).padStart(2, '0')} records
        </p>
      </section>

      <ol className={styles.resourceIndex} data-resource-kind={kind}>
        {resources.map((resource, index) => {
          const indexNumber = String(index + 1).padStart(2, '0')
          const scenarioCount = formatScenarioCount(resource.scenarioCount)

          return (
            <li key={resource.id}>
              {kind === 'source' ? (
                <Link href={resource.href}>
                  <span className={styles.indexNumber}>{indexNumber}</span>
                  <h2>{resource.title}</h2>
                  <span className={styles.itemCount}>{scenarioCount}</span>
                  <span className={styles.openMark} aria-hidden='true'>
                    ↗
                  </span>
                </Link>
              ) : (
                <ScrambleLink
                  animateOnReveal={false}
                  copyElement='h2'
                  duration={260}
                  href={resource.href}
                  label={`${resource.title}, ${scenarioCount}`}
                  leadingContent={
                    <span className={styles.indexNumber}>{indexNumber}</span>
                  }
                  prefetch='auto'
                  trailingContent={
                    <>
                      {kind === 'risk-family' && resource.description ? (
                        <p>{resource.description}</p>
                      ) : null}
                      <span className={styles.itemCount}>{scenarioCount}</span>
                      <span className={styles.openMark} aria-hidden='true'>
                        ↗
                      </span>
                    </>
                  }
                >
                  {resource.title}
                </ScrambleLink>
              )}
            </li>
          )
        })}
      </ol>
    </main>
  )
}

export function ResourceDetailPage({
  resource
}: {
  readonly resource: ResourcePage
}) {
  const presentation = PRESENTATION[resource.kind]

  return (
    <main
      className={`experience-scope ${styles.page}`}
      data-resource-detail={resource.kind}
    >
      <SiteHeader
        breadcrumb={{
          current: resource.detailTitle,
          parent: {
            href: presentation.indexHref,
            label: presentation.breadcrumbLabel
          }
        }}
        inset
      />

      <section
        className={styles.detailIntro}
        data-source-hero={resource.kind === 'source' ? true : undefined}
        data-has-poster={
          resource.kind === 'source' && resource.poster ? true : undefined
        }
      >
        <p className={styles.eyebrow}>{presentation.singular}</p>
        <h1>{resource.detailTitle}</h1>
        <div className={styles.detailSummary}>
          {resource.kind === 'source' ? (
            <dl className={styles.sourceMetadata}>
              <div>
                <dt>Media type</dt>
                <dd data-source-type={resource.sourceType}>
                  {formatSourceType(resource.sourceType)}
                </dd>
              </div>
              {resource.releaseDate ? (
                <div>
                  <dt>Release date</dt>
                  <dd>
                    <time
                      dateTime={resource.releaseDate}
                      data-source-release-date
                    >
                      {formatReleaseDate(resource.releaseDate)}
                    </time>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {resource.description ? <p>{resource.description}</p> : null}
          {resource.externalLinks.length > 0 ? (
            <ul
              className={styles.externalLinks}
              aria-label='External references'
            >
              {resource.externalLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target='_blank' rel='noreferrer'>
                    <span
                      className={styles.externalLinkMark}
                      aria-hidden='true'
                    >
                      ×
                    </span>
                    <span className={styles.externalLinkCopy}>
                      <span className={styles.externalLinkTitle}>
                        {link.label}
                      </span>
                      {link.description ? (
                        <small className={styles.externalLinkDescription}>
                          {link.description}
                        </small>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {resource.kind === 'source' && resource.poster ? (
          <figure className={styles.sourcePoster} data-source-poster>
            <Image
              src={resource.poster.detailSrc}
              alt={resource.poster.alt}
              width={resource.poster.width}
              height={resource.poster.height}
              placeholder='blur'
              blurDataURL={resource.poster.blurDataURL}
              sizes='(max-width: 680px) calc(100vw - 36px), (max-width: 860px) 460px, (max-width: 1440px) 32vw, 460px'
              preload
              data-source-poster-image
            />
          </figure>
        ) : null}
      </section>

      <section className={styles.scenarioSection}>
        <header className={styles.sectionHeader}>
          <p>Scenario file</p>
          <h2>Scenes in this index</h2>
          <span>{String(resource.scenarioCount).padStart(2, '0')}</span>
        </header>

        <ScenarioCollection
          items={resource.scenarios.map((scenario) => ({ scenario }))}
          layout='continuous'
        />
      </section>

      {resource.relatedResources.length > 0 ? (
        <section className={styles.relatedSection}>
          <header className={styles.sectionHeader}>
            <p>Relational index</p>
            <h2>Connected records</h2>
            <span>
              {String(resource.relatedResources.length).padStart(2, '0')}
            </span>
          </header>
          <ul className={styles.relatedList} data-connected-records>
            {resource.relatedResources.map((related) => {
              const kindLabel = PRESENTATION[related.kind].singular
              const scenarioCount = formatScenarioCount(related.scenarioCount)

              return (
                <li key={`${related.kind}:${related.id}`}>
                  <ScrambleLink
                    animateOnReveal={false}
                    copyElement='strong'
                    duration={260}
                    href={related.href}
                    label={`${kindLabel}, ${related.title}, ${scenarioCount}`}
                    leadingContent={
                      <span className={styles.relatedKind}>{kindLabel}</span>
                    }
                    prefetch={null}
                    trailingContent={<small>{scenarioCount}</small>}
                  >
                    {related.title}
                  </ScrambleLink>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

function formatScenarioCount(count: number) {
  return `${count} ${count === 1 ? 'scenario' : 'scenarios'}`
}

function formatSourceType(sourceType: 'movie' | 'tv-show') {
  return sourceType === 'movie' ? 'Movie' : 'TV show'
}

function formatReleaseDate(releaseDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(new Date(`${releaseDate}T00:00:00Z`))
}
