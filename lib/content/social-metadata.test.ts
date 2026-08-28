import type { ResolvingMetadata } from 'next'
import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'

import {
  getLeadingSourceCredit,
  getResourceSocialMetadata,
  resolveContentSocialMetadata,
  toSocialSentenceFragment,
  type ContentSocialMetadata
} from './social-metadata'

describe('social metadata derivation', () => {
  it('normalizes prose labels without lowercasing acronyms', () => {
    expect(toSocialSentenceFragment('AI-Enabled Data Exfiltration')).toBe(
      'AI-enabled data exfiltration'
    )
    expect(toSocialSentenceFragment('Malicious Use')).toBe('malicious use')
  })

  it('extracts only a clear leading possessive production credit', () => {
    expect(
      getLeadingSourceCredit(
        'Christopher Nolan’s epic adaptation follows a long voyage home.'
      )
    ).toBe('Christopher Nolan’s')
    expect(
      getLeadingSourceCredit(
        'A family’s last defense against a worldwide robot uprising.'
      )
    ).toBeNull()
    expect(
      getLeadingSourceCredit(
        'Christopher Nolan’s The Odyssey film follows a long voyage home.'
      )
    ).toBe('Christopher Nolan’s')
  })

  it('projects current catalog records through their route hierarchy', () => {
    const risk = contentCatalog.getResourcePage(
      'risk-family',
      contentCatalog.getStaticSlugs('risk-family')[0]!
    )!
    const concept = contentCatalog.getResourcePage(
      'concept',
      contentCatalog.getStaticSlugs('concept')[0]!
    )!
    const creditedSource = contentCatalog
      .getStaticSlugs('source')
      .map((slug) => contentCatalog.getResourcePage('source', slug)!)
      .find(({ description }) => getLeadingSourceCredit(description))!

    const riskSocial = getResourceSocialMetadata(risk)
    const conceptSocial = getResourceSocialMetadata(concept)
    const sourceSocial = getResourceSocialMetadata(creditedSource)
    const sourceCredit = getLeadingSourceCredit(creditedSource.description)!

    expect(riskSocial.title).toBe(`Risk families / ${risk.title}`)
    expect(riskSocial.description).toContain(
      toSocialSentenceFragment(risk.title)
    )
    expect(conceptSocial.title).toBe(`AI safety concepts / ${concept.title}`)
    expect(conceptSocial.description).toContain(
      toSocialSentenceFragment(concept.title)
    )
    expect(sourceSocial.title).toBe(
      `AI safety analogies from ${creditedSource.title}`
    )
    expect(sourceSocial.description).toContain(
      `${sourceCredit} ${creditedSource.title}`
    )
  })

  it('keeps singular and plural risk-family descriptions grammatical', () => {
    const resources = contentCatalog
      .getStaticSlugs('risk-family')
      .map((slug) => contentCatalog.getResourcePage('risk-family', slug)!)
    const maliciousUse = resources.find(
      ({ title }) => title === 'Malicious use'
    )!
    const accidents = resources.find(({ title }) => title === 'Accidents')!

    expect(getResourceSocialMetadata(maliciousUse).description).toBe(
      'Examples of malicious use AI risks from popular TV shows and movies.'
    )
    expect(getResourceSocialMetadata(accidents).description).toBe(
      'Examples of AI risks involving accidents in popular TV shows and movies.'
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

    const withImage = await resolveContentSocialMetadata(
      {
        ...social,
        image: {
          gallerySrc: '/media/gallery.webp',
          detailSrc: '/media/detail.webp',
          width: 1920,
          height: 1080,
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
