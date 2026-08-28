import { randomUUID } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
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
import { z } from 'zod'

import type {
  ConceptRecord,
  ContentSnapshot,
  RiskFamilyRecord,
  ScenarioRecord,
  SourceRecord
} from '../lib/content/schema'
import { buildSearchDocuments } from '../lib/content/search-documents'
import { validateContentSnapshot } from '../lib/content/validate'
import {
  allocateStableSlugs,
  generatedMediaFilePath,
  isGeneratedMediaPublicPath,
  richTextToMarkdown,
  sha256
} from './sync-utils'

const NOTION_API_VERSION = '2026-03-11'
const NOTION_DATABASE_ID = '3c6edb27-f124-8070-9d6d-ca256d247c80'
const NOTION_DATA_SOURCE_ID = '3c6edb27-f124-80f0-a929-000b1fb786d5'
// Bump this whenever image selection, resize, encoding, or output naming changes.
const MEDIA_PIPELINE_VERSION = 1

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

const EXPECTED_PROPERTIES = {
  Example: { id: 'title', type: 'title' },
  Episode: { id: 'A%60ku', type: 'rich_text' },
  Caveats: { id: 'A%7C%5Ey', type: 'rich_text' },
  'AI risk families': { id: 'Ld%3F%40', type: 'multi_select' },
  Date: { id: 'LxE%7D', type: 'date' },
  'AI safety concepts': { id: 'N%5D%5CT', type: 'multi_select' },
  'YouTube Clip': { id: 'b%7CGs', type: 'url' },
  'Why the analogy works': { id: 'ocrK', type: 'rich_text' },
  Media: { id: 'rhiQ', type: 'select' },
  Scene: { id: 's%5Ceo', type: 'rich_text' }
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

const RISK_FAMILY_DETAILS = {
  'malicious use': {
    title: 'Malicious use',
    description:
      'Risks created when people intentionally use capable AI systems to cause harm.'
  },
  'accidents/malfunctions': {
    title: 'Accidents / malfunctions',
    description:
      'Risks created by system failures, brittle behavior, and unintended operation.'
  },
  misalignment: {
    title: 'Misalignment',
    description:
      'Risks created when a system’s learned objectives or behavior diverge from human intent.'
  },
  'systemic/structural': {
    title: 'Systemic / structural',
    description:
      'Risks that emerge through institutions, incentives, concentration, and social systems.'
  },
  'security/governance': {
    title: 'Security / governance',
    description:
      'Risks shaped by control, oversight, access, deployment, and institutional coordination.'
  }
} satisfies Record<string, { title: string; description: string }>

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const snapshotTarget = join(projectRoot, 'content/snapshot')
const mediaTarget = join(projectRoot, 'public/media/generated')
const searchTarget = join(projectRoot, 'public/content/search-index.json')

type PageProperty = PageObjectResponse['properties'][string]
type SelectOption = { id: string; name: string; color: string }

type ParsedScenario = {
  page: PageObjectResponse
  id: string
  title: string
  source: SelectOption
  episode?: { label: string; href?: string }
  releaseDate: string | null
  featured: boolean
  riskFamilies: SelectOption[]
  concepts: SelectOption[]
  video: ScenarioRecord['video']
  scene: string
  whyAnalogyWorks: string
  caveats: string
}

type ImageResult = {
  gallerySrc: string
  detailSrc: string
  width: number
  height: number
  sourceHash: string
  galleryHash: string
  detailHash: string
  imageBlockId: string
  additionalImageCount: number
  caption: string
}

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const generatedMediaPathSchema = z
  .string()
  .refine(isGeneratedMediaPublicPath, 'Invalid generated media path')

const syncEntryBaseSchema = z.object({
  lastEditedTime: z.string(),
  imageBlockId: z.string(),
  additionalImageCount: z.number().int().nonnegative(),
  sourceHash: sha256Schema,
  gallerySrc: generatedMediaPathSchema,
  detailSrc: generatedMediaPathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string()
})

const previousSyncEntrySchema = syncEntryBaseSchema.extend({
  pipelineVersion: z.number().int().positive().optional(),
  galleryHash: sha256Schema.optional(),
  detailHash: sha256Schema.optional()
})

const syncEntrySchema = syncEntryBaseSchema.extend({
  pipelineVersion: z.literal(MEDIA_PIPELINE_VERSION),
  galleryHash: sha256Schema,
  detailHash: sha256Schema
})

const syncManifestSchema = z.object({
  schemaVersion: z.literal(1),
  slugs: z.object({
    scenarios: z.record(
      z.string().min(1),
      z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    ),
    sources: z.record(
      z.string().min(1),
      z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    ),
    riskFamilies: z.record(
      z.string().min(1),
      z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    ),
    concepts: z.record(
      z.string().min(1),
      z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    )
  }),
  entries: z.record(z.string(), previousSyncEntrySchema)
})

type SyncManifest = z.infer<typeof syncManifestSchema>
type SyncEntry = z.infer<typeof syncEntrySchema>
type PreviousSyncEntry = z.infer<typeof previousSyncEntrySchema>

const emptyManifest: SyncManifest = {
  schemaVersion: 1,
  slugs: {
    scenarios: {},
    sources: {},
    riskFamilies: {},
    concepts: {}
  },
  entries: {}
}

function getProperty(
  page: PageObjectResponse,
  name: string,
  expectedType: PageProperty['type']
): PageProperty {
  const expectedId =
    EXPECTED_PROPERTIES[name as keyof typeof EXPECTED_PROPERTIES]?.id
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

function title(
  page: PageObjectResponse,
  items: readonly RichTextItemResponse[]
) {
  const value = plainText(items)
  if (!value) throw new Error(`Page ${page.id} has no title`)
  return value
}

async function retrieveRichTextItems(
  page: PageObjectResponse,
  name: string,
  expectedType: 'rich_text' | 'title'
) {
  const property = getProperty(page, name, expectedType)
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

function select(page: PageObjectResponse, name: string) {
  const property = getProperty(page, name, 'select')
  if (property.type !== 'select') throw new Error('Unreachable property type')
  if (!property.select) {
    throw new Error(`Page ${page.id} has no “${name}” selection`)
  }
  return property.select
}

function multiSelect(page: PageObjectResponse, name: string) {
  const property = getProperty(page, name, 'multi_select')
  if (property.type !== 'multi_select')
    throw new Error('Unreachable property type')
  return property.multi_select
}

function releaseDate(page: PageObjectResponse) {
  const property = getProperty(page, 'Date', 'date')
  if (property.type !== 'date') throw new Error('Unreachable property type')
  return property.date?.start.slice(0, 10) ?? null
}

function episode(items: readonly RichTextItemResponse[]) {
  const label = plainText(items)
  if (!label) return undefined
  const href = items.find((item) => item.href)?.href ?? undefined
  return href ? { label, href } : { label }
}

function youtubeUrl(page: PageObjectResponse) {
  const property = getProperty(page, 'YouTube Clip', 'url')
  if (property.type !== 'url') throw new Error('Unreachable property type')
  return property.url
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
  const titleItems = await retrieveRichTextItems(page, 'Example', 'title')
  const episodeItems = await retrieveRichTextItems(page, 'Episode', 'rich_text')
  const caveatItems = await retrieveRichTextItems(page, 'Caveats', 'rich_text')
  const analogyItems = await retrieveRichTextItems(
    page,
    'Why the analogy works',
    'rich_text'
  )
  const sceneItems = await retrieveRichTextItems(page, 'Scene', 'rich_text')
  const scenarioTitle = title(page, titleItems)
  return {
    page,
    id: page.id,
    title: scenarioTitle,
    source: select(page, 'Media'),
    episode: episode(episodeItems),
    releaseDate: releaseDate(page),
    featured: featuredScenarioIds.has(page.id),
    riskFamilies: multiSelect(page, 'AI risk families'),
    concepts: multiSelect(page, 'AI safety concepts'),
    video: parseYouTubeVideo(youtubeUrl(page)),
    scene: requiredMarkdown(page, 'Scene', sceneItems),
    whyAnalogyWorks: requiredMarkdown(
      page,
      'Why the analogy works',
      analogyItems
    ),
    caveats: requiredMarkdown(page, 'Caveats', caveatItems)
  }
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function readPreviousManifest(): Promise<SyncManifest> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(snapshotTarget, 'manifest.json'), 'utf8')
    )
    return syncManifestSchema.parse(value)
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return emptyManifest

    throw new Error(
      'Existing content/snapshot/manifest.json is invalid; refusing to discard slug and media history',
      { cause: err }
    )
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
  page: PageObjectResponse
): Promise<SyncEntry | null> {
  const parsed = syncEntrySchema.safeParse(entry)
  if (!parsed.success) return null

  const current = parsed.data
  const expectedPaths = scenarioMediaPaths(page.id)
  if (
    current.lastEditedTime !== page.last_edited_time ||
    current.gallerySrc !== expectedPaths.gallerySrc ||
    current.detailSrc !== expectedPaths.detailSrc
  ) {
    return null
  }

  const [galleryMatches, detailMatches] = await Promise.all([
    fileMatchesHash(
      publicFilePath(projectRoot, current.gallerySrc),
      current.galleryHash
    ),
    fileMatchesHash(
      publicFilePath(projectRoot, current.detailSrc),
      current.detailHash
    )
  ])

  return galleryMatches && detailMatches ? current : null
}

async function fileMatchesHash(path: string, expectedHash: string) {
  try {
    return sha256(await readFile(path)) === expectedHash
  } catch {
    return false
  }
}

async function reuseImage(
  entry: SyncEntry,
  stageRoot: string
): Promise<ImageResult> {
  for (const publicPath of [entry.gallerySrc, entry.detailSrc]) {
    const source = publicFilePath(projectRoot, publicPath)
    const target = publicFilePath(stageRoot, publicPath)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
  }

  return {
    gallerySrc: entry.gallerySrc,
    detailSrc: entry.detailSrc,
    width: entry.width,
    height: entry.height,
    sourceHash: entry.sourceHash,
    galleryHash: entry.galleryHash,
    detailHash: entry.detailHash,
    imageBlockId: entry.imageBlockId,
    additionalImageCount: entry.additionalImageCount,
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
  const maximumAttempts = 3
  let lastError = new Error('Image download failed')

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000)
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
        url
      )
      await delay(500 * 2 ** (attempt - 1))
    }
  }

  throw lastError
}

