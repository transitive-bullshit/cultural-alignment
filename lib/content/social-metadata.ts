import type { Metadata, ResolvingMetadata } from 'next'

import { siteName, siteUrl } from '@/lib/site'

import type {
  ContentImage,
  MediaFormat,
  ResourcePage,
  ScenarioPage
} from './catalog'

/** Descriptions are one short sentence in the project's voice. */
export const SOCIAL_DESCRIPTION_MAX_LENGTH = 150

const MEDIA_FORMAT_LABELS = {
  tv: 'TV',
  movie: 'movies',
  anime: 'anime'
} as const satisfies Record<MediaFormat, string>

const SINGLE_MEDIA_FORMAT_PHRASES = {
  tv: 'on TV',
  movie: 'in movies',
  anime: 'in anime'
} as const satisfies Record<MediaFormat, string>

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
  switch (resource.kind) {
    case 'risk-family': {
      const title = /^AI\b/u.test(resource.detailTitle)
        ? resource.detailTitle
        : `AI ${resource.detailTitle}`

      return {
        canonical: resource.href,
        description: `Examples of ${toProsePhrase(title)} ${formatMediaFormats(resource.mediaFormats)}.`,
        title,
        type: 'website'
      }
    }
    case 'concept':
      return {
        canonical: resource.href,
        description: `Examples of ${toProsePhrase(resource.title)} ${formatMediaFormats(resource.mediaFormats)}.`,
        title: `${resource.title} in film and TV`,
        type: 'website'
      }
    case 'franchise':
      return {
        canonical: resource.href,
        description: `What can ${/^\p{Lu}{2,}$/u.test(resource.title) ? `the ${resource.title}` : resource.title} teach us about AI safety, risks, and alignment?`,
        image: resource.image,
        title: `${resource.title} franchise: AI safety lessons`,
        type: 'website'
      }
    case 'source':
      return {
        canonical: resource.href,
        description: describeSourceScenes(resource),
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
  const describe = (scene: string) =>
    concept
      ? `This scene from ${scene} is an example of the AI safety concept of ${toProsePhrase(concept)}.`
      : `This scene from ${scene} illustrates an AI safety concept.`
  const withContext = describe(
    withSceneContext(source, getSceneContext(scenario))
  )

  return {
    canonical: `/scenarios/${scenario.slug}`,
    // A long episode title gives way to a shorter description.
    description:
      withContext.length <= SOCIAL_DESCRIPTION_MAX_LENGTH
        ? withContext
        : describe(source),
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

/**
 * Writes a title-case taxonomy name into running prose: common nouns are
 * lowercased, acronyms keep their capitals, and eponymous names such as
 * “Goodhart’s Law” stay as authored.
 */
export function toProsePhrase(name: string) {
  if (/\p{L}[’']s\b/u.test(name)) return name

  return name
    .replaceAll(' & ', ' and ')
    .replace(/[\p{L}\p{N}]+/gu, (word) =>
      /^\p{Lu}{2,}$/u.test(word) ? word : word.toLocaleLowerCase('en-US')
    )
}

/** “across TV, movies, and anime”, or the single format a page draws on. */
export function formatMediaFormats(formats: readonly MediaFormat[]) {
  const [only] = formats
  if (!only) return 'across film and TV'
  if (formats.length === 1) return SINGLE_MEDIA_FORMAT_PHRASES[only]

  return `across ${formatList(formats.map((format) => MEDIA_FORMAT_LABELS[format]))}`
}

/** Where the scene sits: a movie's year, or a TV episode's season and number. */
export function getSceneContext(scenario: ScenarioPage) {
  if (scenario.source.sourceType === 'movie') {
    return scenario.releaseDate?.slice(0, 4) ?? null
  }

  const sourcePrefix = `${scenario.source.title} — `
  const rawLabel = scenario.episode?.label.trim() ?? ''
  const label = rawLabel.startsWith(sourcePrefix)
    ? rawLabel.slice(sourcePrefix.length)
    : rawLabel
  if (!label) return null

  const numbered = label.match(/\bS(\d+)\s?E(\d+)(?:\s?[–-]\s?(\d+))?/u)
  if (numbered) {
    const [, season, first, last] = numbered
    return last
      ? `Season ${season}, Episodes ${first}–${last}`
      : `Season ${season}, Episode ${first}`
  }

  return /^(?:Episode|Chapter|Part)\s+\d+$/iu.test(label)
    ? label
    : `“${label.replace(/^[“"]|[”"]$/gu, '')}”`
}

/** Adds context in parentheses, merging with a title's own, e.g. “(1981 TV series, Episode 4)”. */
function withSceneContext(source: string, context: string | null) {
  if (!context) return source

  return source.endsWith(')')
    ? `${source.slice(0, -1)}, ${context})`
    : `${source} (${context})`
}

function describeSourceScenes(
  resource: Extract<ResourcePage, { kind: 'source' }>
) {
  const concepts = resource.primaryConcepts
    .slice(0, 2)
    .map(({ title }) => toProsePhrase(title))
  const scenes =
    resource.scenarios.length === 1
      ? `A scene from ${resource.title} that illustrates`
      : `Scenes from ${resource.title} that illustrate`

  if (concepts.length === 0) return `${scenes} AI safety risks and alignment.`
  if (concepts.length === 1) {
    return `${scenes} the AI safety concept of ${concepts[0]}.`
  }

  return `${scenes} AI safety concepts, including ${formatList(concepts)}.`
}

function formatList(values: readonly string[]) {
  if (values.length <= 2) return values.join(' and ')

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
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
