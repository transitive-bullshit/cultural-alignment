import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import pMap from 'p-map'

import { evaluateMemePlan } from '../evaluate'
import { serializeAgentVisibleFixture } from '../prompt'
import {
  renderSafeMemeIntent,
  type SafeMemeRenderBlocked,
  type SafeMemeRenderComplete
} from '../safe-render'
import {
  semanticMemeIntentSchema,
  type SemanticMemeIntent
} from '../semantic-plan'
import type { MemeSkillFixture } from '../schema'

import { buildArchiveFixture } from './case-fixture'
import {
  defaultArchiveV3ArtifactRoot,
  normalizeArchiveV3IntentMetadata,
  type ArchiveV3CaseResult,
  type ArchiveV3RevisedResult,
  type ArchiveV3RunManifest
} from './v3-runner'
import { workspaceDirectory, type ArchiveComparisonCase } from './selection'
import { stageArchiveSources } from './sources'

interface RecomposeArchiveV3ManifestOptions {
  readonly manifestPath?: string
  readonly artifactRoot?: string
  readonly expectedCaseCount?: number
  readonly concurrency?: number
}

interface RecomposeArchiveV3CliOverrides {
  readonly artifactRoot?: string
  readonly expectedCaseCount?: number
  readonly concurrency?: number
}

export interface RecomposeArchiveV3ManifestResult {
  readonly manifestPath: string
  readonly backupPath: string
  readonly caseCount: number
  readonly completeCount: number
  readonly invalidCount: number
  readonly blockedCount: number
}

interface ValidatedArchiveV3Manifest {
  readonly manifest: ArchiveV3RunManifest
  readonly cases: readonly ArchiveComparisonCase[]
  readonly priorResultsByCase: ReadonlyMap<string, ArchiveV3CaseResult>
  readonly intentsByCase: ReadonlyMap<string, SemanticMemeIntent>
}

const archiveAbDirectory = dirname(fileURLToPath(import.meta.url))
const evalDirectory = resolve(archiveAbDirectory, '..')
const recomposerVersion = 'recomposed-v1'
const recomposerDependencySources = [
  fileURLToPath(import.meta.url),
  join(evalDirectory, 'balanced-wrap.ts'),
  join(evalDirectory, 'semantic-plan.schema.json'),
  join(evalDirectory, 'semantic-plan.ts'),
  join(evalDirectory, 'impact-font.ts'),
  join(evalDirectory, 'safe-render.ts'),
  join(evalDirectory, 'measured-text.ts'),
  join(evalDirectory, 'render.ts'),
  join(evalDirectory, 'frame-geometry.ts'),
  join(evalDirectory, 'text-layout.ts'),
  join(evalDirectory, 'evaluate.ts'),
  join(evalDirectory, 'schema.ts'),
  join(archiveAbDirectory, 'case-fixture.ts'),
  join(archiveAbDirectory, 'project-geometry.ts')
] as const

export const defaultArchiveV3ManifestPath = join(
  defaultArchiveV3ArtifactRoot,
  'run-manifest.json'
)

export async function recomposeArchiveV3Manifest({
  manifestPath = defaultArchiveV3ManifestPath,
  artifactRoot = defaultArchiveV3ArtifactRoot,
  expectedCaseCount = 50,
  concurrency = 4
}: RecomposeArchiveV3ManifestOptions = {}): Promise<RecomposeArchiveV3ManifestResult> {
  requirePositiveInteger(expectedCaseCount, 'Expected case count')
  requirePositiveInteger(concurrency, 'Concurrency')

  const originalSource = await readFile(manifestPath, 'utf8')
  const validated = validateManifest(originalSource, expectedCaseCount)
  const sourcePaths = await stageArchiveSources({
    cases: validated.cases,
    cacheDirectory: join(artifactRoot, 'sources')
  })
  const prepared = validated.cases.map((comparisonCase) => {
    const fixture = buildArchiveFixture(comparisonCase, sourcePaths)
    const intent = validated.intentsByCase.get(comparisonCase.case_id)!
    return {
      comparisonCase,
      fixture,
      intent,
      priorResult: validated.priorResultsByCase.get(comparisonCase.case_id)!
    }
  })
  const results = await pMap(
    prepared,
    ({ comparisonCase, fixture, intent, priorResult }) =>
      recomposeCase({
        comparisonCase,
        fixture,
        intent,
        priorResult,
        artifactRoot
      }),
    { concurrency }
  )
  const updated: ArchiveV3RunManifest = {
    ...validated.manifest,
    results
  }
  const backupPath = timestampedBackupPath(manifestPath)
  await writeFile(backupPath, originalSource, { encoding: 'utf8', flag: 'wx' })
  await writeJsonAtomically(manifestPath, updated)

  return {
    manifestPath,
    backupPath,
    caseCount: results.length,
    completeCount: countStatus(results, 'complete'),
    invalidCount: countStatus(results, 'invalid'),
    blockedCount: countStatus(results, 'blocked')
  }
}

