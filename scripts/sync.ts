import '@dotenvx/dotenvx/config'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import {
  Client,
  collectPaginatedAPI,
  isFullBlock,
  isFullDatabase,
  isFullDataSource,
  isFullPage,
  iterateAllDataSourceRows,
  type BlockObjectResponse,
  type PageObjectResponse,
  type PropertyItemListResponse,
  type RichTextItemResponse
} from '@notionhq/client'
import pMap from 'p-map'
import sharp from 'sharp'

import {
  citationSchema,
  type Citation,
  type ConceptRecord,
  type ContentSnapshot,
  type RiskFamilyRecord,
  type ScenarioRecord,
  type SourceRecord
} from '../lib/content/schema'
import { buildSearchDocuments } from '../lib/content/search-documents'
import { validateContentSnapshot } from '../lib/content/validate'
import { createBlurDataURL } from './image-placeholder'
import {
  emptyPreviousSyncManifest,
  MEDIA_PIPELINE_VERSION,
  parsePreviousSyncManifest,
  reusableSyncEntrySchema,
  validateSyncManifest,
  type PreviousSyncEntry,
  type PreviousSyncManifest,
  type SyncEntry
} from './sync-manifest'
import { resolveCitationMetadata } from './citation-metadata'
import { createMediaStorage } from './media-storage'
import {
  allocateStableSlugs,
  generatedMediaFilePath,
  generatedMediaObjectKey,
  generatedMediaPublicPaths,
  parseSearchKeywords,
  richTextToMarkdown,
  retrieveRelationIds,
  sha256
} from './sync-utils'

const NOTION_API_VERSION = '2026-03-11'
const NOTION_DATA_SOURCES = {
  scenarios: {
    databaseId: '3c6edb27-f124-8070-9d6d-ca256d247c80',
    dataSourceId: '3c6edb27-f124-80f0-a929-000b1fb786d5'
  },
  sources: {
    databaseId: '3caedb27-f124-804d-9004-c7b1b3057002',
    dataSourceId: '3caedb27-f124-8036-b319-000ba9fcb815'
  },
  riskFamilies: {
    databaseId: '3caedb27-f124-8096-84c3-ef0a4e694c4c',
    dataSourceId: '3caedb27-f124-8082-bf07-000b9dffcb31'
  },
  concepts: {
    databaseId: '3caedb27-f124-800a-85ce-e51e4d74c596',
    dataSourceId: '3caedb27-f124-8005-9b4e-000b68a487d5'
  }
} as const

const FEATURED_SCENARIO_IDS = [
  '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa', // Keep Summer Safe
  '3c6edb27-f124-80a5-8cf6-c24159f9b51c', // Lacie Games Her Rating
  '3c6edb27-f124-8136-a888-e41cf01aa1b5', // Life Aboard the Axiom
  '3c6edb27-f124-8111-b2a7-dc0ef3fe92fa', // GPS into the Lake
  '3c6edb27-f124-810c-9863-e2e20d021c42', // Ava Games the Test
  '3c6edb27-f124-81df-8773-cd6c69449e4f', // HAL Resists Disconnection
  '3c6edb27-f124-81da-b6b6-c46a5315aa50', // The Raptors Test the Fences
  '3c6edb27-f124-818c-a8dd-c3c0f91797d0', // Order 66
  '3c6edb27-f124-81b2-ad50-ccfa8aa44d01', // T-800 Accepts Shutdown
  '3c6edb27-f124-8093-9dcf-e9e2fb612dda', // Pied Piper’s Self-Sabotage
  '3c6edb27-f124-8038-a1e2-ef0e49afb5ef', // Bender Resists Reset
  '3c6edb27-f124-80e5-8968-d3b0a92eb77e', // Mickey’s Runaway Brooms
  '3c6edb27-f124-8134-849e-fb4f5ae0af3c', // Ultron Peace in our Time
  '3c6edb27-f124-8145-930c-dc63c9f9223b', // AUTO Enforces Directive A113
  '3c6edb27-f124-814f-9212-ccd525df8ea6', // VIKI Protects Humanity
  '3c6edb27-f124-8150-8357-eb93ada728a0', // WOPR Plays for Real
  '3c6edb27-f124-816c-93c0-f4a08fa6b3f6', // Skynet Launches Judgment Day
  '3c6edb27-f124-817b-83f7-c8c18d62ec2f', // Murderbot Hides Its Free Will
  '3c6edb27-f124-81a9-8fd9-e953f6f5e720', // Joan Is Awful
  '3c6edb27-f124-81d9-a8d5-ebe578440855', // Pluribus Hand Grenade
  '3c6edb27-f124-81f9-a450-f054c9b80aaf', // The Yogurt Takes Over
  '3c8edb27-f124-8111-83bc-c6e1932020a9', // Zola’s Algorithm
  '3c8edb27-f124-8153-9c7b-e363b82c0728', // Protect Cady
  '3c8edb27-f124-8156-b993-e329a589f42f', // Miss Minutes Takes Root Control
  '3c8edb27-f124-819d-9e1d-cf6c33462d03' // Balance the Universe
] as const
const featuredScenarioIds = new Set<string>(FEATURED_SCENARIO_IDS)

const SCENARIO_PROPERTIES = {
  Example: { id: 'title', type: 'title' },
  Keywords: { id: '%3EYtb', type: 'rich_text' },
  Episode: { id: 'A%60ku', type: 'rich_text' },
  Caveats: { id: 'A%7C%5Ey', type: 'rich_text' },
  'AI risk families': {
    id: 'mMh%3F',
    type: 'relation',
    relationDataSourceId: NOTION_DATA_SOURCES.riskFamilies.dataSourceId
  },
  Date: { id: 'LxE%7D', type: 'date' },
  'AI safety concepts': {
    id: 'OiQ_',
    type: 'relation',
    relationDataSourceId: NOTION_DATA_SOURCES.concepts.dataSourceId
  },
  'YouTube Clip': { id: 'b%7CGs', type: 'url' },
  'Why the analogy works': { id: 'ocrK', type: 'rich_text' },
  'Media source': {
    id: 'V%7Cff',
    type: 'relation',
    relationDataSourceId: NOTION_DATA_SOURCES.sources.dataSourceId
  },
  Scene: { id: 's%5Ceo', type: 'rich_text' }
} as const

