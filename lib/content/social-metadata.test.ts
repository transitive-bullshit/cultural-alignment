import type { ResolvingMetadata } from 'next'
import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import {
  getResourceSocialMetadata,
  getScenarioSocialMetadata,
  resolveContentSocialMetadata,
  SOCIAL_DESCRIPTION_MAX_LENGTH,
  summarizeDescription,
  truncateAtWord,
  type ContentSocialMetadata
} from './social-metadata'

const resourceKinds = ['risk-family', 'concept', 'source', 'franchise'] as const
const longClause = 'a clause that keeps going '.repeat(4).trim()

describe('social metadata derivation', () => {
  it('keeps the first authored sentence without splitting on initials', () => {
    expect(summarizeDescription('Dr. No meets James T. Kirk. Then more.')).toBe(
      'Dr. No meets James T. Kirk.'
    )
    expect(summarizeDescription(null)).toBe('')
  })

  it('ends an overlong sentence at a clause break, else at a word', () => {
    expect(
      summarizeDescription(
        `The pianist hides in the ruins of occupied Warsaw for several long years as he survives ${longClause} ${longClause}.`
      )
    ).toBe(
      'The pianist hides in the ruins of occupied Warsaw for several long years.'
    )
    expect(truncateAtWord('alpha beta gamma', 12)).toBe('alpha beta…')
    expect(truncateAtWord('alpha beta', 12)).toBe('alpha beta')
  })

  it('describes every resource with its own trimmed copy', () => {
    for (const kind of resourceKinds) {
      for (const slug of contentCatalog.getStaticSlugs(kind)) {
        const resource = contentCatalog.getResourcePage(kind, slug)!
        const { description } = getResourceSocialMetadata(resource)

        expect(description).toBe(summarizeDescription(resource.description))
        expect(description.length).toBeGreaterThan(0)
        expect(description.length).toBeLessThanOrEqual(
          SOCIAL_DESCRIPTION_MAX_LENGTH
        )
      }
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
    expect(social.description).toContain(scenario.concepts[0]!.title)
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