async function recomposeCase({
  comparisonCase,
  fixture,
  intent,
  priorResult,
  artifactRoot
}: {
  readonly comparisonCase: ArchiveComparisonCase
  readonly fixture: MemeSkillFixture
  readonly intent: SemanticMemeIntent
  readonly priorResult: ArchiveV3CaseResult
  readonly artifactRoot: string
}): Promise<ArchiveV3CaseResult> {
  const cacheKey = await buildRecompositionCacheKey({ fixture, intent })
  const artifactDirectory = join(
    artifactRoot,
    'cache',
    fixture.id,
    'recomposed',
    cacheKey
  )
  const cached = await readCachedRecomposition(artifactDirectory, cacheKey)
  const revised = cached
    ? preserveGenerationMetadata(priorResult.revised, cached, true)
    : await renderRecomposition({
        fixture,
        intent,
        prior: priorResult.revised,
        cacheKey,
        artifactDirectory
      })
  return {
    case_id: comparisonCase.case_id,
    idea_id: comparisonCase.idea_id,
    revised
  }
}

async function renderRecomposition({
  fixture,
  intent,
  prior,
  cacheKey,
  artifactDirectory
}: {
  readonly fixture: MemeSkillFixture
  readonly intent: SemanticMemeIntent
  readonly prior: ArchiveV3RevisedResult
  readonly cacheKey: string
  readonly artifactDirectory: string
}): Promise<ArchiveV3RevisedResult> {
  const caseRoot = dirname(artifactDirectory)
  await mkdir(caseRoot, { recursive: true })
  const pendingDirectory = await mkdtemp(join(caseRoot, '.pending-'))
  try {
    const renderPath = join(pendingDirectory, 'render.png')
    const previewPath = join(pendingDirectory, 'preview.png')
    const renderResult = await renderSafeMemeIntent({
      fixture,
      intent,
      outputPath: renderPath,
      previewPath
    })
    const revised = await revisedResult({
      fixture,
      intent,
      prior,
      cacheKey,
      artifactDirectory,
      pendingDirectory,
      renderResult
    })
    await Promise.all([
      writeFile(
        join(pendingDirectory, 'request.json'),
        serializeAgentVisibleFixture(fixture),
        'utf8'
      ),
      writeFile(
        join(pendingDirectory, 'intent.json'),
        `${JSON.stringify(intent, null, 2)}\n`,
        'utf8'
      ),
      writeFile(
        join(pendingDirectory, 'evaluation.json'),
        `${JSON.stringify(
          {
            pass: revised.evaluation_pass,
            violations: revised.violations,
            render_checks: revised.render_checks,
            blocked_reason: revised.blocked_reason
          },
          null,
          2
        )}\n`,
        'utf8'
      ),
      writeFile(
        join(pendingDirectory, 'outcome.json'),
        `${JSON.stringify(revised, null, 2)}\n`,
        'utf8'
      )
    ])
    await rename(pendingDirectory, artifactDirectory)
    return revised
  } catch (err) {
    await rm(pendingDirectory, { recursive: true, force: true })
    throw err
  }
}

