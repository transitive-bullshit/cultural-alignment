import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { contentCatalog } from '../lib/content/snapshot'
import { memeIdeaCollectionSchema } from '../lib/meme-review/schema'

const workspacePath = process.cwd()
const partsPath = join(workspacePath, 'data', 'meme-idea-parts')
const outputPath = join(workspacePath, 'data', 'meme-review', 'ideas.json')
const partFilePattern = /^part-\d{2}\.json$/

const partFiles = (await readdir(partsPath))
  .filter((name) => partFilePattern.test(name))
  .toSorted()
const partCollections = await Promise.all(
  partFiles.map(async (name) =>
    JSON.parse(await readFile(join(partsPath, name), 'utf8'))
  )
)
const collection = memeIdeaCollectionSchema.parse(partCollections.flat())
const ideasByScenarioSlug = new Map(
  collection.map((scenario) => [scenario.scenario_slug, scenario])
)
const featuredSlugs = contentCatalog
  .listScenarioCards({ featuredOnly: true })
  .map(({ slug }) => slug)
const featuredSlugSet = new Set(featuredSlugs)
const missingSlugs = featuredSlugs.filter(
  (slug) => !ideasByScenarioSlug.has(slug)
)
const unexpectedSlugs = collection
  .map(({ scenario_slug }) => scenario_slug)
  .filter((slug) => !featuredSlugSet.has(slug))

if (missingSlugs.length || unexpectedSlugs.length) {
  throw new Error(
    [
      missingSlugs.length
        ? `Missing featured scenarios: ${missingSlugs.join(', ')}`
        : null,
      unexpectedSlugs.length
        ? `Unexpected scenarios: ${unexpectedSlugs.join(', ')}`
        : null
    ]
      .filter(Boolean)
      .join('\n')
  )
}

const orderedCollection = featuredSlugs.map((slug) => {
  const scenario = ideasByScenarioSlug.get(slug)
  if (!scenario) throw new Error(`Missing featured scenario: ${slug}`)
  return scenario
})

await writeFile(
  outputPath,
  `${JSON.stringify(orderedCollection, null, 2)}\n`,
  'utf8'
)

console.log(
  `Assembled ${orderedCollection.reduce((total, scenario) => total + scenario.ideas.length, 0)} ideas for ${orderedCollection.length} scenarios from ${partFiles.length} parts.`
)