async function processImage(
  page: PageObjectResponse,
  stageRoot: string
): Promise<ImageResult> {
  const blocks = await findImageBlocks(page.id)
  const images = blocks.filter((block) => block.type === 'image')
  const overrideId = IMAGE_BLOCK_OVERRIDES.get(page.id)
  const selectedImage = overrideId
    ? images.find((image) => image.id === overrideId)
    : images[0]
  const missingImageOverride = getMissingImageFallback(page)
  if (overrideId && !selectedImage) {
    throw new Error(
      `Page ${page.id} is missing configured image block ${overrideId}`
    )
  }
  if (!selectedImage && !missingImageOverride) {
    throw new Error(`Page ${page.id} has no image block`)
  }

  if (images.length > 1) {
    console.warn(
      `Page ${page.id} has ${images.length} images; using first block ${selectedImage?.id}`
    )
  }

  if (!selectedImage) {
    console.warn(
      `Page ${page.id} has no image block; using ${missingImageOverride!.imageBlockId}`
    )
  }

  const input = await downloadImage(
    selectedImage ? imageUrl(selectedImage) : missingImageOverride!.url
  )
  const sourceHash = sha256(input)
  const { gallerySrc, detailSrc } = scenarioMediaPaths(page.id)

  const [gallery, detail] = await Promise.all([
    sharp(input)
      .rotate()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer({ resolveWithObject: true }),
    sharp(input)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 })
      .toBuffer({ resolveWithObject: true })
  ])

  const galleryFile = publicFilePath(stageRoot, gallerySrc)
  const detailFile = publicFilePath(stageRoot, detailSrc)
  await mkdir(dirname(galleryFile), { recursive: true })
  await Promise.all([
    writeFile(galleryFile, gallery.data),
    writeFile(detailFile, detail.data)
  ])

  return {
    gallerySrc,
    detailSrc,
    width: detail.info.width,
    height: detail.info.height,
    sourceHash,
    galleryHash: sha256(gallery.data),
    detailHash: sha256(detail.data),
    imageBlockId: selectedImage?.id ?? missingImageOverride!.imageBlockId,
    additionalImageCount: Math.max(0, images.length - 1),
    caption: selectedImage
      ? imageCaption(selectedImage)
      : missingImageOverride!.caption
  }
}