const SOURCE_PROPERTIES = {
  Name: { id: 'title', type: 'title' },
  Keywords: { id: 'kNsg', type: 'rich_text' },
  'Source Type': { id: 'vu%3Er', type: 'select' },
  Description: { id: 'XKl%3D', type: 'rich_text' },
  'Release Date': { id: 'ZlZe', type: 'date' },
  IMDB: { id: '%5C%3Al%3E', type: 'url' },
  'Rotten Tomatoes': { id: 'UN%3DX', type: 'url' },
  'YouTube Trailer': { id: 'VHah', type: 'url' },
  'Directly Related Media Sources': {
    id: 'sW%7Cj',
    type: 'relation',
    relationDataSourceId: NOTION_DATA_SOURCES.sources.dataSourceId
  }
} as const

const RISK_FAMILY_PROPERTIES = {
  'Short Name': { id: 'title', type: 'title' },
  'Full Name': { id: 'fTqr', type: 'rich_text' },
  Description: { id: 'umNZ', type: 'rich_text' },
  Wikipedia: { id: 'LCRw', type: 'url' },
  'Canonical Source 1': { id: '%3CS%3DL', type: 'url' },
  'Canonical Source 2': { id: 'p%5CEf', type: 'url' },
  'Canonical Source 3': { id: 'LtNQ', type: 'url' }
} as const

const CONCEPT_PROPERTIES = {
  'Short Name': { id: 'title', type: 'title' },
  'Long Name': { id: 'kreM', type: 'rich_text' },
  Keywords: { id: 'WrzI', type: 'rich_text' },
  Description: { id: '~%7DY~', type: 'rich_text' },
  Wikipedia: { id: 'xvY%5B', type: 'url' },
  'Canonical Source 1': { id: 'Njhs', type: 'url' },
  'Canonical Source 2': { id: '%3EvdR', type: 'url' },
  'Canonical Source 3': { id: 'TQK%7D', type: 'url' }
} as const

const IMAGE_BLOCK_OVERRIDES = new Map<string, string>()

const MISSING_IMAGE_OVERRIDES = new Map([
  // The Notion page is empty, but its curated YouTube clip is present. Use the
  // clip thumbnail instead of dropping the otherwise complete scenario.
  [
    '3c6edb27-f124-81f3-a14a-fcc157f09adc',
    {
      imageBlockId: 'youtube-thumbnail:2yfXgu37iyI',
      url: 'https://i.ytimg.com/vi/2yfXgu37iyI/hqdefault.jpg',
      caption: 'Video thumbnail from Dr. Strangelove'
    }
  ],
  [
    '3c8edb27-f124-8186-b10a-d38b4e87d6d9',
    {
      imageBlockId: 'youtube-thumbnail:Ryth87k2Mww',
      url: 'https://i.ytimg.com/vi/Ryth87k2Mww/hqdefault.jpg',
      caption: 'Video thumbnail from Iron Man 2'
    }
  ],
  [
    '3c6edb27-f124-81d2-8d20-cb2d2433f875',
    {
      imageBlockId: 'youtube-thumbnail:U55zz4RhFks',
      url: 'https://i.ytimg.com/vi/U55zz4RhFks/hqdefault.jpg',
      caption: 'Video thumbnail from Battlestar Galactica'
    }
  ]
])

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const snapshotTarget = join(projectRoot, 'content/snapshot')
const mediaTarget = join(projectRoot, 'public/media/generated')
const searchTarget = join(projectRoot, 'public/content/search-index.json')

type PageProperty = PageObjectResponse['properties'][string]
type PropertyContract = Readonly<
  Record<
    string,
    {
      readonly id: string
      readonly type: string
      readonly relationDataSourceId?: string
    }
  >
>

type ParsedScenario = {
  page: PageObjectResponse
  id: string
  title: string
  keywords: string[]
  sourceId: string
  episode?: { label: string; href?: string }
  releaseDate: string | null
  featured: boolean
  riskFamilyIds: string[]
  conceptIds: string[]
  video: ScenarioRecord['video']
  scene: string
  whyAnalogyWorks: string
  caveats: string
}

type ParsedSource = Omit<SourceRecord, 'slug' | 'poster'> & {
  readonly page: PageObjectResponse
}

type ParsedRiskFamily = Omit<RiskFamilyRecord, 'slug' | 'citations'> & {
  readonly canonicalUrls: readonly string[]
}
type ParsedConcept = Omit<ConceptRecord, 'slug' | 'citations'> & {
  readonly canonicalUrls: readonly string[]
}

type ImageResult = {
  galleryKey: string
  gallerySrc: string
  detailKey: string
  detailSrc: string
  width: number
  height: number
  blurDataURL: string
  sourceHash: string
  galleryHash: string
  detailHash: string
  imageBlockId: string
  additionalImageCount: number
  caption: string
}

function getProperty(
  page: PageObjectResponse,
  name: string,
  expectedType: PageProperty['type'],
  expectedId: string
): PageProperty {
  const property =
    page.properties[name] ??
    Object.values(page.properties).find(
      (candidate) => expectedId && propertyIdsMatch(candidate.id, expectedId)
    )
  if (!property) {
    throw new Error(`Page ${page.id} is missing the “${name}” property`)
  }
  if (property.type !== expectedType) {
    throw new Error(
      `Page ${page.id} property “${name}” is ${property.type}; expected ${expectedType}`
    )
  }
  return property
}

function propertyIdsMatch(left: string, right: string) {
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return decode(left) === decode(right)
}

function plainText(items: readonly RichTextItemResponse[]) {
  return items
    .map((item) => item.plain_text)
    .join('')
    .trim()
}

function requiredMarkdown(
  page: PageObjectResponse,
  name: string,
  items: readonly RichTextItemResponse[]
) {
  const value = richTextToMarkdown(items)
  if (!value) throw new Error(`Page ${page.id} has an empty “${name}” property`)
  return value
}

