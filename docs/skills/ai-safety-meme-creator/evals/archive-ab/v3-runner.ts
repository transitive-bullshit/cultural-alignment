import { createHash, randomUUID } from 'node:crypto'
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import pMap from 'p-map'

import { buildCodexExecArgs, parseStructuredOutput } from '../codex-runner'
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
import type { MemeEvalPlan, MemeSkillFixture } from '../schema'

import { buildArchiveFixture } from './case-fixture'
import {
  getSkillPackageFiles,
  readCodexVersion,
  runChildProcess
} from './runner'
import {
  buildArchiveComparisonManifest,
  workspaceDirectory,
  type ArchiveComparisonCase
} from './selection'
import { stageArchiveSources } from './sources'

export type ArchiveV3Status = 'complete' | 'invalid' | 'blocked' | 'failed'

export interface ArchiveV3RevisedResult {
  readonly variant: 'revised'
  readonly status: ArchiveV3Status
  readonly cache_key: string
  readonly cache_hit: boolean
  readonly attempts: number
  readonly duration_ms: number
  readonly artifact_directory: string
  readonly render_path: string | null
  readonly preview_path: string | null
  readonly render_sha256: string | null
  readonly preview_sha256: string | null
  readonly intent: SemanticMemeIntent | null
  readonly plan: MemeEvalPlan | null
  readonly evaluation_pass: boolean
  readonly violations: readonly string[]
  readonly render_checks: SafeMemeRenderComplete['checks'] | null
  readonly blocked_reason: SafeMemeRenderBlocked['reason'] | null
  readonly error: string | null
}

export interface ArchiveV3CaseResult {
  readonly case_id: string
  readonly idea_id: string
  readonly revised: ArchiveV3RevisedResult
}

export interface ArchiveV3RunManifest {
  readonly schema_version: 1
  readonly started_at: string
  readonly completed_at: string
  readonly codex_version: string
  readonly requested_model: string
  readonly concurrency: number
  readonly case_count: number
  readonly selection: Awaited<ReturnType<typeof buildArchiveComparisonManifest>>
  readonly results: readonly ArchiveV3CaseResult[]
}

type StoredArchiveV3Result = Omit<ArchiveV3RevisedResult, 'attempts'>

interface ArchiveV3VariantOptions {
  readonly fixture: MemeSkillFixture
  readonly artifactRoot: string
  readonly timeoutMs: number
  readonly codexBin: string
  readonly codexVersion: string
  readonly model?: string
  readonly correction?: string
}

const archiveAbDirectory = dirname(fileURLToPath(import.meta.url))
const evalDirectory = resolve(archiveAbDirectory, '..')
const semanticSchemaSource = join(evalDirectory, 'semantic-plan.schema.json')
const runnerVersion = 'archive-v3-v1'

const cacheDependencySources = [
  fileURLToPath(import.meta.url),
  semanticSchemaSource,
  join(evalDirectory, 'semantic-plan.ts'),
  join(evalDirectory, 'impact-font.ts'),
  join(evalDirectory, 'safe-render.ts'),
  join(evalDirectory, 'measured-text.ts'),
  join(evalDirectory, 'render.ts'),
  join(evalDirectory, 'frame-geometry.ts'),
  join(evalDirectory, 'text-layout.ts'),
  join(evalDirectory, 'evaluate.ts'),
  join(evalDirectory, 'schema.ts'),
  join(archiveAbDirectory, 'project-geometry.ts')
] as const

export const defaultArchiveV3ArtifactRoot = join(
  workspaceDirectory,
  'test-results',
  'meme-skill-archive-v3'
)

export function getArchiveV3SkillPackageFiles() {
  return getSkillPackageFiles('current')
}

