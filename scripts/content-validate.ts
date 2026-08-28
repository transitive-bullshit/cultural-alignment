import { deepStrictEqual } from 'node:assert'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSearchDocuments } from '../lib/content/search-documents'
import { validateContentSnapshot } from '../lib/content/validate'
import { generatedMediaFilePath } from './sync-utils'

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
  schemaVersion: 1,
  scenarios,
  sources,
  riskFamilies,
  concepts
})
const projectedSearchDocuments = buildSearchDocuments(snapshot)

deepStrictEqual(snapshotSearchDocuments, projectedSearchDocuments)
deepStrictEqual(publicSearchDocuments, projectedSearchDocuments)
deepStrictEqual((manifest as { counts?: unknown }).counts, {
  scenarios: snapshot.scenarios.length,
  sources: snapshot.sources.length,
  riskFamilies: snapshot.riskFamilies.length,
  concepts: snapshot.concepts.length
})

await Promise.all(
  snapshot.scenarios.flatMap((scenario) =>
    [scenario.image.gallerySrc, scenario.image.detailSrc].map((publicPath) =>
      access(assetPath(publicPath))
    )
  )
)

console.log(
  `Validated ${snapshot.scenarios.length} scenarios and ${snapshot.scenarios.length * 2} generated media assets.`
)