async function revisedResult({
  fixture,
  intent,
  prior,
  cacheKey,
  artifactDirectory,
  pendingDirectory,
  renderResult
}: {
  readonly fixture: MemeSkillFixture
  readonly intent: SemanticMemeIntent
  readonly prior: ArchiveV3RevisedResult
  readonly cacheKey: string
  readonly artifactDirectory: string
  readonly pendingDirectory: string
  readonly renderResult: SafeMemeRenderComplete | SafeMemeRenderBlocked
}): Promise<ArchiveV3RevisedResult> {
  if (renderResult.status === 'blocked') {
    return {
      variant: 'revised',
      status: 'blocked',
      cache_key: cacheKey,
      cache_hit: false,
      attempts: prior.attempts,
      duration_ms: prior.duration_ms,
      artifact_directory: artifactDirectory,
      render_path: null,
      preview_path: null,
      render_sha256: null,
      preview_sha256: null,
      intent,
      plan: null,
      evaluation_pass: false,
      violations: [
        `render.blocked: ${renderResult.reason.code}: ${renderResult.reason.message}`
      ],
      render_checks: null,
      blocked_reason: renderResult.reason,
      error: null
    }
  }

  const evaluation = evaluateMemePlan(fixture, renderResult.plan)
  if (!evaluation.plan) {
    throw new Error(
      `Safe renderer returned a plan outside the runtime schema for ${fixture.id}`
    )
  }
  const violations = evaluation.violations
    .filter(
      ({ code }) =>
        code !== 'typography.vertical-fit' &&
        code !== 'typography.impossible-wrap' &&
        code !== 'layout.protected-region'
    )
    .map(({ code, message }) => `${code}: ${message}`)
  const evaluationPass = violations.length === 0
  const finalRenderPath = join(artifactDirectory, 'render.png')
  const finalPreviewPath = join(artifactDirectory, 'preview.png')
  return {
    variant: 'revised',
    status: evaluationPass ? 'complete' : 'invalid',
    cache_key: cacheKey,
    cache_hit: false,
    attempts: prior.attempts,
    duration_ms: prior.duration_ms,
    artifact_directory: artifactDirectory,
    render_path: finalRenderPath,
    preview_path: finalPreviewPath,
    render_sha256: await sha256File(join(pendingDirectory, 'render.png')),
    preview_sha256: await sha256File(join(pendingDirectory, 'preview.png')),
    intent,
    plan: evaluation.plan,
    evaluation_pass: evaluationPass,
    violations,
    render_checks: renderResult.checks,
    blocked_reason: null,
    error: null
  }
}

async function buildRecompositionCacheKey({
  fixture,
  intent
}: {
  readonly fixture: MemeSkillFixture
  readonly intent: SemanticMemeIntent
}): Promise<string> {
  const hash = createHash('sha256')
  hash.update(recomposerVersion)
  hash.update(JSON.stringify(intent))
  hash.update(JSON.stringify(fixture.expectations))
  hash.update(JSON.stringify(fixture.feedback_sources))
  for (const source of recomposerDependencySources) {
    hash.update(relative(workspaceDirectory, source))
    hash.update(await readFile(source))
  }
  for (const image of fixture.images) {
    hash.update(image.id)
    hash.update(await readFile(image.path))
  }
  return `${recomposerVersion}-${hash.digest('hex')}`
}

