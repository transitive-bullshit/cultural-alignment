import { describe, expect, it } from 'vitest'

import type { ScenarioPage } from '@/lib/content/catalog'

import { formatScenarioAsMarkdown } from './scenario-markdown'

describe('formatScenarioAsMarkdown', () => {
  it('serializes escaped metadata, absolute media links, and optional video', () => {
    const scenario = createScenario()
    const markdown = formatScenarioAsMarkdown(
      scenario,
      new URL('https://example.com/base/')
    )

    expect(markdown).toContain('# A \\[complicated\\] scenario')
    expect(markdown).toContain(
      '[Source \\*One\\*](https://example.com/sources/source-one)'
    )
    expect(markdown).toContain(
      '- **Episode:** [Episode 1](https://example.org/episode)'
    )
    expect(markdown).toContain(
      '![A still with \\[brackets\\]](https://example.com/media/detail%20%28final%29.webp)'
    )
    expect(markdown).toContain('https://www.youtube.com/watch?v=abc123&t=0s')
    expect(markdown).not.toContain('](<')
    expect(markdown).toContain(scenario.whyAnalogyWorks)

    expect(
      formatScenarioAsMarkdown(
        { ...scenario, video: null },
        new URL('https://example.com/')
      )
    ).not.toContain('## Video')
  })

  it('omits episode metadata for movies even when legacy data includes it', () => {
    const scenario = createScenario()
    const markdown = formatScenarioAsMarkdown(
      {
        ...scenario,
        source: { ...scenario.source, sourceType: 'movie' }
      },
      new URL('https://example.com/')
    )

    expect(markdown).not.toContain('**Episode:**')
  })

  it('escapes tildes so GFM does not strike them through (title, source, episode, taxonomy)', () => {
    const base = createScenario()
    const scenario: ScenarioPage = {
      ...base,
      title: 'Scenario ~with tildes~',
      source: { ...base.source, title: 'Source ~One~' },
      episode: {
        label: 'Confession ~The Future~',
        href: 'https://en.wikipedia.org/wiki/Mob_Psycho_100#Anime'
      },
      riskFamilies: [
        {
          id: 'risk-tilde',
          slug: 'risk-tilde',
          title: 'Risk ~foo~',
          href: '/risk-families/risk-tilde',
          description: 'A risk description.'
        }
      ],
      concepts: [
        {
          id: 'concept-tilde',
          slug: 'concept-tilde',
          title: 'Concept ~bar~',
          href: '/concepts/concept-tilde',
          description: 'A concept description.'
        }
      ]
    }

    const markdown = formatScenarioAsMarkdown(
      scenario,
      new URL('https://example.com/')
    )

    // title H1 path
    expect(markdown).toContain('# Scenario \\~with tildes\\~')
    expect(markdown).not.toContain('# Scenario ~with tildes~')
    // source link label path
    expect(markdown).toContain('[Source \\~One\\~](')
    expect(markdown).not.toContain('[Source ~One~](')
    // episode-label link path (real production label)
    expect(markdown).toContain('[Confession \\~The Future\\~](')
    expect(markdown).not.toContain('[Confession ~The Future~](')
    // taxonomy-link paths (risk families + AI safety concepts)
    expect(markdown).toContain('[Risk \\~foo\\~](')
    expect(markdown).not.toContain('[Risk ~foo~](')
    expect(markdown).toContain('[Concept \\~bar\\~](')
    expect(markdown).not.toContain('[Concept ~bar~](')
  })

  it('serializes franchises above the source with absolute, escaped links', () => {
    const franchises = [
      {
        id: 'franchise-one',
        slug: 'franchise-one',
        title: 'Franchise *One*',
        href: '/franchises/franchise-one'
      }
    ]
    const scenario = { ...createScenario(), franchises }
    const markdown = formatScenarioAsMarkdown(
      scenario,
      new URL('https://example.com/base/')
    )

    expect(markdown).toContain(
      '- **Franchises:** [Franchise \\*One\\*](https://example.com/franchises/franchise-one)'
    )

    const detailsStart = markdown.indexOf('## Scenario details\n\n')
    expect(detailsStart).toBeGreaterThan(-1)
    const detailsBody = markdown.slice(
      detailsStart + '## Scenario details\n\n'.length
    )
    expect(detailsBody.startsWith('- **Franchises:**')).toBe(true)
    expect(detailsBody.indexOf('**Franchises:**')).toBeLessThan(
      detailsBody.indexOf('**Source:**')
    )
  })

  it('joins multiple franchises with comma separators in display order', () => {
    const franchises = [
      {
        id: 'franchise-one',
        slug: 'franchise-one',
        title: 'Franchise *One*',
        href: '/franchises/franchise-one'
      },
      {
        id: 'franchise-two',
        slug: 'franchise-two',
        title: 'Franchise [Two]',
        href: '/franchises/franchise-two'
      }
    ]
    const scenario = { ...createScenario(), franchises }
    const markdown = formatScenarioAsMarkdown(
      scenario,
      new URL('https://example.com/')
    )

    expect(markdown).toContain(
      '- **Franchises:** [Franchise \\*One\\*](https://example.com/franchises/franchise-one), [Franchise \\[Two\\]](https://example.com/franchises/franchise-two)'
    )
    const first = markdown.indexOf(
      '[Franchise \\*One\\*](https://example.com/franchises/franchise-one)'
    )
    const second = markdown.indexOf(
      '[Franchise \\[Two\\]](https://example.com/franchises/franchise-two)'
    )
    expect(first).toBeLessThan(second)
  })

  it('omits the franchises line for scenarios with no franchise', () => {
    const scenario = createScenario()
    const markdown = formatScenarioAsMarkdown(
      scenario,
      new URL('https://example.com/')
    )

    expect(markdown).not.toContain('**Franchises:**')
    expect(markdown).toContain('**Source:**')

    const detailsStart = markdown.indexOf('## Scenario details\n\n')
    expect(detailsStart).toBeGreaterThan(-1)
    const detailsBody = markdown.slice(
      detailsStart + '## Scenario details\n\n'.length
    )
    expect(detailsBody.startsWith('- **Source:**')).toBe(true)
  })
})

function createScenario(): ScenarioPage {
  return {
    id: 'scenario-one',
    slug: 'scenario-one',
    title: 'A [complicated] scenario',
    source: {
      id: 'source-one',
      slug: 'source-one',
      title: 'Source *One*',
      sourceType: 'tv-show',
      href: '/sources/source-one',
      description: null,
      links: [],
      scenarioCount: 1
    },
    episode: { label: 'Episode 1', href: 'https://example.org/episode' },
    releaseDate: '2024-05-01',
    image: {
      gallerySrc: '/media/gallery.webp',
      detailSrc: '/media/detail (final).webp',
      width: 1600,
      height: 900,
      blurDataURL:
        'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
      alt: 'A still with [brackets]'
    },
    memes: [],
    video: { provider: 'youtube', id: 'abc123', startSeconds: 0 },
    scene: 'The **authored** scene.',
    whyAnalogyWorks: 'The authored analogy.',
    caveats: 'The authored caveat.',
    franchises: [],
    riskFamilies: [
      {
        id: 'risk-one',
        slug: 'risk-one',
        title: 'Risk One',
        href: '/risk-families/risk-one',
        description: 'A risk description.'
      }
    ],
    concepts: [],
    continuation: {
      kind: 'source',
      id: 'source-one',
      slug: 'source-one',
      href: '/sources/source-one',
      title: 'Source *One*',
      scenarioCount: 1
    },
    moreFromCollection: [],
    relatedScenarios: []
  }
}