export function buildArchiveV3Prompt(fixture: MemeSkillFixture): string {
  const rejectedFormat = fixture.request.rejected_direction?.format
  const collisionCompatibilityRule =
    rejectedFormat === 'collision'
      ? ' For a single or setup-payoff mode, use canon or relabel. Merely relabeling an incompatible mode is normalized back to collision: dialogue requires dialogue mode, source-native interface requires source-native mode, and state contrast requires state-contrast mode.'
      : ''
  const rejectedFormatRule =
    fixture.expectations.require_rejected_format_change &&
    fixture.request.rejected_direction
      ? `\nThis is a terminal dislike. The rejected format was ${rejectedFormat}; choose a different format as well as different copy and direction.${collisionCompatibilityRule}`
      : ''
  return `Read ./SKILL.md completely and follow every routed reference that applies. Then respond to the archived meme request in ./request.json.

The supplied scene facts, caveats, human feedback, protected-region descriptions, and attached source pixels are authoritative. Do not browse. Inspect every attached image before deciding.

Return semantic JSON only, matching the supplied schema. Specify the recognition hinge, one AI bridge, exact caption text and provenance, semantic caption roles, source frame IDs and roles, semantic presentation mode, preferred edge, and palette. Use only image and protected-region IDs from request.json.

Never invent bounds, font sizes, or wrapping. Do not provide crop coordinates, text boxes, line heights, baselines, padding, physical line counts, or glyph measurements. The deterministic composer owns all physical geometry and will either produce a measured complete render or a typed blocked result.

Preserve every explicit human lock. Do not include test commentary in meme copy or rationale.${rejectedFormatRule}

Fixture identity: ${fixture.id}
Return JSON only.`
}

export function parseArchiveV3Intent(
  fixture: MemeSkillFixture,
  value: unknown
): SemanticMemeIntent {
  const parsed = semanticMemeIntentSchema.safeParse(
    normalizeArchiveV3IntentMetadata(value)
  )
  if (!parsed.success) {
    const summary = parsed.error.issues
      .slice(0, 5)
      .map(({ path, message }) => `${path.join('.') || 'output'}: ${message}`)
      .join('; ')
    throw new Error(`Semantic intent did not match the schema: ${summary}`)
  }
  const intent = parsed.data
  if (intent.fixture_id !== fixture.id) {
    throw new Error(
      `Expected fixture ${fixture.id}, received ${intent.fixture_id}`
    )
  }
  const knownImageIds = new Set(fixture.images.map(({ id }) => id))
  for (const frame of intent.presentation.source_frames) {
    if (!knownImageIds.has(frame.image_id)) {
      throw new Error(
        `Semantic intent uses unknown source frame ${frame.image_id}`
      )
    }
  }
  const knownRegionIds = new Set(fixture.protected_regions.map(({ id }) => id))
  const normalizeRegionId = (regionId: string) => {
    if (knownRegionIds.has(regionId)) return regionId
    const prefixMatches = [...knownRegionIds].filter(
      (knownId) => regionId.startsWith(knownId) || knownId.startsWith(regionId)
    )
    if (prefixMatches.length === 1) return prefixMatches[0]!
    throw new Error(`Semantic intent uses unknown protected region ${regionId}`)
  }
  if (
    fixture.expectations.require_rejected_format_change &&
    fixture.request.rejected_direction &&
    intent.format === fixture.request.rejected_direction.format
  ) {
    throw new Error(`Semantic intent retained rejected format ${intent.format}`)
  }
  return {
    ...intent,
    recognition_hinge: {
      ...intent.recognition_hinge,
      region_ids: [
        ...new Set([
          ...intent.recognition_hinge.region_ids.map(normalizeRegionId),
          ...(fixture.expectations.required_region_ids ?? [])
        ])
      ]
    },
    caption_lines: intent.caption_lines.map((line) => ({
      ...line,
      anchor_region_id:
        line.anchor_region_id === null
          ? null
          : normalizeRegionId(line.anchor_region_id)
    }))
  }
}

