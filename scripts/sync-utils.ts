import { createHash } from 'node:crypto'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import type {
  GetPagePropertyParameters,
  GetPagePropertyResponse,
  RichTextItemResponse
} from '@notionhq/client'

const generatedMediaPattern =
  /^\/media\/generated\/(?:scenarios|sources)\/[0-9a-f]{32}\/(?:gallery|detail)\.webp$/
const sha256Pattern = /^[0-9a-f]{64}$/

export function parseSearchKeywords(value: string) {
  return [
    ...new Set(
      value
        .normalize('NFKC')
        .split(',')
        .map((keyword) =>
          keyword.trim().toLocaleLowerCase('en').replace(/\s+/gu, ' ')
        )
        .filter(Boolean)
    )
  ]
}

export function isGeneratedMediaPublicPath(publicPath: string) {
  return generatedMediaPattern.test(publicPath)
}

export function generatedMediaPublicPaths(
  collection: 'scenarios' | 'sources',
  pageId: string
) {
  const compactId = pageId.replaceAll('-', '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(compactId)) {
    throw new Error(`Invalid Notion page ID for generated media: ${pageId}`)
  }

  return {
    gallerySrc: `/media/generated/${collection}/${compactId}/gallery.webp`,
    detailSrc: `/media/generated/${collection}/${compactId}/detail.webp`
  }
}

export function generatedMediaObjectKey(
  collection: 'scenarios' | 'sources',
  pageId: string,
  variant: 'gallery' | 'detail',
  hash: string
) {
  const compactId = compactNotionId(pageId)
  if (!sha256Pattern.test(hash)) {
    throw new Error(`Invalid generated media SHA-256 hash: ${hash}`)
  }

  return `media/generated/${collection}/${compactId}/${variant}-${hash}.webp`
}

export function generatedMediaFilePath(root: string, publicPath: string) {
  if (!isGeneratedMediaPublicPath(publicPath)) {
    throw new Error(`Refusing unexpected generated media path: ${publicPath}`)
  }

  const generatedRoot = resolve(root, 'public/media/generated')
  const filePath = resolve(root, 'public', publicPath.slice(1))
  const relativePath = relative(generatedRoot, filePath)

  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Generated media path escapes its root: ${publicPath}`)
  }

  return filePath
}

export function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function compactNotionId(pageId: string) {
  const compactId = pageId.replaceAll('-', '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(compactId)) {
    throw new Error(`Invalid Notion page ID for generated media: ${pageId}`)
  }
  return compactId
}

export function allocateStableSlugs(
  items: readonly { id: string; title: string }[],
  previous: Readonly<Record<string, string>>
) {
  const sortedItems = items.toSorted((a, b) => a.id.localeCompare(b.id))
  const currentIds = new Set(sortedItems.map((item) => item.id))
  const slugs: Record<string, string> = {}
  const used = new Set<string>()

  for (const [id, priorSlug] of Object.entries(previous).toSorted(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (!currentIds.has(id)) continue
    if (used.has(priorSlug)) {
      throw new Error(
        `Previous manifest contains duplicate slug “${priorSlug}” at ${id}`
      )
    }
    slugs[id] = priorSlug
    used.add(priorSlug)
  }

  for (const item of sortedItems) {
    if (slugs[item.id]) continue
    const base =
      slugify(item.title) || `item-${item.id.replaceAll('-', '').slice(0, 8)}`
    let candidate = base
    let suffixLength = 6
    while (used.has(candidate)) {
      candidate = `${base}-${item.id.replaceAll('-', '').slice(-suffixLength)}`
      suffixLength += 2
    }
    slugs[item.id] = candidate
    used.add(candidate)
  }

  return slugs
}

export async function retrieveRelationIds(
  pageId: string,
  propertyId: string,
  inlineRelations: readonly { id: string }[],
  retrieve: (
    args: GetPagePropertyParameters
  ) => Promise<GetPagePropertyResponse>
) {
  if (inlineRelations.length < 25) {
    return inlineRelations.map((relation) => relation.id)
  }

  const ids: string[] = []
  let startCursor: string | undefined

  do {
    const response = await retrieve({
      page_id: pageId,
      property_id: propertyId,
      page_size: 100,
      start_cursor: startCursor
    })

    if (
      response.object !== 'list' ||
      response.property_item.type !== 'relation'
    ) {
      throw new Error(
        `Page ${pageId} relation ${propertyId} did not return a paginated relation list`
      )
    }

    for (const item of response.results) {
      if (item.type !== 'relation') {
        throw new Error(
          `Page ${pageId} relation ${propertyId} returned ${item.type}; expected relation`
        )
      }
      ids.push(item.relation.id)
    }

    startCursor = response.next_cursor ?? undefined
  } while (startCursor)

  return ids
}

export function richTextToMarkdown(items: readonly RichTextItemResponse[]) {
  return items.map(richTextItemToMarkdown).join('').trim()
}

function richTextItemToMarkdown(item: RichTextItemResponse) {
  const { annotations } = item
  let value = annotations.code
    ? markdownCodeSpan(item.plain_text)
    : escapeMarkdownText(item.plain_text)

  if (!annotations.code) {
    if (annotations.bold) value = `**${value}**`
    if (annotations.italic) value = `_${value}_`
    if (annotations.strikethrough) value = `~~${value}~~`
    if (annotations.underline) value = `<u>${value}</u>`
  }

  if (item.href) {
    value = `[${value}](<${escapeMarkdownDestination(item.href)}>)`
  }

  return value
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_[\]<>])/g, '\\$1')
}

function escapeMarkdownDestination(value: string) {
  return value.replaceAll('\\', '%5C').replaceAll('>', '%3E')
}

function markdownCodeSpan(value: string) {
  const longestRun = Math.max(
    0,
    ...Array.from(value.matchAll(/`+/g), (match) => match[0].length)
  )
  const fence = '`'.repeat(longestRun + 1)
  const needsPadding =
    value.startsWith('`') ||
    value.endsWith('`') ||
    value.startsWith(' ') ||
    value.endsWith(' ')
  const padding = needsPadding ? ' ' : ''

  return `${fence}${padding}${value}${padding}${fence}`
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
