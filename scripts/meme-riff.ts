import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import sharp from 'sharp'

import {
  type MemeSkillFixture,
  memeSkillFixtureSchema
} from '../docs/skills/ai-safety-meme-creator/evals/schema'
import type { ScenarioRecord } from '../lib/content/schema'
import { validateContentSnapshot } from '../lib/content/validate'
import {
  bindManifestToScenarios,
  type FinalizedMemeExportManifest,
  parseFinalizedMemeExportManifest
} from './notion-meme-uploader'

/**
 * Single-meme workflow outside review rounds. `prepare` stages a scenario's
 * still and composer fixture; `export` turns a chosen composer render into a
 * JPEG plus the manifest `pnpm memes:upload-notion` consumes.
 */

const HELP = `Usage:
  pnpm memes:riff prepare <scenario-slug> [--out=<dir>]
  pnpm memes:riff export <scenario-slug> <render.png> [--out=<dir>]

prepare  Download the scenario still and write a composer fixture, reusing the
         latest review round's protected regions when they match the still.
export   Convert a chosen render to JPEG and add it to <dir>/export/manifest.json.
         Upload with: pnpm memes:upload-notion --manifest=<manifest> [--apply]

--out defaults to work/meme-riffs/<scenario-slug>.`

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const roundsRoot = join(projectRoot, 'data/meme-review/rounds')

type RoundAsset = {
  scenario_slug: string
  src: string
  protected_regions: {
    id: string
    label: string
    priority: 'must' | 'soft'
    source_rect: [number, number, number, number]
  }[]
}

export function buildRiffFixture(
  scenario: ScenarioRecord,
  context: {
    sourceTitle: string
    conceptNames: readonly string[]
    regions: RoundAsset['protected_regions']
  }
): MemeSkillFixture {
  const id = `${scenario.slug}--riff`
  return memeSkillFixtureSchema.parse({
    id,
    purpose: 'Riff on a supplied reference using the scenario’s curated still.',
    tags: ['riff'],
    request: {
      source_title: context.sourceTitle,
      scene: scenario.scene,
      ai_concepts: context.conceptNames,
      caveats: [scenario.caveats],
      user_direction: null,
      rejected_direction: null
    },
    images: [
      {
        id: 'still',
        path: 'still.webp',
        description: `${scenario.image.alt}. Authentic source frame, ${scenario.image.width} × ${scenario.image.height}.`
      }
    ],
    protected_regions: context.regions.map((region) => ({
      id: region.id.replace(`${scenario.slug}--`, ''),
      image_id: 'still',
      label: region.label,
      canvas_rect_pct: region.source_rect,
      priority: region.priority
    })),
    expectations: {
      allowed_formats: [
        'canon',
        'relabel',
        'collision',
        'dialogue',
        'state contrast',
        'source-native interface'
      ],
      allowed_templates: ['overlay'],
      allowed_frame_modes: ['cover'],
      expected_source_frames: [{ image_id: 'still', role: 'single' }]
    },
    // The composer ignores provenance; the fixture schema requires one entry.
    feedback_sources: [
      { path: 'n/a', idea_id: id, rating: 'unrated', note_includes: 'riff' }
    ]
  })
}

/** Protected regions annotated for this exact still in the newest round. */
async function findRoundRegions(scenario: ScenarioRecord) {
  const rounds = (await readdir(roundsRoot)).toSorted().toReversed()
  for (const round of rounds) {
    let assets: RoundAsset[]
    try {
      assets = JSON.parse(
        await readFile(join(roundsRoot, round, 'assets.json'), 'utf8')
      )
    } catch {
      continue
    }
    const asset = assets.find(
      (candidate) =>
        candidate.scenario_slug === scenario.slug &&
        candidate.src === scenario.image.gallerySrc
    )
    if (asset) return { round, regions: asset.protected_regions }
  }
  return { round: null, regions: [] }
}

async function loadSnapshot() {
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(
      await readFile(join(projectRoot, 'content/snapshot', name), 'utf8')
    )
  return validateContentSnapshot({
    schemaVersion: 3,
    scenarios: await read('scenarios.json'),
    sources: await read('sources.json'),
    franchises: await read('franchises.json'),
    riskFamilies: await read('risk-families.json'),
    concepts: await read('concepts.json')
  })
}

