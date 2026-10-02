import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { CopyPageLink } from '@/components/copy-page-link'
import { ScrambleLink } from '@/components/motion/scramble-link'
import { SiteHeader } from '@/components/site-header'
import { ScenarioCollection } from '@/features/scenario-collection/scenario-collection'
import type {
  FranchiseResourceSummary,
  RelatedResource,
  ResourceKind,
  ResourcePage,
  ResourceSummary,
  SourceResourceSummary
} from '@/lib/content/catalog'

import {
  formatSceneCount,
  formatSourceType,
  MediaResourceCard
} from './media-resource-card'
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

type IndexCrossLink = Readonly<{ href: string; label: string }>

type ResourceIndexPageProps = Readonly<{
  /** A quiet link to the sibling media index. */
  crossLink?: IndexCrossLink
}> &
  (
    | Readonly<{
        kind: 'source'
        resources: readonly SourceResourceSummary[]
      }>
    | Readonly<{
        kind: 'franchise'
        resources: readonly FranchiseResourceSummary[]
      }>
    | Readonly<{
        kind: 'risk-family' | 'concept'
        resources: readonly ResourceSummary[]
      }>
  )

export function ResourceIndexPage(props: ResourceIndexPageProps) {
  const { crossLink, kind, resources } = props
  const presentation = PRESENTATION[kind]

  return (
    <main
      className={`experience-scope ${styles.page}`}
      data-resource-index={kind}
    >
      <SiteHeader inset />

      <section className={styles.indexIntro}>
        <p className={styles.eyebrow}>{presentation.eyebrow}</p>
        <h1>{presentation.indexTitle}</h1>
        <p className={styles.introCopy}>{presentation.description}</p>
        <div className={styles.introMeta}>
          <p className={styles.recordCount}>
            {String(resources.length).padStart(2, '0')} records
          </p>
          {crossLink ? (
            <Link
              className={styles.crossLink}
              href={crossLink.href}
              data-index-cross-link
            >
              {crossLink.label}
            </Link>
          ) : null}
        </div>
      </section>

      {props.kind === 'source' ? (
        <SortableMediaSourceList resources={props.resources} />
      ) : props.kind === 'franchise' ? (
        <MediaResourceGrid kind='franchise' resources={props.resources} />
      ) : (
        <TaxonomyResourceList kind={props.kind} resources={props.resources} />
      )}
    </main>
  )
}

function MediaResourceGrid({
  headingLevel = 2,
  kind,
  label,
  resources
}: {
  readonly headingLevel?: 2 | 3
  readonly label?: string
} & (
  | {
      readonly kind: 'source'
      readonly resources: readonly SourceResourceSummary[]
    }
  | {
      readonly kind: 'franchise'
      readonly resources: readonly FranchiseResourceSummary[]
    }
)) {
  return (
    <ol
      className={styles.mediaGrid}
      aria-label={label}
      data-media-art={kind === 'source' ? 'poster' : 'key-art'}
      data-resource-kind={kind}
      data-resource-list
    >
      {resources.map((resource) => (
        <MediaResourceCard
          key={resource.id}
          headingLevel={headingLevel}
          resource={resource}
        />
      ))}
    </ol>
  )
}