function getMissingImageFallback(page: PageObjectResponse) {
  const configured = MISSING_IMAGE_OVERRIDES.get(page.id)
  if (configured) return configured

  const video = parseYouTubeVideo(youtubeUrl(page))
  if (!video) return undefined

  return {
    imageBlockId: `youtube-thumbnail:${video.id}`,
    url: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    caption: `Video thumbnail from ${select(page, 'Media').name}`
  }
}

function scenarioMediaPaths(pageId: string) {
  const compactId = pageId.replaceAll('-', '')
  return {
    gallerySrc: `/media/generated/scenarios/${compactId}/gallery.webp`,
    detailSrc: `/media/generated/scenarios/${compactId}/detail.webp`
  }
}

function stableOptions(
  rows: readonly ParsedScenario[],
  key: 'riskFamilies' | 'concepts'
) {
  const options = new Map<string, SelectOption>()
  for (const row of rows) {
    for (const option of row[key]) {
      const current = options.get(option.id)
      if (current && current.name !== option.name) {
        throw new Error(`Notion option ${option.id} has conflicting names`)
      }
      options.set(option.id, option)
    }
  }
  return [...options.values()].toSorted((a, b) => a.id.localeCompare(b.id))
}

function buildSources(rows: readonly ParsedScenario[]) {
  const sources = new Map<string, { id: string; title: string }>()
  for (const row of rows) {
    const current = sources.get(row.source.id)
    if (current && current.title !== row.source.name) {
      throw new Error(
        `Notion media option ${row.source.id} has conflicting names`
      )
    }
    sources.set(row.source.id, {
      id: row.source.id,
      title: row.source.name
    })
  }
  return [...sources.values()]
    .map((source) => ({ ...source, kind: 'unknown' as const }))
    .toSorted((a, b) => a.id.localeCompare(b.id))
}