async function prepare(slug: string, outDir: string) {
  const snapshot = await loadSnapshot()
  const scenario = snapshot.scenarios.find((s) => s.slug === slug)
  if (!scenario) throw new Error(`Unknown scenario slug: ${slug}`)
  const source = snapshot.sources.find((s) => s.id === scenario.sourceId)!
  const conceptNames = scenario.conceptIds.map(
    (id) => snapshot.concepts.find((c) => c.id === id)!.shortName
  )

  await mkdir(outDir, { recursive: true })
  const response = await fetch(scenario.image.detailSrc)
  if (!response.ok) {
    throw new Error(
      `Failed to download ${scenario.image.detailSrc}: ${response.status}`
    )
  }
  await writeFile(
    join(outDir, 'still.webp'),
    Buffer.from(await response.arrayBuffer())
  )

  const { round, regions } = await findRoundRegions(scenario)
  const fixture = buildRiffFixture(scenario, {
    sourceTitle: source.title,
    conceptNames,
    regions
  })
  const fixturePath = join(outDir, 'fixture.json')
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)

  console.log(
    JSON.stringify(
      {
        scenario: {
          slug,
          title: scenario.title,
          source: source.title,
          concepts: conceptNames,
          scene: scenario.scene,
          whyAnalogyWorks: scenario.whyAnalogyWorks
        },
        still: join(outDir, 'still.webp'),
        fixture: fixturePath,
        protectedRegions: fixture.protected_regions.map((r) => r.id),
        regionsFrom: round,
        warning:
          regions.length === 0
            ? 'No annotated regions match this still. Add protected_regions for faces and the scene hinge before composing.'
            : undefined,
        compose: `node --import tsx docs/skills/ai-safety-meme-creator/scripts/compose-meme.ts --fixture ${fixturePath} --intent ${join(outDir, 'intent-1.json')} --output ${join(outDir, 'render-1.png')} --preview ${join(outDir, 'preview-1.png')}`
      },
      null,
      2
    )
  )
}

async function exportRender(slug: string, renderPath: string, outDir: string) {
  const { data, info } = await sharp(renderPath)
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
  const sha256 = createHash('sha256').update(data).digest('hex')
  const exportDir = join(outDir, 'export')
  const filename = `${slug}--riff-${sha256.slice(0, 12)}.jpg`
  const path = join(exportDir, filename)
  await mkdir(exportDir, { recursive: true })
  await writeFile(path, data)

  const manifestPath = join(exportDir, 'manifest.json')
  let manifest: FinalizedMemeExportManifest = { schemaVersion: 1, files: [] }
  try {
    manifest = parseFinalizedMemeExportManifest(
      JSON.parse(await readFile(manifestPath, 'utf8'))
    )
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  manifest = parseFinalizedMemeExportManifest({
    schemaVersion: 1,
    files: [
      ...manifest.files.filter((file) => file.filename !== filename),
      {
        scenarioSlug: slug,
        ideaId: `${slug}--riff`,
        revisionKey: 'riff',
        payloadFingerprint: sha256.slice(0, 16),
        path,
        filename,
        sha256,
        width: info.width,
        height: info.height,
        terminalPeriodsRemoved: 0
      }
    ]
  })
  bindManifestToScenarios(
    manifest,
    JSON.parse(
      await readFile(
        join(projectRoot, 'content/snapshot/scenarios.json'),
        'utf8'
      )
    )
  )
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    JSON.stringify(
      {
        image: path,
        manifest: manifestPath,
        files: manifest.files.length,
        next: [
          `pnpm memes:upload-notion --manifest=${manifestPath}`,
          `pnpm memes:upload-notion --manifest=${manifestPath} --apply`,
          'pnpm content:sync'
        ]
      },
      null,
      2
    )
  )
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false }
    }
  })
  const [command, slug, render] = positionals

  if (values.help || !command) {
    console.log(HELP)
    return
  }
  if (!slug) throw new Error(`Missing <scenario-slug>.\n\n${HELP}`)
  const outDir = resolve(
    values.out ?? join(projectRoot, 'work/meme-riffs', slug)
  )

  if (command === 'prepare') return prepare(slug, outDir)
  if (command === 'export') {
    if (!render) throw new Error(`Missing <render.png>.\n\n${HELP}`)
    return exportRender(slug, resolve(render), outDir)
  }
  throw new Error(`Unknown command "${command}".\n\n${HELP}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
