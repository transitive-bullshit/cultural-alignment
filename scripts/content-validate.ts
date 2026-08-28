import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const [scenarios, sources, riskFamilies, concepts] = await Promise.all([
  readJson('scenarios.json'),
  readJson('sources.json'),
  readJson('risk-families.json'),
  readJson('concepts.json')
])

const snapshot = validateContentSnapshot({
  schemaVersion: 1,
  scenarios,
  sources,
  riskFamilies,
  concepts
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
