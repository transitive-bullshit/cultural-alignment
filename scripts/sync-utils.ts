import { createHash } from 'node:crypto'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import type { RichTextItemResponse } from '@notionhq/client'

const generatedScenarioMediaPattern =
  /^\/media\/generated\/scenarios\/[0-9a-f]{32}\/(?:gallery|detail)\.webp$/

export function isGeneratedMediaPublicPath(publicPath: string) {
  return generatedScenarioMediaPattern.test(publicPath)
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

export function allocateStableSlugs(
  items: readonly { id: string; title: string }[],
  previous: Readonly<Record<string, string>>
) {
  const sortedItems = items.toSorted((a, b) => a.id.localeCompare(b.id))
  const slugs = { ...previous }
  const used = new Set<string>()

  for (const [id, priorSlug] of Object.entries(previous).toSorted(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (used.has(priorSlug)) {
      throw new Error(
        `Previous manifest contains duplicate slug “${priorSlug}” at ${id}`
      )
    }
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
