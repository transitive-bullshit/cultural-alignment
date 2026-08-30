import { deepStrictEqual } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ContentImage } from '../lib/content/schema'
import { buildSearchDocuments } from '../lib/content/search-documents'
import { validateContentSnapshot } from '../lib/content/validate'
import { validateCheckedSyncManifest } from './sync-manifest'
import { isGeneratedMediaUrlFor } from './sync-utils'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const snapshotRoot = join(projectRoot, 'content/snapshot')

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(snapshotRoot, name), 'utf8'))
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
validateCheckedSyncManifest(manifest, snapshot)
const projectedSearchDocuments = buildSearchDocuments(snapshot)

deepStrictEqual(snapshotSearchDocuments, projectedSearchDocuments)
deepStrictEqual(publicSearchDocuments, projectedSearchDocuments)

const mediaReferences = [
  ...snapshot.scenarios.flatMap(({ id, image }) =>
    contentAddressedMediaReferences('scenarios', id, image)
  ),
  ...snapshot.sources.flatMap(({ id, poster }) =>
    poster ? contentAddressedMediaReferences('sources', id, poster) : []
  )
]
await assertGeneratedMediaDirectoryIsEmpty()

console.log(
  `Validated ${snapshot.scenarios.length} scenarios, ${snapshot.sources.length} sources, ${snapshot.riskFamilies.length} risk families, ${snapshot.concepts.length} concepts, and ${mediaReferences.length} content-addressed media references.`
)

function contentAddressedMediaReferences(
  collection: 'scenarios' | 'sources',
  recordId: string,
  image: Pick<ContentImage, 'gallerySrc' | 'detailSrc'>
) {
  const compactId = recordId.replaceAll('-', '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(compactId)) {
    throw new Error(`Invalid Notion record ID for snapshot media: ${recordId}`)
  }

  return (['gallery', 'detail'] as const).map((variant) => {
    const src = image[`${variant}Src`]
    const pathname = new URL(src).pathname
    if (!isGeneratedMediaUrlFor(src, collection, compactId, variant)) {
      throw new Error(
        `Snapshot ${collection} media ${recordId} has an unowned ${variant} URL path: ${pathname}`
      )
    }
    return src
  })
}

async function assertGeneratedMediaDirectoryIsEmpty() {
  const generatedRoot = join(projectRoot, 'public/media/generated')
  const actualPaths = await listFiles(generatedRoot)
  if (actualPaths.length > 0) {
    throw new Error(
      `Generated media must be remote, but local files remain: ${actualPaths.join(', ')}`
    )
  }
}

async function listFiles(root: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return []
    throw err
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name)
      return entry.isDirectory() ? await listFiles(path) : [path]
    })
  )
  return nested.flat().toSorted()
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}