function buildRiskFamilies(options: readonly SelectOption[]) {
  return options.map((option) => {
    const key = option.name.toLowerCase()
    if (!Object.hasOwn(RISK_FAMILY_DETAILS, key)) {
      throw new Error(
        `Missing presentation details for risk family “${option.name}”`
      )
    }
    const details = RISK_FAMILY_DETAILS[key as keyof typeof RISK_FAMILY_DETAILS]
    return { id: option.id, ...details }
  })
}

function buildConcepts(options: readonly SelectOption[]) {
  return options.map((option) => ({
    id: option.id,
    title: option.name,
    description:
      'A concept used to index the collection’s authored cultural analogies.'
  }))
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function assertStageAssets(snapshot: ContentSnapshot, stageRoot: string) {
  for (const scenario of snapshot.scenarios) {
    for (const publicPath of [
      scenario.image.gallerySrc,
      scenario.image.detailSrc
    ]) {
      const assetPath = publicFilePath(stageRoot, publicPath)
      if (!(await pathExists(assetPath))) {
        throw new Error(`Generated asset is missing: ${publicPath}`)
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
      staged: join(stageRoot, 'public/media/generated'),
      target: mediaTarget
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

const notionToken = process.env.NOTION_TOKEN
if (!notionToken) {
  throw new Error('NOTION_TOKEN is required to run pnpm content:sync')
}

const notion = new Client({
  auth: notionToken,
  notionVersion: NOTION_API_VERSION
})

async function main() {
  const stageRoot = join(projectRoot, `.content-sync-${randomUUID()}`)
  const previousManifest = await readPreviousManifest()
  await mkdir(stageRoot, { recursive: true })

  try {
    console.log('Verifying Notion database and data source…')
    const database = await notion.databases.retrieve({
      database_id: NOTION_DATABASE_ID
    })
    if (!isFullDatabase(database))
      throw new Error('Notion returned a partial database')
    if (
      !database.data_sources.some(
        (source) => source.id === NOTION_DATA_SOURCE_ID
      )
    ) {
      throw new Error(
        'Configured Notion data source is not a child of the database'
      )
    }

    const dataSource = await notion.dataSources.retrieve({
      data_source_id: NOTION_DATA_SOURCE_ID
    })
    if (!isFullDataSource(dataSource))
      throw new Error('Notion returned a partial data source')
    for (const [name, expectation] of Object.entries(EXPECTED_PROPERTIES)) {
      const property =
        dataSource.properties[name] ??
        Object.values(dataSource.properties).find((candidate) =>
          propertyIdsMatch(candidate.id, expectation.id)
        )
      if (
        !property ||
        !propertyIdsMatch(property.id, expectation.id) ||
        property.type !== expectation.type
      ) {
        throw new Error(
          `Notion schema mismatch for “${name}”: expected ${expectation.type} at ${expectation.id}, received ${property?.type ?? 'missing'}`
        )
      }
    }

    console.log('Reading all scenario rows…')
    const pages: PageObjectResponse[] = []
    for await (const row of iterateAllDataSourceRows(notion, {
      data_source_id: NOTION_DATA_SOURCE_ID,
      result_type: 'page',
      page_size: 100
    })) {
      if (isFullPage(row) && !row.in_trash) pages.push(row)
    }
    pages.sort((a, b) => a.id.localeCompare(b.id))
    const parsedRows = await pMap(pages, parseScenario, { concurrency: 3 })

    const missingFeatured = FEATURED_SCENARIO_IDS.filter(
      (expectedId) => !parsedRows.some((row) => row.id === expectedId)
    )
    if (missingFeatured.length > 0) {
      throw new Error(
        `Missing featured scenario IDs: ${missingFeatured.join(', ')}`
      )
    }

    const sourceSeeds = buildSources(parsedRows)
    const riskFamilySeeds = buildRiskFamilies(
      stableOptions(parsedRows, 'riskFamilies')
    )
    const conceptSeeds = buildConcepts(stableOptions(parsedRows, 'concepts'))
    const slugs = {
      scenarios: allocateStableSlugs(
        parsedRows,
        previousManifest.slugs.scenarios
      ),
      sources: allocateStableSlugs(sourceSeeds, previousManifest.slugs.sources),
      riskFamilies: allocateStableSlugs(
        riskFamilySeeds,
        previousManifest.slugs.riskFamilies
      ),
      concepts: allocateStableSlugs(
        conceptSeeds,
        previousManifest.slugs.concepts
      )
    }

    let completedImages = 0
    console.log(`Syncing ${parsedRows.length} scenario images…`)
    const imageResults = await pMap(
      parsedRows,
      async (row) => {
        const previousEntry = previousManifest.entries[row.id]
        const reusableEntry = await reusableImageEntry(previousEntry, row.page)
        const result = reusableEntry
          ? await reuseImage(reusableEntry, stageRoot)
          : await processImage(row.page, stageRoot)

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
      { concurrency: 4 }
    )

    const entries: Record<string, SyncEntry> = {}
    const scenarios: ScenarioRecord[] = parsedRows.map((row, index) => {
      const image = imageResults[index]!
      entries[row.id] = {
        pipelineVersion: MEDIA_PIPELINE_VERSION,
        lastEditedTime: row.page.last_edited_time,
        imageBlockId: image.imageBlockId,
        additionalImageCount: image.additionalImageCount,
        sourceHash: image.sourceHash,
        galleryHash: image.galleryHash,
        detailHash: image.detailHash,
        gallerySrc: image.gallerySrc,
        detailSrc: image.detailSrc,
        width: image.width,
        height: image.height,
        caption: image.caption
      }

      const scenario: ScenarioRecord = {
        id: row.id,
        slug: slugs.scenarios[row.id]!,
        title: row.title,
        sourceId: row.source.id,
        releaseDate: row.releaseDate,
        featured: row.featured,
        riskFamilyIds: row.riskFamilies.map((option) => option.id).toSorted(),
        conceptIds: row.concepts.map((option) => option.id).toSorted(),
        image: {
          gallerySrc: image.gallerySrc,
          detailSrc: image.detailSrc,
          width: image.width,
          height: image.height,
          alt:
            image.caption ||
            `Still from ${row.source.name} illustrating ${row.title}`
        },
        video: row.video,
        scene: row.scene,
        whyAnalogyWorks: row.whyAnalogyWorks,
        caveats: row.caveats
      }
      if (row.episode) scenario.episode = row.episode
      return scenario
    })

    const sources: SourceRecord[] = sourceSeeds.map((source) => ({
      ...source,
      slug: slugs.sources[source.id]!
    }))
    const riskFamilies: RiskFamilyRecord[] = riskFamilySeeds.map((family) => ({
      ...family,
      slug: slugs.riskFamilies[family.id]!
    }))
    const concepts: ConceptRecord[] = conceptSeeds.map((concept) => ({
      ...concept,
      slug: slugs.concepts[concept.id]!
    }))

    const snapshot = validateContentSnapshot({
      schemaVersion: 1,
      scenarios,
      sources,
      riskFamilies,
      concepts
    })
    await assertStageAssets(snapshot, stageRoot)

    const fixtureScenarioIds = [...FEATURED_SCENARIO_IDS]

    const manifest = {
      schemaVersion: 1 as const,
      notion: {
        apiVersion: NOTION_API_VERSION,
        databaseId: NOTION_DATABASE_ID,
        dataSourceId: NOTION_DATA_SOURCE_ID
      },
      counts: {
        scenarios: snapshot.scenarios.length,
        sources: snapshot.sources.length,
        riskFamilies: snapshot.riskFamilies.length,
        concepts: snapshot.concepts.length
      },
      fixtureScenarioIds,
      slugs,
      entries
    }

    const stageSnapshot = join(stageRoot, 'content/snapshot')
    await Promise.all([
      writeJson(join(stageSnapshot, 'manifest.json'), manifest),
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
  } finally {
    await rm(stageRoot, { force: true, recursive: true })
  }
}

await main()