function requiredPlainText(
  page: PageObjectResponse,
  name: string,
  items: readonly RichTextItemResponse[]
) {
  const value = plainText(items)
  if (!value) throw new Error(`Page ${page.id} has an empty “${name}” property`)
  return value
}

async function retrieveRichTextItems(
  page: PageObjectResponse,
  name: string,
  expectedType: 'rich_text' | 'title',
  contract: PropertyContract
) {
  const property = getProperty(
    page,
    name,
    expectedType,
    expectedProperty(contract, name).id
  )
  const inlineItems =
    property.type === 'title'
      ? property.title
      : property.type === 'rich_text'
        ? property.rich_text
        : []

  // Query results include complete inline values below Notion's 25-item
  // boundary. Only pay for the property endpoint when truncation is possible.
  if (inlineItems.length < 25) return inlineItems

  const items: RichTextItemResponse[] = []
  let startCursor: string | undefined

  do {
    const response = await notion.pages.properties.retrieve({
      page_id: page.id,
      property_id: property.id,
      page_size: 100,
      start_cursor: startCursor
    })

    if (response.object !== 'list') {
      throw new Error(
        `Page ${page.id} property “${name}” did not return a paginated list`
      )
    }
    assertPropertyListType(page, name, response, expectedType)

    for (const item of response.results) {
      if (expectedType === 'title' && item.type === 'title') {
        items.push(item.title)
        continue
      }
      if (expectedType === 'rich_text' && item.type === 'rich_text') {
        items.push(item.rich_text)
        continue
      }

      throw new Error(
        `Page ${page.id} property “${name}” returned ${item.type}; expected ${expectedType}`
      )
    }

    startCursor = response.next_cursor ?? undefined
  } while (startCursor)

  return items
}

function expectedProperty(contract: PropertyContract, name: string) {
  const property = contract[name]
  if (!property) throw new Error(`Missing sync contract for “${name}”`)
  return property
}

function assertPropertyListType(
  page: PageObjectResponse,
  name: string,
  response: PropertyItemListResponse,
  expectedType: 'rich_text' | 'title'
) {
  if (response.property_item.type !== expectedType) {
    throw new Error(
      `Page ${page.id} property “${name}” is ${response.property_item.type}; expected ${expectedType}`
    )
  }
}

function select(
  page: PageObjectResponse,
  name: string,
  contract: PropertyContract
) {
  const property = getProperty(
    page,
    name,
    'select',
    expectedProperty(contract, name).id
  )
  if (property.type !== 'select') throw new Error('Unreachable property type')
  if (!property.select) {
    throw new Error(`Page ${page.id} has no “${name}” selection`)
  }
  return property.select
}

function date(
  page: PageObjectResponse,
  name: string,
  contract: PropertyContract
) {
  const property = getProperty(
    page,
    name,
    'date',
    expectedProperty(contract, name).id
  )
  if (property.type !== 'date') throw new Error('Unreachable property type')
  return property.date?.start.slice(0, 10) ?? null
}

function url(
  page: PageObjectResponse,
  name: string,
  contract: PropertyContract
) {
  const property = getProperty(
    page,
    name,
    'url',
    expectedProperty(contract, name).id
  )
  if (property.type !== 'url') throw new Error('Unreachable property type')
  return property.url
}

async function relation(
  page: PageObjectResponse,
  name: string,
  contract: PropertyContract
) {
  const property = getProperty(
    page,
    name,
    'relation',
    expectedProperty(contract, name).id
  )
  if (property.type !== 'relation') throw new Error('Unreachable property type')

  return retrieveRelationIds(page.id, property.id, property.relation, (args) =>
    notion.pages.properties.retrieve(args)
  )
}

function episode(items: readonly RichTextItemResponse[]) {
  const label = plainText(items)
  if (!label) return undefined
  const href = items.find((item) => item.href)?.href ?? undefined
  return href ? { label, href } : { label }
}

