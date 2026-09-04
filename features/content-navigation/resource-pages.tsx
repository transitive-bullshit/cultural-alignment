import Image from 'next/image'
import { ExternalLinkIcon } from 'lucide-react'

import { ScrambleLink } from '@/components/motion/scramble-link'
import { SiteHeader } from '@/components/site-header'
import { ScenarioCollection } from '@/features/scenario-collection/scenario-collection'
import type {
  ResourceKind,
  ResourcePage,
  ResourceSummary,
  SourceResourceSummary
} from '@/lib/content/catalog'

import {
  DirectResourceListItem,
  formatScenarioCount
} from './direct-resource-list-item'
import { SortableMediaSourceList } from './sortable-media-source-list'
import styles from './resource-pages.module.css'

const PRESENTATION = {
  source: {
    eyebrow: 'Cultural source index',
    indexTitle: 'Media Sources',
    singular: 'Media Source',
    description:
      'A curated collection of TV shows, movies, and anime from popular culture which contain useful scenes for improving our understanding of AI safety.'
  },
  franchise: {
    eyebrow: 'Cultural franchise index',
    indexTitle: 'Media Franchises',
    singular: 'Media Franchise',
    description:
      'A collection of the shared story worlds and media franchises represented across these cultural sources.'
  },
  'risk-family': {
    eyebrow: 'AI risk taxonomy',
    indexTitle: 'AI Risk Families',
    singular: 'Risk family',
    description:
      'A high-level categorization of ways that capable AI systems can create harm, each grounded in recognizable scenes from pop culture.'
  },
  concept: {
    eyebrow: 'AI safety index',
    indexTitle: 'AI Safety Concepts',
    singular: 'AI safety concept',
    description:
      'A collection of important concepts from AI safety, alignment, risks, governance, and human–AI interaction.'
  }
} as const satisfies Record<
  ResourceKind,
  {
    readonly eyebrow: string
    readonly indexTitle: string
    readonly singular: string
    readonly description: string
  }
>

type ResourceIndexPageProps =
  | Readonly<{
      kind: 'source'
      resources: readonly SourceResourceSummary[]
    }>
  | Readonly<{
      kind: Exclude<ResourceKind, 'source'>
      resources: readonly ResourceSummary[]
    }>

export function ResourceIndexPage({ kind, resources }: ResourceIndexPageProps) {
  const presentation = PRESENTATION[kind]

  return (
    <main className={`experience-scope ${styles.page}`}>
      <SiteHeader inset />

      <section className={styles.indexIntro}>
        <p className={styles.eyebrow}>{presentation.eyebrow}</p>
        <h1>{presentation.indexTitle}</h1>
        <p className={styles.introCopy}>{presentation.description}</p>
        <p className={styles.recordCount}>
          {String(resources.length).padStart(2, '0')} records
        </p>
      </section>

      {kind === 'source' ? (
        <SortableMediaSourceList resources={resources} />
      ) : (
        <ResourceList kind={kind} resources={resources} />
      )}
    </main>
  )
}

function ResourceList({
  headingLevel = 2,
  kind,
  label,
  resources
}: {
  readonly headingLevel?: 2 | 3
  readonly kind: ResourceKind
  readonly label?: string
  readonly resources: readonly ResourceSummary[]
}) {
  const usesDirectLink = kind === 'source' || kind === 'franchise'

  return (
    <ol
      className={styles.resourceIndex}
      aria-label={label}
      data-resource-kind={kind}
      data-resource-list
    >
      {resources.map((resource, index) => {
        const scenarioCount = formatScenarioCount(resource.scenarioCount)

        if (usesDirectLink) {
          return (
            <DirectResourceListItem
              key={resource.id}
              headingLevel={headingLevel}
              index={index}
              resource={resource}
            />
          )
        }

        return (
          <li key={resource.id}>
            <ScrambleLink
              animateOnReveal={false}
              copyElement='h2'
              duration={260}
              href={resource.href}
              label={`${resource.title}, ${scenarioCount}`}
              leadingContent={
                <span className={styles.indexNumber}>
                  {String(index + 1).padStart(2, '0')}
                </span>
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
          </li>
        )
      })}
    </ol>
  )
}

export function ResourceDetailPage({
  resource
}: {
  readonly resource: ResourcePage
}) {
  const presentation = PRESENTATION[resource.kind]
  const isMediaResource =
    resource.kind === 'source' || resource.kind === 'franchise'
  const heroImage =
    resource.kind === 'source'
      ? resource.poster
      : resource.kind === 'franchise'
        ? resource.image
        : null

  return (
    <main
      className={`experience-scope ${styles.page}`}
      data-resource-detail={resource.kind}
    >
      <SiteHeader inset />

      <section
        className={styles.detailIntro}
        data-resource-hero={isMediaResource ? resource.kind : undefined}
        data-has-resource-image={heroImage ? true : undefined}
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
                    <ExternalLinkIcon
                      className={styles.externalLinkMark}
                      aria-hidden='true'
                    />
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
        {heroImage ? (
          <figure
            className={styles.resourceImage}
            data-resource-image={resource.kind}
            data-source-poster={resource.kind === 'source' ? true : undefined}
            data-franchise-image={
              resource.kind === 'franchise' ? true : undefined
            }
          >
            <Image
              src={heroImage.detailSrc}
              alt={heroImage.alt}
              width={heroImage.width}
              height={heroImage.height}
              placeholder='blur'
              blurDataURL={heroImage.blurDataURL}
              sizes='(max-width: 680px) calc(100vw - 36px), (max-width: 860px) 460px, (max-width: 1440px) 32vw, 460px'
              preload
              data-resource-image-element={resource.kind}
              data-source-poster-image={
                resource.kind === 'source' ? true : undefined
              }
            />
          </figure>
        ) : null}
      </section>

      <section className={styles.scenarioSection} data-resource-scenarios>
        <header className={styles.sectionHeader}>
          <p>Scenario file</p>
          <h2>
            {resource.kind === 'franchise'
              ? 'Scenes across this franchise'
              : 'Scenes in this index'}
          </h2>
          <span>{String(resource.scenarioCount).padStart(2, '0')}</span>
        </header>

        <ScenarioCollection
          items={resource.scenarios.map((scenario) => ({ scenario }))}
          layout='continuous'
        />
      </section>

      {resource.kind === 'franchise' ? (
        <section className={styles.resourceSection} data-franchise-sources>
          <header className={styles.sectionHeader}>
            <p>Franchise index</p>
            <h2>Media in this franchise</h2>
            <span>{String(resource.sources.length).padStart(2, '0')}</span>
          </header>

          <ResourceList
            headingLevel={3}
            kind='source'
            label={`Media sources in ${resource.title}`}
            resources={resource.sources}
          />
        </section>
      ) : null}

      {resource.kind !== 'franchise' && resource.relatedResources.length > 0 ? (
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

function formatSourceType(sourceType: 'movie' | 'tv-show') {
  return sourceType === 'movie' ? 'Movie' : 'TV show'
}

function formatReleaseDate(releaseDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(new Date(`${releaseDate}T00:00:00Z`))
}