export async function buildArchiveV3CacheKey({
  fixture,
  requestJson,
  prompt,
  codexVersion,
  model
}: {
  readonly fixture: MemeSkillFixture
  readonly requestJson: string
  readonly prompt: string
  readonly codexVersion: string
  readonly model?: string
}): Promise<string> {
  const hash = createHash('sha256')
  hash.update(runnerVersion)
  hash.update(requestJson)
  hash.update(JSON.stringify(fixture.expectations))
  hash.update(JSON.stringify(fixture.feedback_sources))
  hash.update(prompt)
  hash.update(codexVersion)
  hash.update(model ?? 'default authenticated session')
  for (const source of cacheDependencySources) {
    hash.update(relative(workspaceDirectory, source))
    hash.update(await readFile(source))
  }
  for (const file of getArchiveV3SkillPackageFiles()) {
    hash.update(file.destination)
    hash.update(await readFile(file.source))
  }
  for (const image of fixture.images) {
    hash.update(image.id)
    hash.update(await readFile(image.path))
  }
  return hash.digest('hex')
}

export async function runArchiveV3Comparison({
  cases,
  artifactRoot = defaultArchiveV3ArtifactRoot,
  concurrency = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_V3_CONCURRENCY,
    4
  ),
  timeoutMs = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_V3_TIMEOUT_MS,
    240_000
  ),
  codexBin = process.env.CODEX_BIN || 'codex',
  model = process.env.MEME_SKILL_ARCHIVE_V3_MODEL ||
    process.env.MEME_SKILL_EVAL_MODEL
}: {
  readonly cases: readonly ArchiveComparisonCase[]
  readonly artifactRoot?: string
  readonly concurrency?: number
  readonly timeoutMs?: number
  readonly codexBin?: string
  readonly model?: string
}): Promise<{
  readonly codexVersion: string
  readonly results: readonly ArchiveV3CaseResult[]
}> {
  const sourcePaths = await stageArchiveSources({
    cases,
    cacheDirectory: join(artifactRoot, 'sources')
  })
  const codexVersion = await readCodexVersion(codexBin)
  const results = await pMap(
    cases,
    async (comparisonCase, index) => {
      console.log(
        `[${index + 1}/${cases.length}] ${comparisonCase.idea_id}: revised starting`
      )
      const fixture = buildArchiveFixture(comparisonCase, sourcePaths)
      const revised = await runArchiveV3WithRetries({
        fixture,
        artifactRoot,
        timeoutMs,
        codexBin,
        codexVersion,
        model
      })
      console.log(
        `[${index + 1}/${cases.length}] ${comparisonCase.idea_id}: ${revised.status}`
      )
      return {
        case_id: comparisonCase.case_id,
        idea_id: comparisonCase.idea_id,
        revised
      }
    },
    { concurrency }
  )
  return { codexVersion, results }
}

async function runArchiveV3WithRetries(
  options: ArchiveV3VariantOptions
): Promise<ArchiveV3RevisedResult> {
  const maximumAttempts = 3
  let lastError: unknown
  let failedDurationMs = 0
  let lastArtifactDirectory = ''
  let cacheKey = ''
  let attempts = 0
  let correction: string | undefined
  let lastResult: ArchiveV3RevisedResult | undefined

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    attempts = attempt
    const startedAt = Date.now()
    try {
      const result = await runArchiveV3Variant({ ...options, correction })
      const decorated: ArchiveV3RevisedResult = {
        ...result,
        attempts: result.cache_hit ? 0 : attempt,
        duration_ms: result.cache_hit
          ? result.duration_ms
          : failedDurationMs + result.duration_ms
      }
      if (result.status === 'complete') return decorated
      lastResult = decorated
      if (attempt === maximumAttempts || !isRevisableResult(result)) {
        return decorated
      }
      if (!result.cache_hit) failedDurationMs += result.duration_ms
      correction = correctionForResult(result)
    } catch (err) {
      failedDurationMs += Date.now() - startedAt
      lastError = err
      const details = err as Error & {
        artifactDirectory?: string
        cacheKey?: string
      }
      lastArtifactDirectory = details.artifactDirectory ?? lastArtifactDirectory
      cacheKey = details.cacheKey ?? cacheKey
      if (attempt === maximumAttempts || !isTransientFailure(err)) break
      const correctionMessage = correctableAgentOutputMessage(err)
      if (correctionMessage) {
        correction = correctionMessage
        continue
      }
      await delay(500 * 2 ** (attempt - 1))
    }
  }

  if (lastResult) return lastResult

  return {
    variant: 'revised',
    status: 'failed',
    cache_key: cacheKey,
    cache_hit: false,
    attempts,
    duration_ms: failedDurationMs,
    artifact_directory: lastArtifactDirectory,
    render_path: null,
    preview_path: null,
    render_sha256: null,
    preview_sha256: null,
    intent: null,
    plan: null,
    evaluation_pass: false,
    violations: [],
    render_checks: null,
    blocked_reason: null,
    error: lastError instanceof Error ? lastError.message : String(lastError)
  }
}