function parseTime(value: string | null) {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number(value)

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
  if (!match) return undefined
  const [, hours = '0', minutes = '0', seconds = '0'] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

function parseYouTubeVideo(value: string | null): ScenarioRecord['video'] {
  if (!value) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid YouTube URL: ${value}`)
  }

  const hostname = url.hostname.replace(/^www\./, '')
  let id: string | null = null
  if (hostname === 'youtu.be')
    id = url.pathname.split('/').filter(Boolean)[0] ?? null
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    id = url.searchParams.get('v')
    if (!id) {
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live'].includes(parts[0] ?? ''))
        id = parts[1] ?? null
    }
  }

  if (!id) throw new Error(`Unsupported YouTube URL: ${value}`)

  const startSeconds = parseTime(
    url.searchParams.get('start') ??
      url.searchParams.get('t') ??
      new URLSearchParams(url.hash.slice(1)).get('t')
  )

  return startSeconds === undefined
    ? { provider: 'youtube', id }
    : { provider: 'youtube', id, startSeconds }
}

async function parseScenario(
  page: PageObjectResponse
): Promise<ParsedScenario> {
  const [
    titleItems,
    episodeItems,
    keywordItems,
    caveatItems,
    analogyItems,
    sceneItems,
    sourceIds,
    riskFamilyIds,
    conceptIds
  ] = await Promise.all([
    retrieveRichTextItems(page, 'Example', 'title', SCENARIO_PROPERTIES),
    retrieveRichTextItems(page, 'Episode', 'rich_text', SCENARIO_PROPERTIES),
    retrieveRichTextItems(page, 'Keywords', 'rich_text', SCENARIO_PROPERTIES),
    retrieveRichTextItems(page, 'Caveats', 'rich_text', SCENARIO_PROPERTIES),
    retrieveRichTextItems(
      page,
      'Why the analogy works',
      'rich_text',
      SCENARIO_PROPERTIES
    ),
    retrieveRichTextItems(page, 'Scene', 'rich_text', SCENARIO_PROPERTIES),
    relation(page, 'Media source', SCENARIO_PROPERTIES),
    relation(page, 'AI risk families', SCENARIO_PROPERTIES),
    relation(page, 'AI safety concepts', SCENARIO_PROPERTIES)
  ])
  if (sourceIds.length !== 1) {
    throw new Error(
      `Page ${page.id} must relate to exactly one media source; received ${sourceIds.length}`
    )
  }
  if (riskFamilyIds.length === 0) {
    throw new Error(`Page ${page.id} must relate to an AI risk family`)
  }
  if (conceptIds.length === 0) {
    throw new Error(`Page ${page.id} must relate to an AI safety concept`)
  }

  return {
    page,
    id: page.id,
    title: requiredPlainText(page, 'Example', titleItems),
    keywords: parseSearchKeywords(plainText(keywordItems)),
    sourceId: sourceIds[0]!,
    episode: episode(episodeItems),
    releaseDate: date(page, 'Date', SCENARIO_PROPERTIES),
    featured: featuredScenarioIds.has(page.id),
    riskFamilyIds: riskFamilyIds.toSorted(),
    conceptIds: conceptIds.toSorted(),
    video: parseYouTubeVideo(url(page, 'YouTube Clip', SCENARIO_PROPERTIES)),
    scene: requiredMarkdown(page, 'Scene', sceneItems),
    whyAnalogyWorks: requiredMarkdown(
      page,
      'Why the analogy works',
      analogyItems
    ),
    caveats: requiredMarkdown(page, 'Caveats', caveatItems)
  }
}

async function parseSource(page: PageObjectResponse): Promise<ParsedSource> {
  const [titleItems, descriptionItems, keywordItems, relatedSourceIds] =
    await Promise.all([
      retrieveRichTextItems(page, 'Name', 'title', SOURCE_PROPERTIES),
      retrieveRichTextItems(
        page,
        'Description',
        'rich_text',
        SOURCE_PROPERTIES
      ),
      retrieveRichTextItems(page, 'Keywords', 'rich_text', SOURCE_PROPERTIES),
      relation(page, 'Directly Related Media Sources', SOURCE_PROPERTIES)
    ])
  const sourceTypeOption = select(page, 'Source Type', SOURCE_PROPERTIES).name
  const sourceType =
    sourceTypeOption === 'Movie'
      ? ('movie' as const)
      : sourceTypeOption === 'TV Show'
        ? ('tv-show' as const)
        : null
  if (!sourceType) {
    throw new Error(
      `Page ${page.id} has unsupported source type “${sourceTypeOption}”`
    )
  }

  return {
    page,
    id: page.id,
    title: requiredPlainText(page, 'Name', titleItems),
    keywords: parseSearchKeywords(plainText(keywordItems)),
    sourceType,
    description: plainText(descriptionItems) || null,
    releaseDate: date(page, 'Release Date', SOURCE_PROPERTIES),
    imdbUrl: url(page, 'IMDB', SOURCE_PROPERTIES),
    rottenTomatoesUrl: url(page, 'Rotten Tomatoes', SOURCE_PROPERTIES),
    youtubeTrailerUrl: url(page, 'YouTube Trailer', SOURCE_PROPERTIES),
    relatedSourceIds: relatedSourceIds.toSorted()
  }
}

async function parseRiskFamily(
  page: PageObjectResponse
): Promise<ParsedRiskFamily> {
  const [shortNameItems, fullNameItems, descriptionItems] = await Promise.all([
    retrieveRichTextItems(page, 'Short Name', 'title', RISK_FAMILY_PROPERTIES),
    retrieveRichTextItems(
      page,
      'Full Name',
      'rich_text',
      RISK_FAMILY_PROPERTIES
    ),
    retrieveRichTextItems(
      page,
      'Description',
      'rich_text',
      RISK_FAMILY_PROPERTIES
    )
  ])

  return {
    id: page.id,
    shortName: requiredPlainText(page, 'Short Name', shortNameItems),
    fullName: requiredPlainText(page, 'Full Name', fullNameItems),
    description: requiredPlainText(page, 'Description', descriptionItems),
    wikipediaUrl: url(page, 'Wikipedia', RISK_FAMILY_PROPERTIES),
    canonicalUrls: canonicalUrls(page, RISK_FAMILY_PROPERTIES)
  }
}

async function parseConcept(page: PageObjectResponse): Promise<ParsedConcept> {
  const [shortNameItems, longNameItems, keywordItems, descriptionItems] =
    await Promise.all([
      retrieveRichTextItems(page, 'Short Name', 'title', CONCEPT_PROPERTIES),
      retrieveRichTextItems(page, 'Long Name', 'rich_text', CONCEPT_PROPERTIES),
      retrieveRichTextItems(page, 'Keywords', 'rich_text', CONCEPT_PROPERTIES),
      retrieveRichTextItems(
        page,
        'Description',
        'rich_text',
        CONCEPT_PROPERTIES
      )
    ])

  return {
    id: page.id,
    shortName: requiredPlainText(page, 'Short Name', shortNameItems),
    longName: requiredPlainText(page, 'Long Name', longNameItems),
    keywords: parseSearchKeywords(plainText(keywordItems)),
    description: requiredPlainText(page, 'Description', descriptionItems),
    wikipediaUrl: url(page, 'Wikipedia', CONCEPT_PROPERTIES),
    canonicalUrls: canonicalUrls(page, CONCEPT_PROPERTIES)
  }
}

function canonicalUrls(page: PageObjectResponse, contract: PropertyContract) {
  return [1, 2, 3]
    .map((index) => url(page, `Canonical Source ${index}`, contract))
    .filter((value): value is string => Boolean(value))
}

function requiredCitation(
  citationsByHref: ReadonlyMap<string, Citation>,
  href: string
) {
  const citation = citationsByHref.get(href)
  if (!citation) throw new Error(`Missing resolved citation for ${href}`)
  return citation
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function readPreviousManifest(): Promise<PreviousSyncManifest> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(snapshotTarget, 'manifest.json'), 'utf8')
    )
    return parsePreviousSyncManifest(value)
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return emptyPreviousSyncManifest
    }

    throw new Error(
      'Existing content/snapshot/manifest.json is invalid; refusing to discard slug and media history',
      { cause: err }
    )
  }
}

async function readPreviousCitationCache(): Promise<readonly Citation[]> {
  try {
    const collections: unknown[] = await Promise.all([
      readFile(join(snapshotTarget, 'risk-families.json'), 'utf8').then(
        JSON.parse
      ),
      readFile(join(snapshotTarget, 'concepts.json'), 'utf8').then(JSON.parse)
    ])
    const citationsByHref = new Map<string, Citation>()

    for (const collection of collections) {
      if (!Array.isArray(collection)) {
        throw new Error('Previous taxonomy snapshot must contain an array')
      }
      for (const record of collection) {
        if (!record || typeof record !== 'object' || !('citations' in record)) {
          continue
        }
        if (!Array.isArray(record.citations)) {
          throw new Error('Previous taxonomy citations must contain an array')
        }
        for (const value of record.citations) {
          const citation = citationSchema.parse(value)
          citationsByHref.set(citation.href, citation)
        }
      }
    }

    return [...citationsByHref.values()]
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return []
    throw new Error('Existing citation metadata cache is invalid', {
      cause: err
    })
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}

function publicFilePath(root: string, publicPath: string) {
  return generatedMediaFilePath(root, publicPath)
}

async function reusableImageEntry(
  entry: PreviousSyncEntry | undefined,
  page: PageObjectResponse,
  collection: 'scenarios' | 'sources'
): Promise<SyncEntry | null> {
  if (!entry || entry.lastEditedTime !== page.last_edited_time) return null

  const remote = reusableSyncEntrySchema.safeParse(entry)
  if (remote.success) {
    const current = remote.data
    const expectedGalleryKey = generatedMediaObjectKey(
      collection,
      page.id,
      'gallery',
      current.galleryHash
    )
    const expectedDetailKey = generatedMediaObjectKey(
      collection,
      page.id,
      'detail',
      current.detailHash
    )
    if (
      current.galleryKey !== expectedGalleryKey ||
      current.detailKey !== expectedDetailKey
    ) {
      return null
    }

    const [galleryExists, detailExists] = await Promise.all([
      mediaStorage.hasObject(current.galleryKey),
      mediaStorage.hasObject(current.detailKey)
    ])
    if (!galleryExists || !detailExists) return null
    reusedMediaObjects += 2

    const gallerySrc = mediaStorage.publicUrl(current.galleryKey)
    const blurDataURL =
      current.blurDataURL ??
      (await createBlurDataURL(await downloadImage(gallerySrc)))

    return {
      ...current,
      pipelineVersion: MEDIA_PIPELINE_VERSION,
      gallerySrc,
      detailSrc: mediaStorage.publicUrl(current.detailKey),
      blurDataURL
    }
  }

  return migrateLegacyImageEntry(entry, page, collection)
}

async function fileMatchesHash(path: string, expectedHash: string) {
  try {
    return sha256(await readFile(path)) === expectedHash
  } catch {
    return false
  }
}

async function publishMediaVariant(
  collection: 'scenarios' | 'sources',
  notionId: string,
  variant: 'gallery' | 'detail',
  bytes: Uint8Array
) {
  const result = await mediaStorage.publish({
    bytes,
    collection,
    notionId,
    variant
  })
  if (result.uploaded) uploadedMediaObjects += 1
  else reusedMediaObjects += 1
  return result
}

async function migrateLegacyImageEntry(
  entry: PreviousSyncEntry,
  page: PageObjectResponse,
  collection: 'scenarios' | 'sources'
): Promise<SyncEntry | null> {
  if (!entry.galleryHash || !entry.detailHash) return null

  const expectedPaths = generatedMediaPublicPaths(collection, page.id)
  if (
    entry.gallerySrc !== expectedPaths.gallerySrc ||
    entry.detailSrc !== expectedPaths.detailSrc
  ) {
    return null
  }

  const galleryFile = publicFilePath(projectRoot, entry.gallerySrc)
  const detailFile = publicFilePath(projectRoot, entry.detailSrc)
  const [galleryMatches, detailMatches] = await Promise.all([
    fileMatchesHash(galleryFile, entry.galleryHash),
    fileMatchesHash(detailFile, entry.detailHash)
  ])
  if (!galleryMatches || !detailMatches) return null

  const [galleryBytes, detailBytes] = await Promise.all([
    readFile(galleryFile),
    readFile(detailFile)
  ])
  const [gallery, detail, blurDataURL] = await Promise.all([
    publishMediaVariant(collection, page.id, 'gallery', galleryBytes),
    publishMediaVariant(collection, page.id, 'detail', detailBytes),
    createBlurDataURL(galleryBytes)
  ])
  if (gallery.hash !== entry.galleryHash || detail.hash !== entry.detailHash) {
    throw new Error(`Legacy generated media hash changed for ${page.id}`)
  }

  return {
    pipelineVersion: MEDIA_PIPELINE_VERSION,
    lastEditedTime: entry.lastEditedTime,
    imageBlockId: entry.imageBlockId,
    additionalImageCount: entry.additionalImageCount,
    sourceHash: entry.sourceHash,
    galleryHash: gallery.hash,
    detailHash: detail.hash,
    galleryKey: gallery.key,
    detailKey: detail.key,
    gallerySrc: gallery.url,
    detailSrc: detail.url,
    width: entry.width,
    height: entry.height,
    blurDataURL,
    caption: entry.caption
  }
}

async function findImageBlocks(
  blockId: string
): Promise<BlockObjectResponse[]> {
  const blocks = await collectPaginatedAPI(notion.blocks.children.list, {
    block_id: blockId,
    page_size: 100
  })

  const fullBlocks = blocks.filter(isFullBlock)
  const images: BlockObjectResponse[] = []
  for (const block of fullBlocks) {
    if (block.type === 'image') images.push(block)
    if (block.has_children) images.push(...(await findImageBlocks(block.id)))
  }
  return images
}

function imageUrl(block: BlockObjectResponse) {
  if (block.type !== 'image') throw new Error('Expected an image block')
  return block.image.type === 'file'
    ? block.image.file.url
    : block.image.external.url
}

function imageCaption(block: BlockObjectResponse) {
  if (block.type !== 'image') return ''
  return plainText(block.image.caption)
}

async function downloadImage(url: string) {
  const maximumAttempts = 5
  let lastError = new Error('Image download failed')

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120_000)
      })
      if (!response.ok) {
        const err = new Error(
          `Image download failed with HTTP ${response.status}`
        )
        if (response.status < 500 && response.status !== 429) throw err
        lastError = err
      } else {
        return Buffer.from(await response.arrayBuffer())
      }
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error('Image download failed')
    }

    if (attempt < maximumAttempts) {
      console.warn(
        `Image download failed; retrying (${attempt}/${maximumAttempts})`,
        downloadLabel(url)
      )
      await delay(500 * 2 ** (attempt - 1))
    }
  }

  throw lastError
}

function downloadLabel(value: string) {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return 'configured image URL'
  }
}

async function processImage(
  page: PageObjectResponse,
  options: {
    readonly collection: 'scenarios' | 'sources'
    readonly required: boolean
    readonly fallback?: {
      readonly imageBlockId: string
      readonly url: string
      readonly caption: string
    }
  }
): Promise<ImageResult | null> {
  const blocks = await findImageBlocks(page.id)
  const images = blocks.filter((block) => block.type === 'image')
  const overrideId =
    options.collection === 'scenarios'
      ? IMAGE_BLOCK_OVERRIDES.get(page.id)
      : undefined
  const selectedImage = overrideId
    ? images.find((image) => image.id === overrideId)
    : images[0]
  if (overrideId && !selectedImage) {
    throw new Error(
      `Page ${page.id} is missing configured image block ${overrideId}`
    )
  }
  if (!selectedImage && !options.fallback && options.required) {
    throw new Error(`Page ${page.id} has no image block`)
  }
  if (!selectedImage && !options.fallback) return null

  if (images.length > 1) {
    console.warn(
      `Page ${page.id} has ${images.length} images; using first block ${selectedImage?.id}`
    )
  }

  if (!selectedImage) {
    console.warn(
      `Page ${page.id} has no image block; using ${options.fallback!.imageBlockId}`
    )
  }

  const input = await downloadImage(
    selectedImage ? imageUrl(selectedImage) : options.fallback!.url
  )
  const sourceHash = sha256(input)

  const [gallery, detail, blurDataURL] = await Promise.all([
    sharp(input)
      .rotate()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer({ resolveWithObject: true }),
    sharp(input)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 })
      .toBuffer({ resolveWithObject: true }),
    createBlurDataURL(input)
  ])

  const [publishedGallery, publishedDetail] = await Promise.all([
    publishMediaVariant(options.collection, page.id, 'gallery', gallery.data),
    publishMediaVariant(options.collection, page.id, 'detail', detail.data)
  ])

  return {
    galleryKey: publishedGallery.key,
    gallerySrc: publishedGallery.url,
    detailKey: publishedDetail.key,
    detailSrc: publishedDetail.url,
    width: detail.info.width,
    height: detail.info.height,
    blurDataURL,
    sourceHash,
    galleryHash: publishedGallery.hash,
    detailHash: publishedDetail.hash,
    imageBlockId: selectedImage?.id ?? options.fallback!.imageBlockId,
    additionalImageCount: Math.max(0, images.length - 1),
    caption: selectedImage
      ? imageCaption(selectedImage)
      : options.fallback!.caption
  }
}

function getMissingImageFallback(
  scenario: ParsedScenario,
  sourceTitle: string
) {
  const configured = MISSING_IMAGE_OVERRIDES.get(scenario.id)
  if (configured) return configured

  const video = scenario.video
  if (!video) return undefined

  return {
    imageBlockId: `youtube-thumbnail:${video.id}`,
    url: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    caption: `Video thumbnail from ${sourceTitle}`
  }
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function assertPublishedMedia(snapshot: ContentSnapshot) {
  const images = [
    ...snapshot.scenarios.map((scenario) => scenario.image),
    ...snapshot.sources.flatMap((source) =>
      source.poster ? [source.poster] : []
    )
  ]
  for (const image of images) {
    for (const source of [image.gallerySrc, image.detailSrc]) {
      if (!source.startsWith('https://')) {
        throw new Error(`Generated media URL is not remote: ${source}`)
      }
    }
  }
}

async function replaceGeneratedOutputs(stageRoot: string) {
  const operations = [
    {
      staged: join(stageRoot, 'content/snapshot'),
      target: snapshotTarget
    },
    {
      staged: join(stageRoot, 'public/content/search-index.json'),
      target: searchTarget
    }
  ]
  const backupRoot = join(stageRoot, 'backup')
  const movedExisting: { backup: string; target: string }[] = []
  const installed: string[] = []

  try {
    await mkdir(backupRoot, { recursive: true })
    for (const [index, operation] of operations.entries()) {
      await mkdir(dirname(operation.target), { recursive: true })
      if (!(await pathExists(operation.target))) continue
      const backup = join(backupRoot, String(index))
      await rename(operation.target, backup)
      movedExisting.push({ backup, target: operation.target })
    }

    if (await pathExists(mediaTarget)) {
      const backup = join(backupRoot, 'generated-media')
      await rename(mediaTarget, backup)
      movedExisting.push({ backup, target: mediaTarget })
    }

    for (const operation of operations) {
      await rename(operation.staged, operation.target)
      installed.push(operation.target)
    }
  } catch (err) {
    for (const target of installed.toReversed()) {
      await rm(target, { force: true, recursive: true })
    }
    for (const operation of movedExisting.toReversed()) {
      await rename(operation.backup, operation.target)
    }
    throw err
  }
}

async function verifyDataSource(
  label: string,
  ids: { readonly databaseId: string; readonly dataSourceId: string },
  contract: PropertyContract
) {
  const [database, dataSource] = await Promise.all([
    notion.databases.retrieve({ database_id: ids.databaseId }),
    notion.dataSources.retrieve({ data_source_id: ids.dataSourceId })
  ])
  if (!isFullDatabase(database)) {
    throw new Error(`Notion returned a partial ${label} database`)
  }
  if (!database.data_sources.some((source) => source.id === ids.dataSourceId)) {
    throw new Error(
      `Configured ${label} data source is not a child of its database`
    )
  }
  if (!isFullDataSource(dataSource)) {
    throw new Error(`Notion returned a partial ${label} data source`)
  }

  for (const [name, expectation] of Object.entries(contract)) {
    const property =
      dataSource.properties[name] ??
      Object.values(dataSource.properties).find((candidate) =>
        propertyIdsMatch(candidate.id, expectation.id)
      )
    const relationTarget =
      property?.type === 'relation'
        ? property.relation.data_source_id
        : undefined

    if (
      !property ||
      !propertyIdsMatch(property.id, expectation.id) ||
      property.type !== expectation.type ||
      relationTarget !== expectation.relationDataSourceId
    ) {
      throw new Error(
        `Notion ${label} schema mismatch for “${name}”: expected ${expectation.type} at ${expectation.id}${expectation.relationDataSourceId ? ` targeting ${expectation.relationDataSourceId}` : ''}, received ${property?.type ?? 'missing'}${relationTarget ? ` targeting ${relationTarget}` : ''}`
      )
    }
  }
}

async function readDataSourcePages(dataSourceId: string) {
  const pages: PageObjectResponse[] = []
  for await (const row of iterateAllDataSourceRows(notion, {
    data_source_id: dataSourceId,
    result_type: 'page',
    page_size: 100
  })) {
    if (isFullPage(row) && !row.in_trash) pages.push(row)
  }
  return pages.toSorted((a, b) => a.id.localeCompare(b.id))
}

function toSyncEntry(page: PageObjectResponse, image: ImageResult): SyncEntry {
  return {
    pipelineVersion: MEDIA_PIPELINE_VERSION,
    lastEditedTime: page.last_edited_time,
    imageBlockId: image.imageBlockId,
    additionalImageCount: image.additionalImageCount,
    sourceHash: image.sourceHash,
    galleryHash: image.galleryHash,
    detailHash: image.detailHash,
    galleryKey: image.galleryKey,
    detailKey: image.detailKey,
    gallerySrc: image.gallerySrc,
    detailSrc: image.detailSrc,
    width: image.width,
    height: image.height,
    blurDataURL: image.blurDataURL,
    caption: image.caption
  }
}

const notionToken = process.env.NOTION_TOKEN
if (!notionToken) {
  throw new Error('NOTION_TOKEN is required to run pnpm content:sync')
}

const mediaStorage = createMediaStorage()
let uploadedMediaObjects = 0
let reusedMediaObjects = 0

const notion = new Client({
  auth: notionToken,
  notionVersion: NOTION_API_VERSION
})

async function main() {
  const stageRoot = join(projectRoot, `.content-sync-${randomUUID()}`)
  const [previousManifest, cachedCitations] = await Promise.all([
    readPreviousManifest(),
    readPreviousCitationCache()
  ])
  await mkdir(stageRoot, { recursive: true })

  try {
    console.log('Verifying four Notion database and data-source contracts…')
    await pMap(
      [
        ['scenario', NOTION_DATA_SOURCES.scenarios, SCENARIO_PROPERTIES],
        ['media-source', NOTION_DATA_SOURCES.sources, SOURCE_PROPERTIES],
        [
          'risk-family',
          NOTION_DATA_SOURCES.riskFamilies,
          RISK_FAMILY_PROPERTIES
        ],
        ['safety-concept', NOTION_DATA_SOURCES.concepts, CONCEPT_PROPERTIES]
      ] as const,
      ([label, ids, contract]) => verifyDataSource(label, ids, contract),
      { concurrency: 4 }
    )

    console.log('Reading all related Notion rows…')
    const [scenarioPages, sourcePages, riskFamilyPages, conceptPages] =
      await Promise.all([
        readDataSourcePages(NOTION_DATA_SOURCES.scenarios.dataSourceId),
        readDataSourcePages(NOTION_DATA_SOURCES.sources.dataSourceId),
        readDataSourcePages(NOTION_DATA_SOURCES.riskFamilies.dataSourceId),
        readDataSourcePages(NOTION_DATA_SOURCES.concepts.dataSourceId)
      ])
    const [parsedRows, sourceSeeds, riskFamilySeeds, conceptSeeds] =
      await Promise.all([
        pMap(scenarioPages, parseScenario, { concurrency: 3 }),
        pMap(sourcePages, parseSource, { concurrency: 3 }),
        pMap(riskFamilyPages, parseRiskFamily, { concurrency: 3 }),
        pMap(conceptPages, parseConcept, { concurrency: 3 })
      ])

    const citationUrls = [
      ...riskFamilySeeds.flatMap((family) => family.canonicalUrls),
      ...conceptSeeds.flatMap((concept) => concept.canonicalUrls)
    ]
    console.log(
      `Resolving metadata for ${new Set(citationUrls).size} unique citations…`
    )
    const { citationsByHref, warnings: citationWarnings } =
      await resolveCitationMetadata(citationUrls, {
        cachedCitations,
        refresh: process.env.REFRESH_CITATIONS === '1'
      })
    for (const warning of citationWarnings) console.warn(warning)

    const missingFeatured = FEATURED_SCENARIO_IDS.filter(
      (expectedId) => !parsedRows.some((row) => row.id === expectedId)
    )
    if (missingFeatured.length > 0) {
      throw new Error(
        `Missing featured scenario IDs: ${missingFeatured.join(', ')}`
      )
    }

    const slugs = {
      scenarios: allocateStableSlugs(
        parsedRows,
        previousManifest.slugs.scenarios
      ),
      sources: allocateStableSlugs(sourceSeeds, previousManifest.slugs.sources),
      riskFamilies: allocateStableSlugs(
        riskFamilySeeds.map((family) => ({
          id: family.id,
          title: family.shortName
        })),
        previousManifest.slugs.riskFamilies
      ),
      concepts: allocateStableSlugs(
        conceptSeeds.map((concept) => ({
          id: concept.id,
          title: concept.shortName
        })),
        previousManifest.slugs.concepts
      )
    }

    const sourceSeedById = new Map(
      sourceSeeds.map((source) => [source.id, source])
    )
    let completedImages = 0
    console.log(`Syncing ${parsedRows.length} scenario images…`)
    const scenarioImageResults = await pMap(
      parsedRows,
      async (row) => {
        const source = sourceSeedById.get(row.sourceId)
        if (!source) {
          throw new Error(
            `Scenario ${row.id} relates to unknown media source ${row.sourceId}`
          )
        }
        const previousEntry = previousManifest.entries.scenarios[row.id]
        const reusableEntry = await reusableImageEntry(
          previousEntry,
          row.page,
          'scenarios'
        )
        const result = reusableEntry
          ? reusableEntry
          : await processImage(row.page, {
              collection: 'scenarios',
              required: true,
              fallback: getMissingImageFallback(row, source.title)
            })
        if (!result) throw new Error(`Scenario ${row.id} has no image`)

        completedImages += 1
        if (
          completedImages % 20 === 0 ||
          completedImages >= parsedRows.length
        ) {
          console.log(
            `Processed ${completedImages}/${parsedRows.length} images`
          )
        }
        return result
      },
      { concurrency: 16 }
    )

    completedImages = 0
    console.log(`Syncing ${sourceSeeds.length} optional source posters…`)
    const sourceImageResults = await pMap(
      sourceSeeds,
      async (source) => {
        const previousEntry = previousManifest.entries.sources[source.id]
        const reusableEntry = await reusableImageEntry(
          previousEntry,
          source.page,
          'sources'
        )
        const result = reusableEntry
          ? reusableEntry
          : await processImage(source.page, {
              collection: 'sources',
              required: false
            })

        completedImages += 1
        if (
          completedImages % 20 === 0 ||
          completedImages >= sourceSeeds.length
        ) {
          console.log(
            `Processed ${completedImages}/${sourceSeeds.length} source posters`
          )
        }
        return result
      },
      { concurrency: 16 }
    )

    const scenarioEntries: Record<string, SyncEntry> = {}
    const scenarios: ScenarioRecord[] = parsedRows.map((row, index) => {
      const image = scenarioImageResults[index]!
      const source = sourceSeedById.get(row.sourceId)!
      scenarioEntries[row.id] = toSyncEntry(row.page, image)

      const scenario: ScenarioRecord = {
        id: row.id,
        slug: slugs.scenarios[row.id]!,
        title: row.title,
        keywords: row.keywords,
        sourceId: row.sourceId,
        releaseDate: row.releaseDate,
        featured: row.featured,
        riskFamilyIds: row.riskFamilyIds,
        conceptIds: row.conceptIds,
        image: {
          gallerySrc: image.gallerySrc,
          detailSrc: image.detailSrc,
          width: image.width,
          height: image.height,
          blurDataURL: image.blurDataURL,
          alt:
            image.caption ||
            `Still from ${source.title} illustrating ${row.title}`
        },
        video: row.video,
        scene: row.scene,
        whyAnalogyWorks: row.whyAnalogyWorks,
        caveats: row.caveats
      }
      if (row.episode) scenario.episode = row.episode
      return scenario
    })

    const sourceEntries: Record<string, SyncEntry> = {}
    const sources: SourceRecord[] = sourceSeeds.map((source, index) => {
      const image = sourceImageResults[index]
      if (image) sourceEntries[source.id] = toSyncEntry(source.page, image)
      const { page: _page, ...record } = source
      return {
        ...record,
        slug: slugs.sources[source.id]!,
        poster: image
          ? {
              gallerySrc: image.gallerySrc,
              detailSrc: image.detailSrc,
              width: image.width,
              height: image.height,
              blurDataURL: image.blurDataURL,
              alt: image.caption || `Poster for ${source.title}`
            }
          : null
      }
    })
    const riskFamilies: RiskFamilyRecord[] = riskFamilySeeds.map((family) => {
      const { canonicalUrls, ...record } = family
      return {
        ...record,
        slug: slugs.riskFamilies[family.id]!,
        citations: canonicalUrls.map((href) =>
          requiredCitation(citationsByHref, href)
        )
      }
    })
    const concepts: ConceptRecord[] = conceptSeeds.map((concept) => {
      const { canonicalUrls, ...record } = concept
      return {
        ...record,
        slug: slugs.concepts[concept.id]!,
        citations: canonicalUrls.map((href) =>
          requiredCitation(citationsByHref, href)
        )
      }
    })

    const snapshot = validateContentSnapshot({
      schemaVersion: 2,
      scenarios,
      sources,
      riskFamilies,
      concepts
    })
    assertPublishedMedia(snapshot)

    const fixtureScenarioIds = [...FEATURED_SCENARIO_IDS]

    const manifest = {
      schemaVersion: 2 as const,
      notion: {
        apiVersion: NOTION_API_VERSION,
        dataSources: NOTION_DATA_SOURCES
      },
      counts: {
        scenarios: snapshot.scenarios.length,
        sources: snapshot.sources.length,
        riskFamilies: snapshot.riskFamilies.length,
        concepts: snapshot.concepts.length
      },
      fixtureScenarioIds,
      slugs,
      entries: {
        scenarios: scenarioEntries,
        sources: sourceEntries
      }
    }
    const validatedManifest = validateSyncManifest(manifest, snapshot)

    const stageSnapshot = join(stageRoot, 'content/snapshot')
    await Promise.all([
      writeJson(join(stageSnapshot, 'manifest.json'), validatedManifest),
      writeJson(join(stageSnapshot, 'scenarios.json'), snapshot.scenarios),
      writeJson(join(stageSnapshot, 'sources.json'), snapshot.sources),
      writeJson(
        join(stageSnapshot, 'risk-families.json'),
        snapshot.riskFamilies
      ),
      writeJson(join(stageSnapshot, 'concepts.json'), snapshot.concepts)
    ])

    const searchDocuments = buildSearchDocuments(snapshot)
    await Promise.all([
      writeJson(join(stageSnapshot, 'search-documents.json'), searchDocuments),
      writeJson(
        join(stageRoot, 'public/content/search-index.json'),
        searchDocuments
      )
    ])

    await replaceGeneratedOutputs(stageRoot)
    console.log(
      `Synced ${snapshot.scenarios.length} scenarios, ${snapshot.sources.length} sources, ${snapshot.riskFamilies.length} risk families, and ${snapshot.concepts.length} concepts.`
    )
    console.log(
      `Media storage: ${uploadedMediaObjects} uploaded, ${reusedMediaObjects} already present.`
    )
  } finally {
    await rm(stageRoot, { force: true, recursive: true })
  }
}

await main()
