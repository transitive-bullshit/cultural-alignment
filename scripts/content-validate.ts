import { deepStrictEqual } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSearchDocuments } from '../lib/content/search-documents'
import { validateContentSnapshot } from '../lib/content/validate'
import { validateSyncManifest, type SyncEntry } from './sync-manifest'
import { generatedMediaFilePath, sha256 } from './sync-utils'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const snapshotRoot = join(projectRoot, 'content/snapshot')

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(snapshotRoot, name), 'utf8'))
}

function assetPath(publicPath: string) {
  return generatedMediaFilePath(projectRoot, publicPath)
}

const [
  scenarios,
  sources,
  riskFamilies,
  concepts,
  manifest,
  snapshotSearchDocuments,
  publicSearchDocuments
] = await Promise.all([
  readJson('scenarios.json'),
  readJson('sources.json'),
  readJson('risk-families.json'),
  readJson('concepts.json'),
  readJson('manifest.json'),
  readJson('search-documents.json'),
  readFile(join(projectRoot, 'public/content/search-index.json'), 'utf8').then(
    JSON.parse
  )
])

const snapshot = validateContentSnapshot({
  schemaVersion: 2,
  scenarios,
  sources,
  riskFamilies,
  concepts
})
const validatedManifest = validateSyncManifest(manifest, snapshot)
const projectedSearchDocuments = buildSearchDocuments(snapshot)

deepStrictEqual(snapshotSearchDocuments, projectedSearchDocuments)
deepStrictEqual(publicSearchDocuments, projectedSearchDocuments)

const mediaEntries = [
  ...Object.values(validatedManifest.entries.scenarios),
  ...Object.values(validatedManifest.entries.sources)
]
await Promise.all(mediaEntries.map(validateAssetHashes))
await assertNoUnownedGeneratedFiles(mediaEntries)

console.log(
  `Validated ${snapshot.scenarios.length} scenarios, ${snapshot.sources.length} sources, ${snapshot.riskFamilies.length} risk families, ${snapshot.concepts.length} concepts, and ${mediaEntries.length * 2} generated media assets.`
)

async function validateAssetHashes(entry: SyncEntry) {
  const [gallery, detail] = await Promise.all([
    readFile(assetPath(entry.gallerySrc)),
    readFile(assetPath(entry.detailSrc))
  ])
  if (sha256(gallery) !== entry.galleryHash) {
    throw new Error(`Generated asset hash mismatch: ${entry.gallerySrc}`)
  }
  if (sha256(detail) !== entry.detailHash) {
    throw new Error(`Generated asset hash mismatch: ${entry.detailSrc}`)
  }
}

async function assertNoUnownedGeneratedFiles(entries: readonly SyncEntry[]) {
  const generatedRoot = join(projectRoot, 'public/media/generated')
  const expectedPaths = new Set(
    entries.flatMap((entry) => [
      assetPath(entry.gallerySrc),
      assetPath(entry.detailSrc)
    ])
  )
  const actualPaths = await listFiles(generatedRoot)
  const unexpected = actualPaths.filter((path) => !expectedPaths.has(path))
  if (unexpected.length > 0) {
    throw new Error(
      `Generated media contains unowned files: ${unexpected.join(', ')}`
    )
  }
  if (actualPaths.length !== expectedPaths.size) {
    throw new Error('Generated media file count does not match the manifest')
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name)
      return entry.isDirectory() ? await listFiles(path) : [path]
    })
  )
  return nested.flat().toSorted()
}
