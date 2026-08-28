import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'
import { ScenarioCollection } from '@/features/scenario-collection/scenario-collection'
import type {
  ResourceKind,
  ResourcePage,
  ResourceSummary,
  SearchDocument
} from '@/lib/content/catalog'

import styles from './resource-pages.module.css'

const PRESENTATION = {
  source: {
    eyebrow: 'Cultural source index',
    indexTitle: 'Sources',
    singular: 'Source',
    description:
      'Films, television, animation, and other familiar worlds represented in the collection.',
    indexHref: '/sources'
  },
  'risk-family': {
    eyebrow: 'AI risk taxonomy',
    indexTitle: 'Risk families',
    singular: 'Risk family',
    description:
      'Five broad ways capable AI systems can create harm, each grounded in recognizable cultural scenes.',
    indexHref: '/risk-families'
  },
  concept: {
    eyebrow: 'AI safety index',
    indexTitle: 'Concepts',
    singular: 'AI safety concept',
    description:
      'Specific ideas from AI safety, alignment, governance, and human–AI interaction.',
    indexHref: '/concepts'
  }
} as const satisfies Record<
  ResourceKind,
  {
    readonly eyebrow: string
    readonly indexTitle: string
    readonly singular: string
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
      <SiteHeader inset context={`${presentation.indexTitle} / index`} />

      <section className={styles.indexIntro}>
        <p className={styles.eyebrow}>{presentation.eyebrow}</p>
        <h1>{presentation.indexTitle}</h1>
        <p className={styles.introCopy}>{presentation.description}</p>
        <p className={styles.recordCount}>
          {String(resources.length).padStart(2, '0')} records
        </p>
      </section>

      <ol className={styles.resourceIndex} data-resource-kind={kind}>
        {resources.map((resource, index) => (
          <li key={resource.id}>
            <Link href={resource.href}>
              <span className={styles.indexNumber}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2>{resource.title}</h2>
              {kind === 'risk-family' ? <p>{resource.description}</p> : null}
              <span className={styles.itemCount}>
                {formatScenarioCount(resource.scenarioCount)}
              </span>
              <span className={styles.openMark} aria-hidden='true'>
                ↗
              </span>
            </Link>
          </li>
        ))}
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
    <main className={`experience-scope ${styles.page}`}>
      <SiteHeader
        inset
        context={`${presentation.singular} / ${formatScenarioCount(resource.scenarioCount)}`}
      />

      <section className={styles.detailIntro}>
        <p className={styles.eyebrow}>{presentation.singular}</p>
        <h1>{resource.title}</h1>
        <div className={styles.detailSummary}>
          <p>{resource.description}</p>
          {resource.externalLinks.length > 0 ? (
            <ul
              className={styles.externalLinks}
              aria-label='External references'
            >
              {resource.externalLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target='_blank' rel='noreferrer'>
                    <span aria-hidden='true'>×</span>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
          <ul className={styles.relatedList}>
            {resource.relatedResources.map((related) => (
              <li key={`${related.kind}:${related.id}`}>
                <Link href={related.href}>
                  <span>{PRESENTATION[related.kind].singular}</span>
                  <strong>{related.title}</strong>
                  <small>{formatScenarioCount(related.scenarioCount)}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

export function SearchResultsPage({
  query,
  documents
}: {
  readonly query: string
  readonly documents: readonly SearchDocument[]
}) {
  return (
    <main className={`experience-scope ${styles.page}`}>
      <SiteHeader inset context='Search / archive' />

      <section className={styles.searchIntro}>
        <p className={styles.eyebrow}>Cross-resource search</p>
        <h1>Search</h1>
        <form action='/search' className={styles.searchForm}>
          <label htmlFor='archive-search'>
            Find a familiar story or AI idea
          </label>
          <div>
            <input
              id='archive-search'
              type='search'
              name='q'
              defaultValue={query}
              placeholder='Try “Black Mirror” or “Goodhart”'
              autoComplete='off'
            />
            <button type='submit'>Search archive</button>
          </div>
        </form>
      </section>

      <section className={styles.searchResults} aria-live='polite'>
        <header className={styles.sectionHeader}>
          <p>Results</p>
          <h2>{query ? `Matches for “${query}”` : 'Enter a search above'}</h2>
          <span>{String(documents.length).padStart(2, '0')}</span>
        </header>
        {documents.length > 0 ? (
          <ol>
            {documents.map((document, index) => (
              <li key={`${document.kind}:${document.href}`}>
                <Link href={document.href}>
                  <span className={styles.indexNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.searchKind}>
                    {searchKindLabel(document.kind)}
                  </span>
                  <strong>{document.title}</strong>
                  <small>{document.subtitle}</small>
                  <span className={styles.openMark} aria-hidden='true'>
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : query ? (
          <p className={styles.noResults}>
            No records matched. Try a source title, scenario, risk, or concept.
          </p>
        ) : (
          <nav
            className={styles.searchPivots}
            aria-label='Browse archive indices'
          >
            <Link href='/risk-families'>Risk families</Link>
            <Link href='/concepts'>AI safety concepts</Link>
            <Link href='/sources'>Cultural sources</Link>
          </nav>
        )}
      </section>
    </main>
  )
}

function formatScenarioCount(count: number) {
  return `${count} ${count === 1 ? 'scenario' : 'scenarios'}`
}

function searchKindLabel(kind: SearchDocument['kind']) {
  if (kind === 'scenario') return 'Scenario'

  return PRESENTATION[kind].singular
}
