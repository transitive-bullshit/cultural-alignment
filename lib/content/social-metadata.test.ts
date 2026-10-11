import type { ResolvingMetadata } from 'next'
import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import {
  formatMediaFormats,
  getResourceSocialMetadata,
  getSceneContext,
  getScenarioSocialMetadata,
  resolveContentSocialMetadata,
  toProsePhrase,
  type ContentSocialMetadata
} from './social-metadata'

const resourceKinds = ['risk-family', 'concept', 'source', 'franchise'] as const

describe('social metadata derivation', () => {
  it('writes taxonomy names into prose without losing proper nouns', () => {
    expect(toProsePhrase('Contestability')).toBe('contestability')
    expect(toProsePhrase('Algorithmic Bias')).toBe('algorithmic bias')
    expect(toProsePhrase('Value Lock-In')).toBe('value lock-in')
    expect(toProsePhrase('AI Control')).toBe('AI control')
    expect(toProsePhrase('CBRN Assistance')).toBe('CBRN assistance')
    expect(toProsePhrase('Goodhart’s Law')).toBe('Goodhart’s Law')
    expect(toProsePhrase('AI Security & Governance Risks')).toBe(
      'AI security and governance risks'
    )

    // Current concepts retain words, acronyms, and eponyms; prose expands &.
    for (const { title } of contentCatalog.listResources('concept')) {
      const phrase = toProsePhrase(title)
      const acronyms = title.match(/\b\p{Lu}{2,}\b/gu) ?? []

      const eponym = /[’']s\b/u.test(title)
      expect(phrase.toLowerCase()).toBe(
        (eponym ? title : title.replaceAll(' & ', ' and ')).toLowerCase()
      )
      for (const acronym of acronyms) expect(phrase).toContain(acronym)
      expect(
        eponym
          ? phrase === title
          : /^(?:[\p{Ll}\p{N}]|\p{Lu}{2,}\b)/u.test(phrase)
      ).toBe(true)
    }
  })

  it('names only the media formats a page draws on', () => {
    expect(formatMediaFormats(['tv', 'movie', 'anime'])).toBe(
      'across TV, movies, and anime'
    )
    expect(formatMediaFormats(['tv', 'movie'])).toBe('across TV and movies')
    expect(formatMediaFormats(['movie'])).toBe('in movies')
    expect(formatMediaFormats([])).toBe('across film and TV')
  })

  it('places a scene by episode for TV and by year for movies', () => {
    const scenarios = contentCatalog
      .getStaticSlugs('scenario')
      .map((slug) => contentCatalog.getScenarioPage(slug)!)
    const numbered = scenarios.find(({ episode }) =>
      /\bS\d+\s?E\d+\b/u.test(episode?.label ?? '')
    )!
    const movies = scenarios.filter(
      ({ source }) => source.sourceType === 'movie' && source.releaseDate
    )

    expect(getSceneContext(numbered)).toMatch(/^Season \d+, Episodes? \d+/u)
    // Scenario records can carry their own date (e.g. a Blade Runner scene
    // dated 2026); the description uses the film's release year.
    expect(movies.length).toBeGreaterThan(0)
    for (const movie of movies) {
      expect(getSceneContext(movie)).toBe(movie.source.releaseDate!.slice(0, 4))
    }
  })

  it('keeps current descriptions short and free of scene counts', () => {
    const descriptions = [
      ...contentCatalog
        .getStaticSlugs('scenario')
        .map(
          (slug) =>
            getScenarioSocialMetadata(contentCatalog.getScenarioPage(slug)!)
              .description
        ),
      ...resourceKinds.flatMap((kind) =>
        contentCatalog
          .getStaticSlugs(kind)
          .map(
            (slug) =>
              getResourceSocialMetadata(
                contentCatalog.getResourcePage(kind, slug)!
              ).description
          )
      )
    ]

    for (const description of descriptions) {
      expect(description.length).toBeGreaterThan(0)
      expect(description.length).toBeLessThanOrEqual(150)
      expect(description).not.toMatch(/\b\d+ (?:AI|examples|scenes)\b/u)
    }
  })

  it('writes one sentence and drops overlong episode context without losing the mapping', () => {
    const base = contentCatalog.getScenarioPage(
      contentCatalog.getStaticSlugs('scenario')[0]!
    )!
    const scenario = {
      ...base,
      source: {
        ...base.source,
        title: 'Example Show',
        sourceType: 'tv-show' as const
      },
      concepts: [{ ...base.concepts[0]!, title: 'AI Control' }],
      episode: { label: 'Episode 4' }
    }
    expect(getScenarioSocialMetadata(scenario).description).toBe(
      'This scene from Example Show (Episode 4) is an example of the AI safety concept of AI control.'
    )
    expect(
      getScenarioSocialMetadata({
        ...scenario,
        episode: {
          label: 'An exceptionally long episode title '.repeat(6).trim()
        }
      }).description
    ).toBe(
      'This scene from Example Show is an example of the AI safety concept of AI control.'
    )
  })

  it('names each resource in its title and keeps authored capitalization', () => {
    for (const kind of resourceKinds) {
      const resource = contentCatalog.getResourcePage(
        kind,
        contentCatalog.getStaticSlugs(kind)[0]!
      )!
      const social = getResourceSocialMetadata(resource)
      const name =
        kind === 'risk-family' ? resource.detailTitle : resource.title

      expect(social.title).toContain(name)
      expect(social.canonical).toBe(resource.href)
    }
  })

  it('describes a scenario through its source and primary concept', () => {
    const scenario = contentCatalog.getScenarioPage(
      contentCatalog.getStaticSlugs('scenario')[0]!
    )!
    const social = getScenarioSocialMetadata(scenario)

    expect(social.title).toContain(scenario.title)
    expect(social.description).toContain(scenario.source.title)
    expect(social.description).toContain(
      toProsePhrase(scenario.concepts[0]!.title)
    )
    expect(social.description.length).toBeLessThanOrEqual(150)
  })

  it('uses a detail image when present and otherwise preserves the parent image', async () => {
    const inheritedImage = { url: 'https://example.com/global.jpg' }
    const parent = Promise.resolve({
      openGraph: { images: [inheritedImage] }
    }) as ResolvingMetadata
    const social = {
      canonical: '/scenarios/example',
      description: 'A scene description.',
      title: 'Source / Scenario',
      type: 'article'
    } satisfies ContentSocialMetadata

    const fallback = await resolveContentSocialMetadata(social, parent)
    expect(fallback.openGraph?.images).toEqual([inheritedImage])
    // A plain title lets the root layout's template append the site name, and
    // Open Graph inherits the resolved title rather than repeating it.
    expect(fallback.title).toBe(social.title)
    expect(fallback.openGraph).not.toHaveProperty('title')

    const withImage = await resolveContentSocialMetadata(
      {
        ...social,
        image: {
          gallerySrc: '/media/gallery.webp',
          detailSrc: '/media/detail.webp',
          width: 1920,
          height: 1080,
          blurDataURL:
            'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
          alt: 'Scenario still'
        }
      },
      parent
    )
    const resolvedImages = withImage.openGraph?.images
    const image = Array.isArray(resolvedImages)
      ? resolvedImages[0]
      : resolvedImages

    expect(image).toMatchObject({
      width: 1920,
      height: 1080,
      alt: 'Scenario still',
      type: 'image/webp'
    })
    const imageUrl =
      image instanceof URL
        ? image
        : typeof image === 'object'
          ? image?.url
          : image

    expect(new URL(String(imageUrl)).pathname).toBe('/media/detail.webp')
  })
})
