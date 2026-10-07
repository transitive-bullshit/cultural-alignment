import type { ResolvingMetadata } from 'next'
import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import {
  formatMediaFormats,
  getResourceSocialMetadata,
  getSceneContext,
  getScenarioSocialMetadata,
  resolveContentSocialMetadata,
  SOCIAL_DESCRIPTION_MAX_LENGTH,
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

    // Every current concept: only capitalization changes, acronyms survive,
    // and eponymous names stay as authored.
    for (const { title } of contentCatalog.listResources('concept')) {
      const phrase = toProsePhrase(title)
      const acronyms = title.match(/\b\p{Lu}{2,}\b/gu) ?? []

      expect(phrase.toLowerCase()).toBe(title.toLowerCase())
      for (const acronym of acronyms) expect(phrase).toContain(acronym)
      const eponym = /[’']s\b/u.test(title)
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
    const movie = scenarios.find(
      ({ releaseDate, source }) => source.sourceType === 'movie' && releaseDate
    )!

    expect(getSceneContext(numbered)).toMatch(/^Season \d+, Episodes? \d+/u)
    expect(getSceneContext(movie)).toBe(movie.releaseDate!.slice(0, 4))
  })

  it('keeps every description one short sentence without counts', () => {
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
      expect(description.length).toBeLessThanOrEqual(
        SOCIAL_DESCRIPTION_MAX_LENGTH
      )
      expect(description).not.toMatch(/\b\d+ (?:AI|examples|scenes)\b/u)
    }
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
    expect(social.description.length).toBeLessThanOrEqual(
      SOCIAL_DESCRIPTION_MAX_LENGTH
    )
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
