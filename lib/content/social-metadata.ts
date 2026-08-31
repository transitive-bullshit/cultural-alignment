import type { Metadata, ResolvingMetadata } from 'next'

import { siteName, siteUrl } from '@/lib/site'

import type { ContentImage, ResourcePage, ScenarioPage } from './catalog'

const leadingSourceCreditPattern =
  /^((?:\p{Lu}[\p{L}\p{M}.'’-]*\s+){0,4}\p{Lu}[\p{L}\p{M}.'’-]*[’']s)\s+(?:[\p{L}\p{M}-]+\s+){0,2}(?:adaptation|film|movie|series)\b/u

export type ContentSocialMetadata = Readonly<{
  canonical: string
  description: string
  image?: ContentImage | null
  keywords?: readonly string[]
  title: string
  type: 'article' | 'website'
}>

type ResolveContentSocialMetadataOptions = Readonly<{
  includeImages?: boolean
}>

export function getResourceSocialMetadata(
  resource: ResourcePage
): ContentSocialMetadata {
  const name = toSocialSentenceFragment(resource.title)

  switch (resource.kind) {
    case 'risk-family':
      return {
        canonical: resource.href,
        description: getRiskFamilyDescription(name),
        title: `Risk families / ${resource.title}`,
        type: 'website'
      }
    case 'concept':
      return {
        canonical: resource.href,
        description: `Examples from popular TV shows and movies that illustrate ${name} in AI safety and alignment.`,
        title: `AI safety concepts / ${resource.title}`,
        type: 'website'
      }
    case 'franchise':
      return {
        canonical: resource.href,
        description: resource.description,
        image: resource.image,
        title: `Media franchises / ${resource.title}`,
        type: 'website'
      }
    case 'source': {
      const credit = getLeadingSourceCredit(resource.description)
      const sourceDescriptor = credit
        ? `${credit} ${resource.title}`
        : resource.title

      return {
        canonical: resource.href,
        description: `Examples of AI Safety from ${sourceDescriptor}.`,
        title: `AI safety analogies from ${resource.title}`,
        type: 'website'
      }
    }
  }
}

export function getScenarioSocialMetadata(
  scenario: ScenarioPage
): ContentSocialMetadata {
  return {
    canonical: `/scenarios/${scenario.slug}`,
    description: scenario.scene,
    image: scenario.image,
    keywords: [
      ...scenario.franchises.map(({ title }) => title),
      scenario.source.title,
      ...scenario.riskFamilies.map(({ title }) => title),
      ...scenario.concepts.map(({ title }) => title)
    ],
    title: `${scenario.source.title} / ${scenario.title}`,
    type: 'article'
  }
}

export async function resolveContentSocialMetadata(
  social: ContentSocialMetadata,
  parent: ResolvingMetadata,
  options: ResolveContentSocialMetadataOptions = {}
): Promise<Metadata> {
  const images =
    options.includeImages === false
      ? undefined
      : social.image
        ? [
            {
              url: new URL(social.image.detailSrc, siteUrl),
              width: social.image.width,
              height: social.image.height,
              alt: social.image.alt,
              type: 'image/webp'
            }
          ]
        : (await parent).openGraph?.images

  const metadata: Metadata = {
    title: { absolute: social.title },
    description: social.description,
    alternates: { canonical: social.canonical },
    openGraph: {
      type: social.type,
      title: social.title,
      description: social.description,
      url: social.canonical,
      siteName,
      locale: 'en_US',
      ...(images ? { images } : undefined)
    }
  }

  if (social.keywords) metadata.keywords = [...social.keywords]

  return metadata
}

export function toSocialSentenceFragment(value: string) {
  return value.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const letters = word.match(/\p{L}/gu)?.join('') ?? ''
    const isAcronym =
      letters.length > 1 && letters === letters.toLocaleUpperCase('en-US')

    return isAcronym ? word : word.toLocaleLowerCase('en-US')
  })
}

export function getLeadingSourceCredit(description: string | null) {
  return description?.match(leadingSourceCreditPattern)?.[1] ?? null
}

function getRiskFamilyDescription(name: string) {
  return name.endsWith('s')
    ? `Examples of AI risks involving ${name} in popular TV shows and movies.`
    : `Examples of ${name} AI risks from popular TV shows and movies.`
}
