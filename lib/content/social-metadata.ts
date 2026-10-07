import type { Metadata, ResolvingMetadata } from 'next'

import { siteName, siteUrl } from '@/lib/site'

import type { ContentImage, ResourcePage, ScenarioPage } from './catalog'

/** Descriptions stay one short sentence; longer authored sentences are cut. */
export const SOCIAL_DESCRIPTION_MAX_LENGTH = 150

// A sentence ends at terminal punctuation before a capitalized word, but not
// after an initial or a common title ("James T. Kirk", "Dr. Strange").
const SENTENCE_BOUNDARY =
  /(?<=[.!?…])(?<!(?:^|[\s(])\p{Lu}\.)(?<!\b(?:Dr|Mr|Mrs|Ms|St|Jr|Sr|vs)\.)\s+(?=["“‘(]?[A-Z0-9])/u

// Places where a long sentence can end early and still read as complete.
const CLAUSE_BOUNDARY =
  /;\s|\s[—–]\s|,\s(?=(?:as|while|where|which|forcing|leaving|until|after|before|when|only)\b)|\s(?=as (?:he|she|they|it|his|her|their|the)\b)/gu
const MIN_CLAUSE_LENGTH = 60

export type ContentSocialMetadata = Readonly<{
  canonical: string
  description: string
  image?: ContentImage | null
  keywords?: readonly string[]
  /** The page's own title; the root layout's template appends the site name. */
  title: string
  type: 'article' | 'website'
}>

type ResolveContentSocialMetadataOptions = Readonly<{
  includeImages?: boolean
}>

export function getResourceSocialMetadata(
  resource: ResourcePage
): ContentSocialMetadata {
  const description = summarizeDescription(resource.description)

  switch (resource.kind) {
    case 'risk-family':
      return {
        canonical: resource.href,
        description,
        title: /^AI\b/u.test(resource.detailTitle)
          ? resource.detailTitle
          : `AI ${resource.detailTitle}`,
        type: 'website'
      }
    case 'concept':
      return {
        canonical: resource.href,
        description,
        title: `${resource.title} in film and TV`,
        type: 'website'
      }
    case 'franchise':
      return {
        canonical: resource.href,
        description,
        image: resource.image,
        title: `${resource.title} franchise: AI safety lessons`,
        type: 'website'
      }
    case 'source':
      return {
        canonical: resource.href,
        description: description || `AI safety lessons from ${resource.title}.`,
        title: `AI safety lessons from ${resource.title}`,
        type: 'website'
      }
  }
}

export function getScenarioSocialMetadata(
  scenario: ScenarioPage
): ContentSocialMetadata {
  const source = scenario.source.title
  const concept = scenario.concepts[0]?.title

  return {
    canonical: `/scenarios/${scenario.slug}`,
    // The Dossier's own framing: the scene and its primary concept.
    description: concept
      ? `This scene from ${source} is an example of ${concept}.`
      : `A scene from ${source}.`,
    image: scenario.image,
    keywords: [
      ...scenario.franchises.map(({ title }) => title),
      source,
      ...scenario.riskFamilies.map(({ title }) => title),
      ...scenario.concepts.map(({ title }) => title)
    ],
    title: scenario.title.includes(source)
      ? scenario.title
      : `${scenario.title} (${source})`,
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

  // Open Graph and Twitter omit their own title and description, so Next.js
  // copies the resolved ones, including the site name the template appends.
  const metadata: Metadata = {
    title: social.title,
    description: social.description,
    alternates: { canonical: social.canonical },
    openGraph: {
      type: social.type,
      url: social.canonical,
      siteName,
      locale: 'en_US',
      ...(images ? { images } : undefined)
    }
  }

  if (social.keywords) metadata.keywords = [...social.keywords]

  return metadata
}

/**
 * The first sentence of authored copy. A sentence over the limit ends at its
 * last natural clause break, or else at a word boundary.
 */
export function summarizeDescription(copy: string | null) {
  const sentence = copy?.trim().split(SENTENCE_BOUNDARY)[0]?.trim() ?? ''
  if (sentence.length <= SOCIAL_DESCRIPTION_MAX_LENGTH) return sentence

  const clauseEnd = [...sentence.matchAll(CLAUSE_BOUNDARY)]
    .map(({ index }) => index)
    .filter(
      (index) =>
        index >= MIN_CLAUSE_LENGTH && index < SOCIAL_DESCRIPTION_MAX_LENGTH
    )
    .at(-1)

  return clauseEnd === undefined
    ? truncateAtWord(sentence, SOCIAL_DESCRIPTION_MAX_LENGTH)
    : `${sentence.slice(0, clauseEnd).replace(/[,;:]$/u, '')}.`
}

export function truncateAtWord(text: string, maxLength: number) {
  if (text.length <= maxLength) return text

  const clipped = text.slice(0, maxLength - 1)
  const wordEnd = clipped.lastIndexOf(' ')
  const words = wordEnd > 0 ? clipped.slice(0, wordEnd) : clipped

  return `${words.replace(/[\s,;:—–-]+$/u, '')}…`
}
