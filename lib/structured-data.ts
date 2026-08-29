import type { ResourcePage, ScenarioPage } from '@/lib/content/catalog'
import {
  getResourceSocialMetadata,
  getScenarioSocialMetadata
} from '@/lib/content/social-metadata'
import {
  repositoryUrl,
  siteName,
  siteSummary,
  siteUrl,
  xProfileUrl
} from '@/lib/site'

const websiteId = absoluteUrl('/#website')
const creatorId = absoluteUrl('/#creator')

const websiteReference = { '@id': websiteId } as const
const creatorReference = { '@id': creatorId } as const

export const siteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': websiteId,
      url: absoluteUrl('/'),
      name: siteName,
      description: siteSummary,
      inLanguage: 'en-US',
      creator: creatorReference,
      sameAs: [repositoryUrl]
    },
    {
      '@type': 'Person',
      '@id': creatorId,
      name: 'Travis Fischer',
      url: xProfileUrl,
      sameAs: [xProfileUrl]
    }
  ]
} as const

export function getScenarioStructuredData(scenario: ScenarioPage) {
  const social = getScenarioSocialMetadata(scenario)
  const pageUrl = absoluteUrl(social.canonical)

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    url: pageUrl,
    headline: social.title,
    description: social.description,
    inLanguage: 'en-US',
    isPartOf: websiteReference,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl
    },
    author: creatorReference,
    image: toImageObject(scenario.image),
    keywords: social.keywords,
    about: [
      {
        '@type': scenario.source.sourceType === 'movie' ? 'Movie' : 'TVSeries',
        '@id': `${absoluteUrl(scenario.source.href)}#source`,
        name: scenario.source.title,
        url: absoluteUrl(scenario.source.href)
      },
      ...scenario.riskFamilies.map((family) => toDefinedTerm(family)),
      ...scenario.concepts.map((concept) => toDefinedTerm(concept))
    ]
  } as const
}

export function getResourceStructuredData(resource: ResourcePage) {
  const social = getResourceSocialMetadata(resource)
  const pageUrl = absoluteUrl(social.canonical)
  const entity = getResourceEntity(resource, pageUrl)

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: social.title,
    description: social.description,
    inLanguage: 'en-US',
    isPartOf: websiteReference,
    mainEntity: { '@id': entity['@id'] },
    about: entity,
    hasPart: resource.scenarios.map((scenario) => ({
      '@type': 'Article',
      '@id': `${absoluteUrl(scenario.href)}#article`,
      url: absoluteUrl(scenario.href),
      headline: scenario.title
    }))
  } as const
}

function getResourceEntity(resource: ResourcePage, pageUrl: string) {
  if (resource.kind === 'source') {
    return {
      '@type': resource.sourceType === 'movie' ? 'Movie' : 'TVSeries',
      '@id': `${pageUrl}#source`,
      name: resource.title,
      url: pageUrl,
      ...(resource.description
        ? { description: resource.description }
        : undefined),
      ...(resource.poster
        ? { image: toImageObject(resource.poster) }
        : undefined)
    } as const
  }

  return {
    '@type': 'DefinedTerm',
    '@id': `${pageUrl}#term`,
    name: resource.detailTitle,
    url: pageUrl,
    ...(resource.description
      ? { description: resource.description }
      : undefined),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': absoluteUrl(
        resource.kind === 'risk-family' ? '/risk-families' : '/concepts'
      )
    }
  } as const
}

function toDefinedTerm(term: {
  readonly href: string
  readonly title: string
}) {
  return {
    '@type': 'DefinedTerm',
    '@id': `${absoluteUrl(term.href)}#term`,
    name: term.title,
    url: absoluteUrl(term.href)
  } as const
}

function toImageObject(image: {
  readonly alt: string
  readonly detailSrc: string
  readonly height: number
  readonly width: number
}) {
  return {
    '@type': 'ImageObject',
    url: absoluteUrl(image.detailSrc),
    width: image.width,
    height: image.height,
    caption: image.alt
  } as const
}

function absoluteUrl(path: string) {
  return new URL(path, siteUrl).href
}
