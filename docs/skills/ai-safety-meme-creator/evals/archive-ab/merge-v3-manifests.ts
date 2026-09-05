import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { ArchiveV3CaseResult, ArchiveV3RunManifest } from './v3-runner'

interface MergeArchiveV3ManifestOptions {
  readonly baseManifestPath?: string
  readonly repairManifestPath?: string
  readonly outputManifestPath?: string
  readonly expectedBaseCaseCount?: number
}

export interface MergeArchiveV3ManifestResult {
  readonly outputManifestPath: string
  readonly caseCount: number
  readonly replacedCaseIds: readonly string[]
  readonly preservedCaseIds: readonly string[]
}

interface ManifestIdentity {
  readonly case_id: string
  readonly idea_id: string
}

interface ValidatedManifest {
  readonly manifest: ArchiveV3RunManifest
  readonly selectionByCase: ReadonlyMap<string, ManifestIdentity>
  readonly resultsByCase: ReadonlyMap<string, ArchiveV3CaseResult>
}

const archiveAbDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceDirectory = resolve(archiveAbDirectory, '../../../../..')

export const defaultArchiveV3PassOneManifestPath = join(
  workspaceDirectory,
  'test-results',
  'meme-skill-archive-v3',
  'run-manifest.pass-1.json'
)

export const defaultArchiveV3RepairManifestPath = join(
  workspaceDirectory,
  'test-results',
  'meme-skill-archive-v3',
  'run-manifest.json'
)

export async function mergeArchiveV3Manifests({
  baseManifestPath = defaultArchiveV3PassOneManifestPath,
  repairManifestPath = defaultArchiveV3RepairManifestPath,
  outputManifestPath = defaultArchiveV3RepairManifestPath,
  expectedBaseCaseCount = 50
}: MergeArchiveV3ManifestOptions = {}): Promise<MergeArchiveV3ManifestResult> {
  if (
    !Number.isSafeInteger(expectedBaseCaseCount) ||
    expectedBaseCaseCount < 1
  ) {
    throw new Error('Expected baseline case count must be a positive integer')
  }

  const [baseSource, repairSource] = await Promise.all([
    readFile(baseManifestPath, 'utf8'),
    readFile(repairManifestPath, 'utf8')
  ])
  const base = validateManifest(baseSource, 'baseline')
  const repair = validateManifest(repairSource, 'repair')

  if (base.manifest.case_count !== expectedBaseCaseCount) {
    throw new Error(
      `Baseline must contain exactly ${expectedBaseCaseCount} cases; found ${base.manifest.case_count}`
    )
  }
  if (repair.manifest.case_count < 1) {
    throw new Error('Repair manifest must contain at least one case')
  }

  for (const repairIdentity of repair.selectionByCase.values()) {
    const baseIdentity = base.selectionByCase.get(repairIdentity.case_id)
    if (!baseIdentity) {
      throw new Error(`Unknown repair case ${repairIdentity.case_id}`)
    }
    if (baseIdentity.idea_id !== repairIdentity.idea_id) {
      throw new Error(
        `Repair identity for ${repairIdentity.case_id} does not match the baseline: expected ${baseIdentity.idea_id}, received ${repairIdentity.idea_id}`
      )
    }
  }

  const replacedCaseIds: string[] = []
  const preservedCaseIds: string[] = []
  const results = base.manifest.selection.cases.map(({ case_id }) => {
    const repaired = repair.resultsByCase.get(case_id)
    if (repaired) {
      replacedCaseIds.push(case_id)
      return repaired
    }
    preservedCaseIds.push(case_id)
    return base.resultsByCase.get(case_id)!
  })
  const merged: ArchiveV3RunManifest = {
    ...base.manifest,
    results
  }

  await writeJsonAtomically(outputManifestPath, merged)
  return {
    outputManifestPath,
    caseCount: merged.case_count,
    replacedCaseIds,
    preservedCaseIds
  }
}