async function readCachedRecomposition(
  artifactDirectory: string,
  cacheKey: string
): Promise<ArchiveV3RevisedResult | undefined> {
  try {
    const value = JSON.parse(
      await readFile(join(artifactDirectory, 'outcome.json'), 'utf8')
    ) as ArchiveV3RevisedResult
    if (value.cache_key !== cacheKey) return undefined
    if (value.status === 'blocked') return value
    if (
      (value.status !== 'complete' && value.status !== 'invalid') ||
      !value.render_path ||
      !value.preview_path ||
      !value.render_sha256 ||
      !value.preview_sha256
    ) {
      return undefined
    }
    await Promise.all([stat(value.render_path), stat(value.preview_path)])
    const [renderHash, previewHash] = await Promise.all([
      sha256File(value.render_path),
      sha256File(value.preview_path)
    ])
    return renderHash === value.render_sha256 &&
      previewHash === value.preview_sha256
      ? value
      : undefined
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
}

function preserveGenerationMetadata(
  prior: ArchiveV3RevisedResult,
  recomposed: ArchiveV3RevisedResult,
  cacheHit: boolean
): ArchiveV3RevisedResult {
  return {
    ...recomposed,
    cache_hit: cacheHit,
    attempts: prior.attempts,
    duration_ms: prior.duration_ms,
    intent: prior.intent
  }
}

function validateManifest(
  source: string,
  expectedCaseCount: number
): ValidatedArchiveV3Manifest {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (err) {
    throw new Error(
      `Archive v3 manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  if (!isRecord(value) || value.schema_version !== 1) {
    throw new Error('Archive v3 manifest must use schema version 1')
  }
  if (value.case_count !== expectedCaseCount) {
    throw new Error(
      `Recomposition requires exactly ${expectedCaseCount} cases; found ${String(value.case_count)}`
    )
  }
  if (
    !isRecord(value.selection) ||
    !Array.isArray(value.selection.cases) ||
    !Array.isArray(value.results)
  ) {
    throw new Error('Archive v3 manifest is missing selection or results')
  }
  if (value.selection.cases.length !== expectedCaseCount) {
    throw new Error(
      `Manifest declares ${expectedCaseCount} cases but selects ${value.selection.cases.length}`
    )
  }
  if (value.results.length !== expectedCaseCount) {
    throw new Error(
      `Manifest declares ${expectedCaseCount} cases but contains ${value.results.length} results`
    )
  }

  const cases = value.selection.cases as unknown as ArchiveComparisonCase[]
  const priorResultsByCase = new Map<string, ArchiveV3CaseResult>()
  const intentsByCase = new Map<string, SemanticMemeIntent>()
  const selectedIds = new Set<string>()
  for (const comparisonCase of cases) {
    if (
      !isRecord(comparisonCase) ||
      typeof comparisonCase.case_id !== 'string' ||
      typeof comparisonCase.idea_id !== 'string' ||
      !Array.isArray(comparisonCase.source_assets)
    ) {
      throw new Error('Archive v3 selection contains an invalid case')
    }
    if (selectedIds.has(comparisonCase.case_id)) {
      throw new Error(`Duplicate selected case ${comparisonCase.case_id}`)
    }
    selectedIds.add(comparisonCase.case_id)
  }
  for (const candidate of value.results) {
    if (
      !isRecord(candidate) ||
      typeof candidate.case_id !== 'string' ||
      typeof candidate.idea_id !== 'string' ||
      !isRecord(candidate.revised)
    ) {
      throw new Error('Archive v3 manifest contains an invalid result')
    }
    if (priorResultsByCase.has(candidate.case_id)) {
      throw new Error(`Duplicate result case ${candidate.case_id}`)
    }
    const selected = cases.find(({ case_id }) => case_id === candidate.case_id)
    if (!selected) {
      throw new Error(`Result ${candidate.case_id} is not selected`)
    }
    if (selected.idea_id !== candidate.idea_id) {
      throw new Error(
        `Result ${candidate.case_id} has idea_id ${candidate.idea_id}; selection expects ${selected.idea_id}`
      )
    }
    const parsedIntent = semanticMemeIntentSchema.safeParse(
      normalizeArchiveV3IntentMetadata(candidate.revised.intent)
    )
    if (!parsedIntent.success) {
      throw new Error(
        `Case ${candidate.case_id} does not contain a valid stored semantic intent`
      )
    }
    if (parsedIntent.data.fixture_id !== candidate.case_id) {
      throw new Error(
        `Case ${candidate.case_id} stored semantic intent targets ${parsedIntent.data.fixture_id}`
      )
    }
    const result = candidate as unknown as ArchiveV3CaseResult
    priorResultsByCase.set(candidate.case_id, result)
    intentsByCase.set(candidate.case_id, parsedIntent.data)
  }
  if (priorResultsByCase.size !== selectedIds.size) {
    throw new Error('Archive v3 manifest is missing a selected result')
  }
  return {
    manifest: value as unknown as ArchiveV3RunManifest,
    cases,
    priorResultsByCase,
    intentsByCase
  }
}

function countStatus(
  results: readonly ArchiveV3CaseResult[],
  status: ArchiveV3RevisedResult['status']
): number {
  return results.filter(({ revised }) => revised.status === status).length
}

function timestampedBackupPath(manifestPath: string): string {
  const extension = '.json'
  const stem = basename(manifestPath, extension)
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
  return join(
    dirname(manifestPath),
    `${stem}.before-recompose-${timestamp}-${randomUUID().slice(0, 8)}${extension}`
  )
}

async function writeJsonAtomically(
  outputPath: string,
  value: ArchiveV3RunManifest
): Promise<void> {
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

async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function runRecomposeArchiveV3ManifestCli(
  args: readonly string[] = process.argv.slice(2),
  overrides: RecomposeArchiveV3CliOverrides = {}
): Promise<string> {
  if (args.length > 1) {
    throw new Error(
      'Usage: pnpm memes:skill-v3:recompose -- [run-manifest.json]'
    )
  }
  const [manifestPath] = args
  const result = await recomposeArchiveV3Manifest({
    ...overrides,
    manifestPath
  })
  return JSON.stringify(result, null, 2)
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await runRecomposeArchiveV3ManifestCli())
}
