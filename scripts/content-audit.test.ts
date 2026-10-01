import { describe, expect, it } from 'vitest'

import type {
  ContentImage,
  ContentSnapshot,
  ScenarioRecord,
  SourceRecord
} from '../lib/content/schema'
import {
  AUDIT_LIMITS,
  auditContent,
  formatAuditMarkdown
} from './content-audit'
import { scenarioImageAlt, sourcePosterAlt } from './sync-fast-media'

// `snapshot()` replaces this with the synchronizer's generated alt text.
const GENERATED_ALT = 'generated'

const image: ContentImage = {
  gallerySrc: 'https://assets.example.com/gallery.webp',
  detailSrc: 'https://assets.example.com/detail.webp',
  width: 1920,
  height: 1080,
  alt: GENERATED_ALT,
  blurDataURL: 'data:image/webp;base64,AAAA'
}

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-film',
    slug: 'film',
    title: 'The Film',
    keywords: [],
    sourceType: 'movie',
    description: 'A film.',
    releaseDate: '2000-01-01',
    poster: image,
    imdbUrl: null,
    rottenTomatoesUrl: null,
    youtubeTrailerUrl: 'https://www.youtube.com/watch?v=trailer',
    franchiseIds: [],
    relatedSourceIds: [],
    ...overrides
  }
}

function scenario(overrides: Partial<ScenarioRecord> = {}): ScenarioRecord {
  return {
    id: 'scenario-a',
    slug: 'scenario-a',
    title: 'A Concise Scenario',
    keywords: [],
    sourceId: 'source-film',
    releaseDate: null,
    featured: false,
    tags: [],
    riskFamilyIds: ['family-1'],
    conceptIds: ['concept-1', 'concept-2'],
    image,
    memes: [],
    video: { provider: 'youtube', id: 'clip' },
    scene: 'Something happens.',
    whyAnalogyWorks: 'It maps cleanly.',
    caveats: 'It is fiction.',
    ...overrides
  }
}

function snapshot(
  scenarios: ScenarioRecord[],
  sources: SourceRecord[] = [source()]
): ContentSnapshot {
  const titles = new Map(sources.map(({ id, title }) => [id, title]))
  const withAlt = (record: ContentImage, alt: string) =>
    record.alt === GENERATED_ALT ? { ...record, alt } : record

  return {
    schemaVersion: 3,
    scenarios: scenarios.map((s) => ({
      ...s,
      image: withAlt(
        s.image,
        scenarioImageAlt(titles.get(s.sourceId) ?? '', s.title)
      )
    })),
    sources: sources.map((s) => ({
      ...s,
      poster: s.poster && withAlt(s.poster, sourcePosterAlt(s.title))
    })),
    franchises: [],
    riskFamilies: [],
    concepts: ['concept-1', 'concept-2'].map((id) => ({
      id,
      slug: id,
      shortName: id,
      longName: id,
      keywords: [],
      description: 'A concept.',
      wikipediaUrl: null,
      citations: [
        { href: 'https://example.com', title: 'Paper', publisher: null }
      ]
    }))
  }
}

const rules = (audit: ReturnType<typeof auditContent>) =>
  audit.findings.map((finding) => `${finding.slug}:${finding.rule}`)

describe('auditContent', () => {
  it('reports nothing for a scenario that follows the conventions', () => {
    expect(auditContent(snapshot([scenario()])).findings).toEqual([])
  })

  it('flags convention drift on scenarios', () => {
    const concepts = Array.from(
      { length: AUDIT_LIMITS.concepts + 1 },
      (_, i) => `concept-${i}`
    )
    const tv = source({
      id: 'source-tv',
      slug: 'show',
      title: 'The Show',
      sourceType: 'tv-show'
    })
    const audit = auditContent(
      snapshot(
        [
          scenario({
            slug: 'overlong',
            title: 'x'.repeat(AUDIT_LIMITS.titleCharacters + 1),
            conceptIds: concepts,
            riskFamilyIds: ['a', 'b', 'c'],
            video: null
          }),
          scenario({
            id: 'scenario-b',
            slug: 'no-episode',
            sourceId: 'source-tv'
          })
        ],
        [source(), tv]
      )
    )

    expect(rules(audit)).toEqual([
      'overlong:title-length',
      'overlong:risk-family-count',
      'overlong:concept-count',
      'overlong:clip-missing',
      'no-episode:tv-episode-missing'
    ])
  })

  it('flags small, narrow, and dark stills', () => {
    const audit = auditContent(
      snapshot([scenario({ image: { ...image, width: 800, height: 600 } })]),
      {
        stillLuminance: new Map([
          ['scenario-a', AUDIT_LIMITS.stillMinLuminance / 2]
        ])
      }
    )

    expect(rules(audit)).toEqual([
      'scenario-a:still-small',
      'scenario-a:still-aspect',
      'scenario-a:still-dark'
    ])
  })

  it('flags image captions that replaced generated alt text', () => {
    const audit = auditContent(
      snapshot([
        scenario({ image: { ...image, alt: 'Film still. Image source' } })
      ])
    )

    expect(rules(audit)).toEqual(['scenario-a:caption-alt-text'])
  })

  it('flags prose that names a different source, but not its own', () => {
    const other = source({
      id: 'source-other',
      slug: 'other',
      title: 'Parks and Recreation'
    })
    const audit = auditContent(
      snapshot(
        [
          scenario({
            caveats: 'As in Parks and Recreation, the goal inverts.'
          }),
          scenario({
            id: 'scenario-b',
            slug: 'own',
            caveats: 'The Film says so.'
          })
        ],
        [source(), other]
      )
    )

    expect(rules(audit)).toContain('scenario-a:prose-names-other-source')
    expect(rules(audit)).not.toContain('own:prose-names-other-source')
  })

  it('limits record findings to the requested source', () => {
    const other = source({
      id: 'source-other',
      slug: 'other',
      youtubeTrailerUrl: null
    })
    const audit = auditContent(
      snapshot(
        [
          scenario({ video: null }),
          scenario({
            id: 'scenario-b',
            slug: 'elsewhere',
            title: 'Elsewhere',
            sourceId: 'source-other',
            video: null
          })
        ],
        [source(), other]
      ),
      { scope: { sourceSlugs: new Set(['other']) } }
    )

    expect(rules(audit)).toEqual([
      'elsewhere:clip-missing',
      'other:trailer-missing'
    ])
  })

  it('formats fix findings before review findings', () => {
    const audit = auditContent(
      snapshot([scenario({ video: null, title: 'x'.repeat(50) })])
    )
    const markdown = formatAuditMarkdown(audit, { limit: 5 })

    expect(markdown.indexOf('`title-length`')).toBeLessThan(
      markdown.indexOf('`clip-missing`')
    )
  })
})