export async function runMergeArchiveV3ManifestsCli(
  args: readonly string[] = process.argv.slice(2)
): Promise<string> {
  if (args.length > 3) {
    throw new Error(
      'Usage: pnpm memes:skill-v3:merge-repair -- [baseline-manifest] [repair-manifest] [output-manifest]'
    )
  }
  const [baseManifestPath, repairManifestPath, outputManifestPath] = args
  const result = await mergeArchiveV3Manifests({
    baseManifestPath,
    repairManifestPath,
    outputManifestPath
  })
  return JSON.stringify(result, null, 2)
}

function validateManifest(source: string, label: string): ValidatedManifest {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (err) {
    throw new Error(
      `${capitalize(label)} manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  if (!isRecord(value) || value.schema_version !== 1) {
    throw new Error(`${capitalize(label)} manifest must use schema version 1`)
  }
  if (
    typeof value.case_count !== 'number' ||
    !Number.isSafeInteger(value.case_count) ||
    value.case_count < 0
  ) {
    throw new Error(`${capitalize(label)} manifest has an invalid case_count`)
  }
  const caseCount = value.case_count
  if (
    !isRecord(value.selection) ||
    !Array.isArray(value.selection.cases) ||
    !Array.isArray(value.results)
  ) {
    throw new Error(
      `${capitalize(label)} manifest is missing selection or results`
    )
  }
  if (value.selection.cases.length !== caseCount) {
    throw new Error(
      `${capitalize(label)} manifest declares ${caseCount} cases but selects ${value.selection.cases.length}`
    )
  }
  if (value.results.length !== caseCount) {
    throw new Error(
      `${capitalize(label)} manifest declares ${caseCount} cases but contains ${value.results.length} results`
    )
  }

  const selectionByCase = collectIdentities(
    value.selection.cases,
    `${label} selection`
  )
  const resultsByCase = collectResults(value.results, `${label} results`)
  for (const [caseId, result] of resultsByCase) {
    const selected = selectionByCase.get(caseId)
    if (!selected) {
      throw new Error(
        `${capitalize(label)} result ${caseId} is not present in its selection`
      )
    }
    if (selected.idea_id !== result.idea_id) {
      throw new Error(
        `${capitalize(label)} result ${caseId} has idea_id ${result.idea_id}; selection expects ${selected.idea_id}`
      )
    }
  }

  return {
    manifest: value as unknown as ArchiveV3RunManifest,
    selectionByCase,
    resultsByCase
  }
}

function collectIdentities(
  values: readonly unknown[],
  label: string
): ReadonlyMap<string, ManifestIdentity> {
  const byCase = new Map<string, ManifestIdentity>()
  const casesByIdea = new Map<string, string>()
  for (const value of values) {
    const identity = readIdentity(value, label)
    if (byCase.has(identity.case_id)) {
      throw new Error(`Duplicate case_id ${identity.case_id} in ${label}`)
    }
    const priorCase = casesByIdea.get(identity.idea_id)
    if (priorCase) {
      throw new Error(
        `Duplicate idea_id ${identity.idea_id} in ${label}: ${priorCase} and ${identity.case_id}`
      )
    }
    byCase.set(identity.case_id, identity)
    casesByIdea.set(identity.idea_id, identity.case_id)
  }
  return byCase
}

function collectResults(
  values: readonly unknown[],
  label: string
): ReadonlyMap<string, ArchiveV3CaseResult> {
  collectIdentities(values, label)
  return new Map(
    values.map((value) => {
      const identity = readIdentity(value, label)
      return [
        identity.case_id,
        value as unknown as ArchiveV3CaseResult
      ] as const
    })
  )
}

function readIdentity(value: unknown, label: string): ManifestIdentity {
  if (
    !isRecord(value) ||
    typeof value.case_id !== 'string' ||
    value.case_id.length === 0 ||
    typeof value.idea_id !== 'string' ||
    value.idea_id.length === 0
  ) {
    throw new Error(`${capitalize(label)} contains an invalid case identity`)
  }
  return { case_id: value.case_id, idea_id: value.idea_id }
}

async function writeJsonAtomically(
  outputPath: string,
  value: ArchiveV3RunManifest
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.${randomUUID()}.tmp`
  )
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      'utf8'
    )
    await rename(temporaryPath, outputPath)
  } catch (err) {
    await rm(temporaryPath, { force: true })
    throw err
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await runMergeArchiveV3ManifestsCli())
}