async function runArchiveV3Variant({
  fixture,
  artifactRoot,
  timeoutMs,
  codexBin,
  codexVersion,
  model,
  correction
}: ArchiveV3VariantOptions): Promise<StoredArchiveV3Result> {
  const requestJson = serializeAgentVisibleFixture(fixture)
  const prompt = correction
    ? `${buildArchiveV3Prompt(fixture)}\n\nThe previous attempt was rejected by the deterministic pipeline:\n${correction}\nReturn a materially corrected semantic intent. Preserve explicit locks, but do not repeat the rejected failure.`
    : buildArchiveV3Prompt(fixture)
  const cacheKey = await buildArchiveV3CacheKey({
    fixture,
    requestJson,
    prompt,
    codexVersion,
    model
  })
  const caseRoot = join(artifactRoot, 'cache', fixture.id, 'revised')
  const artifactDirectory = join(caseRoot, cacheKey)
  const cached = await readCachedResult(artifactDirectory)
  if (cached) return { ...cached, cache_hit: true }

  await mkdir(caseRoot, { recursive: true })
  const pendingDirectory = await mkdtemp(join(caseRoot, '.pending-'))
  const runDirectory = await mkdtemp(join(tmpdir(), 'meme-archive-v3-'))
  const outputPath = join(runDirectory, 'result.json')
  const outputSchemaPath = join(runDirectory, 'semantic-plan.schema.json')
  const startedAt = Date.now()

  try {
    await stageRunDirectory({
      runDirectory,
      fixture,
      requestJson,
      outputSchemaPath
    })
    const imagePaths = fixture.images.map(({ path }) =>
      join(runDirectory, basename(path))
    )
    const args = buildCodexExecArgs({
      runDirectory,
      outputSchemaPath,
      outputPath,
      imagePaths,
      model
    })
    const executionStartedAt = Date.now()
    const execution = await runChildProcess({
      command: codexBin,
      args,
      cwd: runDirectory,
      stdin: prompt,
      timeoutMs
    })
    const executionDurationMs = Date.now() - executionStartedAt
    await Promise.all([
      writeFile(join(pendingDirectory, 'stdout.log'), execution.stdout, 'utf8'),
      writeFile(join(pendingDirectory, 'stderr.log'), execution.stderr, 'utf8'),
      writeFile(
        join(pendingDirectory, 'invocation.json'),
        `${JSON.stringify(
          {
            command: codexBin,
            args,
            codex_version: codexVersion,
            requested_model: model ?? 'default authenticated session',
            duration_ms: executionDurationMs,
            exit_code: execution.exitCode,
            timed_out: execution.timedOut
          },
          null,
          2
        )}\n`,
        'utf8'
      )
    ])
    if (execution.timedOut) {
      throw new Error(`Codex timed out after ${timeoutMs} ms`)
    }
    if (execution.exitCode !== 0) {
      throw new Error(
        `Codex exited ${execution.exitCode}: ${execution.stderr.slice(-2_000)}`
      )
    }

    const rawOutput = await readFile(outputPath, 'utf8')
    const intent = parseArchiveV3Intent(
      fixture,
      parseStructuredOutput(rawOutput)
    )
    const renderPath = join(pendingDirectory, 'render.png')
    const previewPath = join(pendingDirectory, 'preview.png')
    const renderResult = await renderSafeMemeIntent({
      fixture,
      intent,
      outputPath: renderPath,
      previewPath
    })
    const durationMs = Date.now() - startedAt

    if (renderResult.status === 'blocked') {
      const storedResult: StoredArchiveV3Result = {
        variant: 'revised',
        status: 'blocked',
        cache_key: cacheKey,
        cache_hit: false,
        duration_ms: durationMs,
        artifact_directory: artifactDirectory,
        render_path: null,
        preview_path: null,
        render_sha256: null,
        preview_sha256: null,
        intent,
        plan: null,
        evaluation_pass: false,
        violations: [
          `render.blocked: ${formatBlockedReason(renderResult.reason)}`
        ],
        render_checks: null,
        blocked_reason: renderResult.reason,
        error: null
      }
      await persistResult({
        pendingDirectory,
        requestJson,
        rawOutput,
        storedResult
      })
      await rename(pendingDirectory, artifactDirectory)
      return storedResult
    }

    const evaluation = evaluateMemePlan(fixture, renderResult.plan)
    if (!evaluation.plan) {
      throw new Error(
        'Safe renderer returned a plan outside the runtime schema'
      )
    }
    // V3 replaces the legacy character-count fit estimates and untransformed
    // protected-region geometry with measured compositor evidence. Editorial,
    // source identity, semantic placement, and explicit lock checks stay active.
    const semanticAndLockViolations = evaluation.violations.filter(
      ({ code }) =>
        code !== 'typography.vertical-fit' &&
        code !== 'typography.impossible-wrap' &&
        code !== 'layout.protected-region'
    )
    const violations = semanticAndLockViolations.map(
      ({ code, message }) => `${code}: ${message}`
    )
    const evaluationPass = violations.length === 0
    const storedResult: StoredArchiveV3Result = {
      variant: 'revised',
      status: evaluationPass ? 'complete' : 'invalid',
      cache_key: cacheKey,
      cache_hit: false,
      duration_ms: durationMs,
      artifact_directory: artifactDirectory,
      render_path: join(artifactDirectory, 'render.png'),
      preview_path: join(artifactDirectory, 'preview.png'),
      render_sha256: await sha256File(renderPath),
      preview_sha256: await sha256File(previewPath),
      intent,
      plan: evaluation.plan,
      evaluation_pass: evaluationPass,
      violations,
      render_checks: renderResult.checks,
      blocked_reason: null,
      error: null
    }
    await Promise.all([
      writeFile(
        join(pendingDirectory, 'evaluation.json'),
        `${JSON.stringify(
          {
            pass: storedResult.evaluation_pass,
            violations,
            render_checks: renderResult.checks
          },
          null,
          2
        )}\n`,
        'utf8'
      ),
      persistResult({
        pendingDirectory,
        requestJson,
        rawOutput,
        storedResult
      })
    ])
    await rename(pendingDirectory, artifactDirectory)
    return storedResult
  } catch (err) {
    const failureDirectory = join(
      artifactRoot,
      'failures',
      fixture.id,
      'revised',
      `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    )
    await mkdir(dirname(failureDirectory), { recursive: true })
    await writeFile(
      join(pendingDirectory, 'failure.json'),
      `${JSON.stringify(
        { message: err instanceof Error ? err.message : String(err) },
        null,
        2
      )}\n`,
      'utf8'
    )
    await cp(runDirectory, join(pendingDirectory, 'agent-inputs'), {
      recursive: true,
      force: true
    })
    await rename(pendingDirectory, failureDirectory)
    const wrapped = new Error(
      `${err instanceof Error ? err.message : String(err)}; artifacts: ${failureDirectory}`,
      { cause: err }
    ) as Error & { artifactDirectory?: string; cacheKey?: string }
    wrapped.artifactDirectory = failureDirectory
    wrapped.cacheKey = cacheKey
    throw wrapped
  } finally {
    await rm(runDirectory, { recursive: true, force: true })
  }
}

async function stageRunDirectory({
  runDirectory,
  fixture,
  requestJson,
  outputSchemaPath
}: {
  readonly runDirectory: string
  readonly fixture: MemeSkillFixture
  readonly requestJson: string
  readonly outputSchemaPath: string
}): Promise<void> {
  for (const file of getArchiveV3SkillPackageFiles()) {
    const destination = join(runDirectory, file.destination)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(file.source, destination)
  }
  await Promise.all([
    copyFile(semanticSchemaSource, outputSchemaPath),
    writeFile(join(runDirectory, 'request.json'), requestJson, 'utf8'),
    ...fixture.images.map(({ path }) =>
      copyFile(path, join(runDirectory, basename(path)))
    )
  ])
}

async function persistResult({
  pendingDirectory,
  requestJson,
  rawOutput,
  storedResult
}: {
  readonly pendingDirectory: string
  readonly requestJson: string
  readonly rawOutput: string
  readonly storedResult: StoredArchiveV3Result
}): Promise<void> {
  await Promise.all([
    writeFile(join(pendingDirectory, 'request.json'), requestJson, 'utf8'),
    writeFile(join(pendingDirectory, 'intent.json'), rawOutput, 'utf8'),
    writeFile(
      join(pendingDirectory, 'outcome.json'),
      `${JSON.stringify(storedResult, null, 2)}\n`,
      'utf8'
    )
  ])
}

async function readCachedResult(
  artifactDirectory: string
): Promise<StoredArchiveV3Result | undefined> {
  try {
    const result = JSON.parse(
      await readFile(join(artifactDirectory, 'outcome.json'), 'utf8')
    ) as StoredArchiveV3Result
    if (result.status === 'blocked') return result
    if (
      (result.status !== 'complete' && result.status !== 'invalid') ||
      !result.render_path ||
      !result.preview_path
    ) {
      return undefined
    }
    await Promise.all([stat(result.render_path), stat(result.preview_path)])
    return result
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
}

function isRevisableResult(result: StoredArchiveV3Result): boolean {
  if (result.status === 'invalid') return true
  return (
    result.status === 'blocked' &&
    (result.blocked_reason?.code === 'unplaceable_text' ||
      result.blocked_reason?.code === 'protected_region_conflict')
  )
}

function correctionForResult(result: StoredArchiveV3Result): string {
  if (result.status === 'invalid') {
    return result.violations.join('\n')
  }
  return result.blocked_reason
    ? formatBlockedReason(result.blocked_reason)
    : result.violations.join('\n')
}

function isTransientFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /timed out|rate.?limit|temporar|connection|network|socket|HTTP 429|HTTP 5\d\d|did not match the schema|Expected fixture|unknown source frame|unknown protected region|retained rejected format|not valid JSON|final message was empty|ENOENT.*result\.json|result\.json.*ENOENT/i.test(
    message
  )
}

export function correctableAgentOutputMessage(
  error: unknown
): string | undefined {
  let candidate = error
  while (candidate instanceof Error && candidate.cause instanceof Error) {
    candidate = candidate.cause
  }
  const message =
    candidate instanceof Error ? candidate.message : String(candidate)
  if (/retained rejected format/i.test(message)) {
    return `${message}. The format and semantic mode must agree after normalization. For single or setup-payoff mode, use canon or relabel when collision is rejected. Dialogue, source-native interface, and state contrast require their matching semantic modes; changing only the label will still be rejected.`
  }
  return /did not match the schema|Expected fixture|unknown source frame|unknown protected region|not valid JSON|final message was empty/i.test(
    message
  )
    ? message
    : undefined
}

export function normalizeArchiveV3IntentMetadata(value: unknown) {
  if (!isRecord(value) || !isRecord(value.presentation)) return value
  const presentation = value.presentation
  const mode = presentation.mode
  if (typeof mode !== 'string') return value

  const captionLines = Array.isArray(value.caption_lines)
    ? value.caption_lines.map((line, index) =>
        isRecord(line)
          ? { ...line, role: normalizedCaptionRole(mode, index, line.role) }
          : line
      )
    : value.caption_lines
  const sourceFrames = Array.isArray(presentation.source_frames)
    ? presentation.source_frames.map((frame, index) =>
        isRecord(frame)
          ? {
              ...frame,
              role:
                mode === 'state-contrast'
                  ? index === 0
                    ? 'before'
                    : 'after'
                  : 'single'
            }
          : frame
      )
    : presentation.source_frames

  return {
    ...value,
    format: normalizedFormat(mode, value.format),
    caption_lines: captionLines,
    presentation: { ...presentation, source_frames: sourceFrames }
  }
}

function normalizedCaptionRole(mode: string, index: number, fallback: unknown) {
  if (mode === 'single') return 'only'
  if (mode === 'setup-payoff' || mode === 'state-contrast') {
    return index === 0 ? 'setup' : 'payoff'
  }
  if (mode === 'dialogue') return 'speech'
  return fallback
}

function normalizedFormat(mode: string, fallback: unknown) {
  if (mode === 'state-contrast') return 'state contrast'
  if (mode === 'dialogue') return 'dialogue'
  if (mode === 'source-native') return 'source-native interface'
  return ['dialogue', 'state contrast', 'source-native interface'].includes(
    String(fallback)
  )
    ? 'collision'
    : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatBlockedReason(reason: unknown): string {
  if (typeof reason === 'string') return reason
  if (reason && typeof reason === 'object') {
    const record = reason as { code?: unknown; message?: unknown }
    const parts = [record.code, record.message].filter(
      (value): value is string => typeof value === 'string'
    )
    if (parts.length) return parts.join(': ')
  }
  return JSON.stringify(reason)
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds)
  )
}

async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

export async function runArchiveV3Cli(): Promise<string> {
  const startedAt = new Date().toISOString()
  const selection = await buildArchiveComparisonManifest()
  const requestedIds = new Set(
    (process.env.MEME_SKILL_ARCHIVE_V3_CASES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const limit = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_V3_LIMIT,
    selection.cases.length
  )
  const cases = selection.cases
    .filter(
      ({ case_id, idea_id }) =>
        requestedIds.size === 0 ||
        requestedIds.has(case_id) ||
        requestedIds.has(idea_id)
    )
    .slice(0, limit)
  if (cases.length === 0) throw new Error('No archive v3 cases selected')

  const concurrency = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_V3_CONCURRENCY,
    4
  )
  const { codexVersion, results } = await runArchiveV3Comparison({
    cases,
    concurrency
  })
  const runManifest: ArchiveV3RunManifest = {
    schema_version: 1,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    codex_version: codexVersion,
    requested_model:
      process.env.MEME_SKILL_ARCHIVE_V3_MODEL ||
      process.env.MEME_SKILL_EVAL_MODEL ||
      'default authenticated session',
    concurrency,
    case_count: cases.length,
    selection: { ...selection, cases },
    results
  }
  const manifestPath = join(defaultArchiveV3ArtifactRoot, 'run-manifest.json')
  await mkdir(dirname(manifestPath), { recursive: true })
  const temporaryPath = `${manifestPath}.${randomUUID()}.tmp`
  await writeFile(
    temporaryPath,
    `${JSON.stringify(runManifest, null, 2)}\n`,
    'utf8'
  )
  await rename(temporaryPath, manifestPath)
  return manifestPath
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await runArchiveV3Cli())
}
