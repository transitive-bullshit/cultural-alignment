import Image from 'next/image'
import Link from 'next/link'
import { ExternalLinkIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { CopyPageLink } from '@/components/copy-page-link'
import { ScrambleLink } from '@/components/motion/scramble-link'
import { SiteHeader } from '@/components/site-header'
import { ScenarioCollection } from '@/features/scenario-collection/scenario-collection'
import type {
  RelatedResource,
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
  const isTaxonomy =
    resource.kind === 'concept' || resource.kind === 'risk-family'
  const heroImage =
    resource.kind === 'source'
      ? resource.poster
      : resource.kind === 'franchise'
        ? resource.image
        : null
  const related = (kind: ResourceKind) =>
    resource.relatedResources.filter((item) => item.kind === kind)
  const families = related('risk-family')
  const concepts = related('concept')
  const hasReading = isTaxonomy && resource.externalLinks.length > 0
  const imageOrientation = heroImage
    ? heroImage.width / heroImage.height < 0.9
      ? 'portrait'
      : 'landscape'
    : undefined

  return (
    <main
      className={`experience-scope ${styles.page}`}
      data-resource-detail={resource.kind}
    >
      <SiteHeader inset />

      <section
        className={styles.detailIntro}
        data-resource-hero={resource.kind}
        data-layout={isTaxonomy ? 'taxonomy' : 'media'}
        data-has-aside={heroImage || hasReading ? true : undefined}
        data-has-resource-image={heroImage ? true : undefined}
        data-image-orientation={imageOrientation}
      >
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
              sizes={
                imageOrientation === 'portrait'
                  ? '(max-width: 680px) 320px, 420px'
                  : '(max-width: 860px) calc(100vw - 36px), 56vw'
              }
              preload
              data-resource-image-element={resource.kind}
              data-source-poster-image={
                resource.kind === 'source' ? true : undefined
              }
            />
          </figure>
        ) : null}

        <div className={styles.detailMain}>
          <div className={styles.detailActions}>
            <p className={styles.eyebrow}>{presentation.singular}</p>
            <CopyPageLink key={resource.id} />
          </div>
          <h1>{resource.detailTitle}</h1>
          {resource.description ? (
            <p className={styles.detailLead} data-resource-description>
              {resource.description}
            </p>
          ) : null}
          <ResourceFacts
            conceptCount={concepts.length}
            families={families}
            franchises={related('franchise')}
            resource={resource}
          />
          {!isTaxonomy && resource.externalLinks.length > 0 ? (
            <ExternalLinks
              className={styles.linkRow}
              links={resource.externalLinks}
            />
          ) : null}
        </div>

        {hasReading ? (
          <aside
            className={styles.furtherReading}
            aria-labelledby='further-reading-aside'
          >
            <h2 id='further-reading-aside' className={styles.asideLabel}>
              Further reading
            </h2>
            <ExternalLinks
              className={styles.externalLinks}
              links={resource.externalLinks}
            />
          </aside>
        ) : null}
      </section>

      {resource.kind === 'risk-family' && concepts.length > 0 ? (
        <section className={styles.pivotSection} data-family-concepts>
          <SectionHeader
            eyebrow={formatCount(concepts.length, 'concept')}
            title='Concepts in this risk family'
          />
          <RelatedChips resources={concepts} />
        </section>
      ) : null}

      <section className={styles.scenarioSection} data-resource-scenarios>
        <SectionHeader
          eyebrow={formatCount(resource.scenarioCount, 'scene')}
          title={scenesHeading(resource)}
        />
        <ScenarioCollection
          items={resource.scenarios.map((scenario) => ({
            scenario,
            summary: scenario.analogy
          }))}
          layout='continuous'
        />
      </section>

      {resource.kind === 'franchise' ? (
        <section className={styles.resourceSection} data-franchise-sources>
          <SectionHeader
            eyebrow={formatCount(resource.sources.length, 'work')}
            title={`Works in ${resource.title}`}
          />
          <ResourceList
            headingLevel={3}
            kind='source'
            label={`Media sources in ${resource.title}`}
            resources={resource.sources}
          />
        </section>
      ) : null}

      {resource.kind === 'concept' && concepts.length > 0 ? (
        <section className={styles.relatedSection} data-connected-records>
          <SectionHeader
            eyebrow='Related concepts'
            title={`Often paired with ${resource.title}`}
          />
          <p className={styles.sectionNote}>
            Counts are scenes on this page that share the concept.
          </p>
          <RelatedChips resources={concepts} />
        </section>
      ) : null}

      {hasReading ? (
        <section className={styles.readingSection} data-further-reading>
          <SectionHeader eyebrow='Sources' title='Further reading' />
          <ExternalLinks
            className={styles.externalLinks}
            links={resource.externalLinks}
          />
        </section>
      ) : null}

      {!isTaxonomy && (families.length > 0 || concepts.length > 0) ? (
        <section className={styles.relatedSection} data-connected-records>
          <SectionHeader
            eyebrow='AI safety ideas'
            title={`What ${resource.title} illustrates`}
          />
          <p className={styles.sectionNote}>
            Counts are scenes from this {presentation.singular.toLowerCase()}{' '}
            tagged with each idea.
          </p>
          <div className={styles.pivotGroups}>
            {families.length > 0 ? (
              <div>
                <h3 className={styles.asideLabel}>AI risk families</h3>
                <RelatedChips noun='risk family' resources={families} />
              </div>
            ) : null}
            {concepts.length > 0 ? (
              <div>
                <h3 className={styles.asideLabel}>AI safety concepts</h3>
                <RelatedChips resources={concepts} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function ResourceFacts({
  conceptCount,
  families,
  franchises,
  resource
}: {
  readonly conceptCount: number
  readonly families: readonly RelatedResource[]
  readonly franchises: readonly RelatedResource[]
  readonly resource: ResourcePage
}) {
  const facts: { label: string; value: ReactNode; hook?: string }[] = []

  if (resource.kind === 'source') {
    facts.push({
      label: 'Type',
      value: (
        <span data-source-type={resource.sourceType}>
          {formatSourceType(resource.sourceType)}
        </span>
      )
    })
    if (resource.releaseDate) {
      facts.push({
        label: 'Released',
        value: (
          <time dateTime={resource.releaseDate} data-source-release-date>
            {formatReleaseDate(resource.releaseDate)}
          </time>
        )
      })
    }
    if (franchises.length > 0) {
      facts.push({
        label: 'Franchise',
        hook: 'data-source-franchises',
        value: <InlineLinks resources={franchises} />
      })
    }
  }
  if (resource.kind === 'franchise') {
    facts.push({ label: 'Works', value: resource.sources.length })
  }
  facts.push({ label: 'Scenes', value: resource.scenarioCount })
  if (resource.kind === 'risk-family') {
    facts.push({ label: 'Concepts', value: conceptCount })
  }
  if (resource.kind === 'concept' && families.length > 0) {
    const mainFamilies = primaryFamilies(families, resource.scenarioCount)
    facts.push({
      label: mainFamilies.length === 1 ? 'Risk family' : 'Risk families',
      value: <InlineLinks resources={mainFamilies} />
    })
  }

  return (
    <dl className={styles.detailFacts} data-resource-facts>
      {facts.map(({ hook, label, value }) => (
        <div key={label} {...(hook ? { [hook]: true } : {})}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function InlineLinks({
  resources
}: {
  readonly resources: readonly ResourceSummary[]
}) {
  return (
    <span className={styles.inlineLinks}>
      {resources.map((resource) => (
        <Link key={resource.id} href={resource.href}>
          {resource.title}
        </Link>
      ))}
    </span>
  )
}

function ExternalLinks({
  className,
  links
}: {
  readonly className: string | undefined
  readonly links: ResourcePage['externalLinks']
}) {
  return (
    <ul className={className} aria-label='External references'>
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} target='_blank' rel='noreferrer'>
            <ExternalLinkIcon
              className={styles.externalLinkMark}
              aria-hidden='true'
            />
            <span className={styles.externalLinkCopy}>
              <span className={styles.externalLinkTitle}>{link.label}</span>
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
  )
}

function SectionHeader({
  eyebrow,
  title
}: {
  readonly eyebrow: string
  readonly title: string
}) {
  return (
    <header className={styles.sectionHeader}>
      <p>{eyebrow}</p>
      <h2>{title}</h2>
    </header>
  )
}

const VISIBLE_CHIPS = 12

/**
 * Compact links ranked by the scenes they share with the current page; the
 * long tail sits behind a disclosure so the scenes stay near the top.
 */
function RelatedChips({
  noun = 'concept',
  resources
}: {
  readonly noun?: string
  readonly resources: readonly RelatedResource[]
}) {
  const visible = resources.slice(0, VISIBLE_CHIPS)
  const rest = resources.slice(VISIBLE_CHIPS)

  return (
    <div className={styles.chips}>
      <ChipList resources={visible} />
      {rest.length > 0 ? (
        <details className={styles.moreChips}>
          <summary>Show all {formatCount(resources.length, noun)}</summary>
          <ChipList resources={rest} />
        </details>
      ) : null}
    </div>
  )
}

function ChipList({
  resources
}: {
  readonly resources: readonly RelatedResource[]
}) {
  return (
    <ul className={styles.chipList}>
      {resources.map((resource) => (
        <li key={`${resource.kind}:${resource.id}`}>
          <Link
            className={styles.chip}
            href={resource.href}
            aria-label={`${resource.title}, ${formatCount(resource.sharedScenarioCount, 'shared scene')}`}
          >
            <span>{resource.title}</span>
            <span className={styles.chipCount} aria-hidden='true'>
              {resource.sharedScenarioCount}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Families holding at least 40% of a concept's scenes; at least one, at most three. */
function primaryFamilies(
  families: readonly RelatedResource[],
  scenarioCount: number
) {
  return families
    .filter(
      (family, index) =>
        index === 0 || family.sharedScenarioCount >= scenarioCount * 0.4
    )
    .slice(0, 3)
}

function scenesHeading(resource: ResourcePage) {
  switch (resource.kind) {
    case 'concept':
      return `Scenes showing ${resource.title}`
    case 'risk-family':
      return 'Scenes in this risk family'
    case 'source':
      return `Scenes from ${resource.title}`
    case 'franchise':
      return `Scenes across ${resource.title}`
  }
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
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