/** Concepts and risk families are text-led: index, title, definition, count. */
function TaxonomyResourceList({
  kind,
  resources
}: {
  readonly kind: 'risk-family' | 'concept'
  readonly resources: readonly ResourceSummary[]
}) {
  return (
    <ol
      className={styles.resourceIndex}
      data-resource-kind={kind}
      data-resource-list
    >
      {resources.map((resource, index) => {
        const sceneCount = formatSceneCount(resource.scenarioCount)

        return (
          <li key={resource.id}>
            <ScrambleLink
              animateOnReveal={false}
              copyElement='h2'
              duration={260}
              href={resource.href}
              label={`${resource.title}, ${sceneCount}`}
              leadingContent={
                <span className={styles.indexNumber} aria-hidden='true'>
                  {String(index + 1).padStart(2, '0')}
                </span>
              }
              prefetch='auto'
              trailingContent={
                <>
                  {resource.description ? (
                    <p data-resource-index-description>
                      {resource.description}
                    </p>
                  ) : null}
                  <span className={styles.itemCount}>{sceneCount}</span>
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
  // With one scene every shared count is 1, so counts carry no information.
  const showSharedCounts = resource.scenarioCount > 1
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
          <RelatedChips resources={concepts} showCounts={showSharedCounts} />
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
          <MediaResourceGrid
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
          {showSharedCounts ? (
            <p className={styles.sectionNote}>
              Counts are scenes on this page that share the concept.
            </p>
          ) : null}
          <RelatedChips resources={concepts} showCounts={showSharedCounts} />
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
          {showSharedCounts ? (
            <p className={styles.sectionNote}>
              Counts are scenes from this {presentation.singular.toLowerCase()}{' '}
              tagged with each idea.
            </p>
          ) : null}
          <div className={styles.pivotGroups}>
            {families.length > 0 ? (
              <div>
                <h3 className={styles.asideLabel}>AI risk families</h3>
                <RelatedChips
                  noun='risk family'
                  resources={families}
                  showCounts={showSharedCounts}
                />
              </div>
            ) : null}
            {concepts.length > 0 ? (
              <div>
                <h3 className={styles.asideLabel}>AI safety concepts</h3>
                <RelatedChips
                  resources={concepts}
                  showCounts={showSharedCounts}
                />
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
        <Link key={resource.id} className='external-link' href={resource.href}>
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
            <span className={styles.externalLinkCopy}>
              <span className={styles.externalLinkTitle}>
                <span className='external-link'>{link.label}</span>
              </span>
              {link.description ? (
                <small className={styles.externalLinkDescription}>
                  {link.description}
                </small>
              ) : null}
            </span>
            <span className={styles.externalLinkMark} aria-hidden='true'>
              ↗
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
  resources,
  showCounts
}: {
  readonly noun?: string
  readonly resources: readonly RelatedResource[]
  readonly showCounts: boolean
}) {
  const visible = resources.slice(0, VISIBLE_CHIPS)
  const rest = resources.slice(VISIBLE_CHIPS)

  return (
    <div className={styles.chips}>
      <ChipList resources={visible} showCounts={showCounts} />
      {rest.length > 0 ? (
        <details className={styles.moreChips}>
          <summary>Show all {formatCount(resources.length, noun)}</summary>
          <ChipList resources={rest} showCounts={showCounts} />
        </details>
      ) : null}
    </div>
  )
}

function ChipList({
  resources,
  showCounts
}: {
  readonly resources: readonly RelatedResource[]
  readonly showCounts: boolean
}) {
  return (
    <ul className={styles.chipList}>
      {resources.map((resource) => (
        <li key={`${resource.kind}:${resource.id}`}>
          <Link
            className={styles.chip}
            href={resource.href}
            aria-label={
              showCounts
                ? `${resource.title}, ${formatCount(resource.sharedScenarioCount, 'shared scene')}`
                : undefined
            }
          >
            <span>{resource.title}</span>
            {showCounts ? (
              <span className={styles.chipCount} aria-hidden='true'>
                {resource.sharedScenarioCount}
              </span>
            ) : null}
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
  const isSingle = resource.scenarioCount === 1

  switch (resource.kind) {
    case 'concept':
      return isSingle
        ? `The scene showing ${resource.title}`
        : `Scenes showing ${resource.title}`
    case 'risk-family':
      return isSingle
        ? 'The scene in this risk family'
        : 'Scenes in this risk family'
    case 'source':
      return isSingle
        ? `The scene from ${resource.title}`
        : `Scenes from ${resource.title}`
    case 'franchise':
      return isSingle
        ? `The scene from ${resource.title}`
        : `Scenes across ${resource.title}`
  }
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function formatReleaseDate(releaseDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(new Date(`${releaseDate}T00:00:00Z`))
}
