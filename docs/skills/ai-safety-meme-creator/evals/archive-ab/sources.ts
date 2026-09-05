import { createHash, randomUUID } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

import pMap from 'p-map'
import sharp from 'sharp'

import type { ArchiveComparisonCase, ArchivedAsset } from './selection'

const existingAssetRoot = '/private/tmp/cultural-alignment-meme-review'
const downloadAttempts = 3
const downloadTimeoutMs = 30_000

export async function stageArchiveSources({
  cases,
  cacheDirectory
}: {
  readonly cases: readonly ArchiveComparisonCase[]
  readonly cacheDirectory: string
}): Promise<ReadonlyMap<string, string>> {
  await mkdir(cacheDirectory, { recursive: true })
  const assetsByHash = new Map<string, ArchivedAsset>()
  for (const asset of cases.flatMap(({ source_assets }) => source_assets)) {
    assetsByHash.set(asset.content_hash, asset)
  }
  const localCandidates = await indexExistingAssets(existingAssetRoot)
  const entries = await pMap(
    assetsByHash.values(),
    async (asset) => {
      const path = await stageArchiveSource({
        asset,
        cacheDirectory,
        localCandidates: localCandidates.get(asset.id) ?? []
      })
      return [asset.content_hash, path] as const
    },
    { concurrency: 6 }
  )
  return new Map(entries)
}

async function stageArchiveSource({
  asset,
  cacheDirectory,
  localCandidates
}: {
  readonly asset: ArchivedAsset
  readonly cacheDirectory: string
  readonly localCandidates: readonly string[]
}): Promise<string> {
  const cached = await findVerifiedCachedSource(
    cacheDirectory,
    asset.content_hash
  )
  if (cached) return cached

  for (const candidate of localCandidates) {
    if ((await sha256File(candidate)) !== asset.content_hash) continue
    const extension = await imageExtension(candidate)
    const target = join(cacheDirectory, `${asset.content_hash}${extension}`)
    await copyFile(candidate, target)
    return target
  }

  const bytes = await fetchArchiveSource(asset.src).catch((err: unknown) => {
    throw new Error(
      `Could not download ${asset.id}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    )
  })
  const actualHash = sha256(bytes)
  if (actualHash !== asset.content_hash) {
    throw new Error(
      `Source hash mismatch for ${asset.id}: expected ${asset.content_hash}, received ${actualHash}`
    )
  }
  const extension = extensionForFormat((await sharp(bytes).metadata()).format)
  const target = join(cacheDirectory, `${asset.content_hash}${extension}`)
  const temporary = join(
    cacheDirectory,
    `.${asset.content_hash}-${randomUUID()}.tmp`
  )
  await writeFile(temporary, bytes)
  try {
    await rename(temporary, target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    await unlink(temporary)
  }
  return target
}

async function fetchArchiveSource(url: string): Promise<Buffer> {
  let lastError: unknown
  for (let attempt = 1; attempt <= downloadAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
          'user-agent': 'Mozilla/5.0 meme-skill-archive-regression/1.0'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(downloadTimeoutMs)
      })
      if (
        attempt < downloadAttempts &&
        (response.status === 429 || response.status >= 500)
      ) {
        await response.body?.cancel()
        await delay(400 * 2 ** (attempt - 1))
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw Object.assign(new Error(`HTTP ${response.status}`), {
          nonRetryable: true
        })
      }
      return Buffer.from(await response.arrayBuffer())
    } catch (err) {
      lastError = err
      if ((err as { nonRetryable?: boolean }).nonRetryable) throw err
      if (attempt === downloadAttempts) break
      await delay(400 * 2 ** (attempt - 1))
    }
  }
  throw new Error(
    `Could not download archived source after ${downloadAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError }
  )
}

async function findVerifiedCachedSource(
  cacheDirectory: string,
  expectedHash: string
): Promise<string | undefined> {
  const names = await readdir(cacheDirectory)
  for (const name of names) {
    if (!name.startsWith(`${expectedHash}.`)) continue
    const path = join(cacheDirectory, name)
    if ((await sha256File(path)) === expectedHash) return path
  }
  return undefined
}

async function indexExistingAssets(
  root: string
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (!(await exists(root))) return new Map()
  const paths = await collectAssetFiles(root)
  const index = new Map<string, string[]>()
  for (const path of paths) {
    const id = basename(path, extname(path))
    const matches = index.get(id) ?? []
    matches.push(path)
    index.set(id, matches)
  }
  return index
}

async function collectAssetFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...(await collectAssetFiles(path)))
    } else if (directory.endsWith('/assets') && entry.isFile()) {
      paths.push(path)
    }
  }
  return paths
}

async function imageExtension(path: string): Promise<string> {
  return extensionForFormat((await sharp(path).metadata()).format)
}

function extensionForFormat(format: string | undefined): string {
  if (format === 'jpeg') return '.jpg'
  if (format === 'png') return '.png'
  if (format === 'webp') return '.webp'
  if (format === 'gif') return '.gif'
  throw new Error(`Unsupported source image format: ${format ?? 'unknown'}`)
}

async function sha256File(path: string): Promise<string> {
  return sha256(await readFile(path))
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds)
  )
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}
