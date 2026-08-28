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
      kind: 'film',
      href: '/sources/source-one',
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
      alt: 'A still with [brackets]'
    },
    video: { provider: 'youtube', id: 'abc123', startSeconds: 0 },
    scene: 'The **authored** scene.',
    whyAnalogyWorks: 'The authored analogy.',
    caveats: 'The authored caveat.',
    riskFamilies: [
      {
        id: 'risk-one',
        slug: 'risk-one',
        title: 'Risk One',
        href: '/risk-families/risk-one'
      }
    ],
    concepts: [],
    moreFromSource: [],
    relatedScenarios: []
  }
}
