import { deepStrictEqual } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSearchDocuments } from '../lib/content/search-documents'
import { validateContentSnapshot } from '../lib/content/validate'
import { validateSyncManifest } from './sync-manifest'

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
const validatedManifest = validateSyncManifest(manifest, snapshot)
const projectedSearchDocuments = buildSearchDocuments(snapshot)

deepStrictEqual(snapshotSearchDocuments, projectedSearchDocuments)
deepStrictEqual(publicSearchDocuments, projectedSearchDocuments)

const mediaEntries = [
  ...Object.values(validatedManifest.entries.scenarios),
  ...Object.values(validatedManifest.entries.sources)
]
await assertGeneratedMediaDirectoryIsEmpty()

console.log(
  `Validated ${snapshot.scenarios.length} scenarios, ${snapshot.sources.length} sources, ${snapshot.riskFamilies.length} risk families, ${snapshot.concepts.length} concepts, and ${mediaEntries.length * 2} content-addressed media references.`
)

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
