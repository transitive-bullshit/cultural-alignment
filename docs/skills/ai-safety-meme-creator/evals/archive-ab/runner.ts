import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
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
import {
  basename,
  delimiter,
  dirname,
  join,
  relative,
  resolve
} from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import pMap from 'p-map'
import sharp from 'sharp'

import { buildCodexExecArgs, parseStructuredOutput } from '../codex-runner'
import { evaluateMemePlan, summarizeViolations } from '../evaluate'
import { serializeAgentVisibleFixture } from '../prompt'
import { renderMemeEvalPlan } from '../render'
import type { MemeEvalPlan, MemeSkillFixture } from '../schema'

import { buildArchiveFixture } from './case-fixture'
import { projectArchiveFixtureForPlan } from './project-geometry'
import {
  buildArchiveComparisonManifest,
  workspaceDirectory,
  type ArchiveComparisonCase
} from './selection'
import { stageArchiveSources } from './sources'

export type ArchiveAbVariant = 'current' | 'proposed'

export interface ArchiveAbVariantResult {
  readonly variant: ArchiveAbVariant
  readonly status: 'complete' | 'failed'
  readonly cache_key: string
  readonly cache_hit: boolean
  readonly attempts: number
  readonly duration_ms: number
  readonly artifact_directory: string
  readonly render_path: string | null
  readonly preview_path: string | null
  readonly render_sha256: string | null
  readonly preview_sha256: string | null
  readonly plan: MemeEvalPlan | null
  readonly evaluation_pass: boolean
  readonly violations: readonly string[]
  readonly error: string | null
}

export interface ArchiveAbCaseResult {
  readonly case_id: string
  readonly idea_id: string
  readonly order: readonly ArchiveAbVariant[]
  readonly variants: Readonly<Record<ArchiveAbVariant, ArchiveAbVariantResult>>
}

export interface ArchiveAbRunManifest {
  readonly schema_version: 1
  readonly started_at: string
  readonly completed_at: string
  readonly codex_version: string
  readonly requested_model: string
  readonly concurrency: number
  readonly case_count: number
  readonly selection: Awaited<ReturnType<typeof buildArchiveComparisonManifest>>
  readonly results: readonly ArchiveAbCaseResult[]
}

export interface SkillPackageFile {
  readonly source: string
  readonly destination: string
}

const archiveAbDirectory = dirname(fileURLToPath(import.meta.url))
const memeSkillDirectory = resolve(archiveAbDirectory, '../..')
const candidateDirectory = join(archiveAbDirectory, 'candidate')
const outputSchemaSource = resolve(archiveAbDirectory, '../output.schema.json')
const rendererSource = resolve(archiveAbDirectory, '../render.ts')
const frameGeometrySource = resolve(archiveAbDirectory, '../frame-geometry.ts')
const evaluatorSource = resolve(archiveAbDirectory, '../evaluate.ts')
const schemaSource = resolve(archiveAbDirectory, '../schema.ts')
const textLayoutSource = resolve(archiveAbDirectory, '../text-layout.ts')
const runnerVersion = 'archive-ab-v1'

export const defaultArtifactRoot = join(
  workspaceDirectory,
  'test-results',
  'meme-skill-archive-ab'
)

export async function runArchiveAbComparison({
  cases,
  artifactRoot = defaultArtifactRoot,
  concurrency = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_AB_CONCURRENCY,
    4
  ),
  timeoutMs = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_AB_TIMEOUT_MS,
    240_000
  ),
  codexBin = process.env.CODEX_BIN || 'codex',
  model = process.env.MEME_SKILL_ARCHIVE_AB_MODEL ||
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
  readonly results: readonly ArchiveAbCaseResult[]
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
        `[${index + 1}/${cases.length}] ${comparisonCase.idea_id}: starting ${pairOrder(comparisonCase.case_id).join(' → ')}`
      )
      const result = await runCasePair({
        comparisonCase,
        sourcePaths,
        artifactRoot,
        timeoutMs,
        codexBin,
        codexVersion,
        model
      })
      const completeCount = Object.values(result.variants).filter(
        ({ status }) => status === 'complete'
      ).length
      console.log(
        `[${index + 1}/${cases.length}] ${comparisonCase.idea_id}: ${completeCount}/2 complete`
      )
      return result
    },
    { concurrency }
  )
  return { codexVersion, results }
}

export function pairOrder(caseId: string): readonly ArchiveAbVariant[] {
  const value = Number.parseInt(
    createHash('sha256').update(caseId).digest('hex').at(-1)!,
    16
  )
  return value % 2 === 0 ? ['current', 'proposed'] : ['proposed', 'current']
}

export function getSkillPackageFiles(
  variant: ArchiveAbVariant
): readonly SkillPackageFile[] {
  if (variant === 'current') {
    return [
      {
        source: join(memeSkillDirectory, 'SKILL.md'),
        destination: 'SKILL.md'
      },
      ...['editorial.md', 'revision.md', 'composer-contract.md'].map(
        (name) => ({
          source: join(memeSkillDirectory, 'references', name),
          destination: join('references', name)
        })
      )
    ]
  }
  return [
    { source: join(candidateDirectory, 'SKILL.md'), destination: 'SKILL.md' },
    ...[
      'editorial.md',
      'composition.md',
      'revision.md',
      'result-contract.md'
    ].map((name) => ({
      source: join(candidateDirectory, 'references', name),
      destination: join('references', name)
    }))
  ]
}

export function buildArchiveAbPrompt(fixture: MemeSkillFixture): string {
  return `Read ./SKILL.md completely and follow every routed reference it says applies to this request. Then respond to the archived meme request in ./request.json.

The supplied scene facts, caveats, human direction or rejection feedback, protected-region descriptions, and attached pixels are authoritative. Do not browse. Inspect every attached image before deciding. Do not edit files or generate a raster; return one production-ready composition plan matching the required JSON schema.

Geometry contract:
- bounds_pct is [x, y, width, height] in percentages of the final 1200 × 800 canvas
- bounds_pct describes the actual rendered text bounds, not a loose container
- font_size_pct is font size as a percentage of canvas width
- rendered_line_count is the physical line count after wrapping
- source_frames is in reading order and uses only image IDs from request.json
- line_indexes are zero-based indexes into caption_lines and every caption line appears exactly once
- indent_levels has one entry per line_index
- anchor_region_id is the protected speaker or subject ID a zone belongs to, or null
- recognition_hinge.region_ids names every must-preserve region essential to recognition
- backdrop and contrast agree: none/outlined, edge-gradient/edge-gradient, solid-panel/solid-panel, or source-native/source-native
- palette is required for every zone; use default unless the human feedback explicitly asks for orange background with white text, then use orange-white with a solid-panel backdrop
- canonical-quote means exact supplied canon; intentional-rewrite means exact user-supplied or knowingly rewritten wording; original means newly generated copy

The comparison harness will apply the same deterministic renderer to both skill variants. Do not include test commentary in meme copy or rationale.

Fixture identity: ${fixture.id}
Return JSON only.`
}

async function runCasePair({
  comparisonCase,
  sourcePaths,
  artifactRoot,
  timeoutMs,
  codexBin,
  codexVersion,
  model
}: {
  readonly comparisonCase: ArchiveComparisonCase
  readonly sourcePaths: ReadonlyMap<string, string>
  readonly artifactRoot: string
  readonly timeoutMs: number
  readonly codexBin: string
  readonly codexVersion: string
  readonly model?: string
}): Promise<ArchiveAbCaseResult> {
  const fixture = buildArchiveFixture(comparisonCase, sourcePaths)
  const order = pairOrder(comparisonCase.case_id)
  const variants = {} as Record<ArchiveAbVariant, ArchiveAbVariantResult>
  for (const variant of order) {
    variants[variant] = await runVariantWithRetries({
      fixture,
      variant,
      artifactRoot,
      timeoutMs,
      codexBin,
      codexVersion,
      model
    })
  }
  return {
    case_id: comparisonCase.case_id,
    idea_id: comparisonCase.idea_id,
    order,
    variants
  }
}

async function runVariantWithRetries(
  options: Parameters<typeof runVariant>[0]
): Promise<ArchiveAbVariantResult> {
  const maximumAttempts = 3
  let lastError: unknown
  let durationMs = 0
  let lastArtifactDirectory = ''
  let cacheKey = ''
  let attempts = 0
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    attempts = attempt
    const startedAt = Date.now()
    try {
      const result = await runVariant(options)
      return {
        ...result,
        attempts: result.cache_hit ? 0 : attempt,
        duration_ms: result.cache_hit
          ? result.duration_ms
          : durationMs + result.duration_ms
      }
    } catch (err) {
      durationMs += Date.now() - startedAt
      lastError = err
      const details = err as Error & {
        artifactDirectory?: string
        cacheKey?: string
      }
      lastArtifactDirectory = details.artifactDirectory ?? lastArtifactDirectory
      cacheKey = details.cacheKey ?? cacheKey
      if (attempt === maximumAttempts || !isTransientFailure(err)) break
      await delay(500 * 2 ** (attempt - 1))
    }
  }
  return {
    variant: options.variant,
    status: 'failed',
    cache_key: cacheKey,
    cache_hit: false,
    attempts,
    duration_ms: durationMs,
    artifact_directory: lastArtifactDirectory,
    render_path: null,
    preview_path: null,
    render_sha256: null,
    preview_sha256: null,
    plan: null,
    evaluation_pass: false,
    violations: [],
    error: lastError instanceof Error ? lastError.message : String(lastError)
  }
}

async function runVariant({
  fixture,
  variant,
  artifactRoot,
  timeoutMs,
  codexBin,
  codexVersion,
  model
}: {
  readonly fixture: MemeSkillFixture
  readonly variant: ArchiveAbVariant
  readonly artifactRoot: string
  readonly timeoutMs: number
  readonly codexBin: string
  readonly codexVersion: string
  readonly model?: string
}): Promise<Omit<ArchiveAbVariantResult, 'attempts'>> {
  const requestJson = serializeAgentVisibleFixture(fixture)
  const prompt = buildArchiveAbPrompt(fixture)
  const cacheKey = await buildVariantCacheKey({
    fixture,
    variant,
    requestJson,
    prompt,
    codexVersion,
    model
  })
  const variantRoot = join(artifactRoot, 'cache', fixture.id, variant)
  const artifactDirectory = join(variantRoot, cacheKey)
  const cached = await readCachedResult(artifactDirectory)
  if (cached) return { ...cached, cache_hit: true }

  await mkdir(variantRoot, { recursive: true })
  const pendingDirectory = await mkdtemp(join(variantRoot, '.pending-'))
  const runDirectory = await mkdtemp(join(tmpdir(), 'meme-archive-ab-'))
  const outputPath = join(runDirectory, 'result.json')
  const outputSchemaPath = join(runDirectory, 'output.schema.json')
  const startedAt = Date.now()

  try {
    await stageRunDirectory({
      runDirectory,
      fixture,
      variant,
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
    const execution = await runChildProcess({
      command: codexBin,
      args,
      cwd: runDirectory,
      stdin: prompt,
      timeoutMs
    })
    const durationMs = Date.now() - startedAt
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
            duration_ms: durationMs,
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
    const structuredOutput = parseStructuredOutput(rawOutput)
    const initialEvaluation = evaluateMemePlan(fixture, structuredOutput)
    if (!initialEvaluation.plan) {
      throw new Error(
        `Codex output did not match the plan schema: ${summarizeViolations(initialEvaluation)}`
      )
    }
    const unknownFrame = initialEvaluation.violations.find(
      ({ code }) => code === 'frame.known-image'
    )
    if (unknownFrame) {
      throw new Error(`Agent contract violation: ${unknownFrame.message}`)
    }
    const projection = await projectArchiveFixtureForPlan(
      fixture,
      initialEvaluation.plan
    )
    const evaluation = evaluateMemePlan(projection.fixture, structuredOutput)
    if (!evaluation.plan) {
      throw new Error(
        `Codex output did not match the plan schema: ${summarizeViolations(evaluation)}`
      )
    }
    const renderPath = join(pendingDirectory, 'render.png')
    const previewPngPath = join(pendingDirectory, 'preview.png')
    const previewPath = join(pendingDirectory, 'preview.webp')
    await renderMemeEvalPlan({
      fixture,
      plan: evaluation.plan,
      outputPath: renderPath,
      previewPath: previewPngPath
    })
    await sharp(previewPngPath).webp({ quality: 82 }).toFile(previewPath)
    const visibilityViolations = projection.visibilityViolations.map(
      (message) => ({ code: 'frame.protected-visible' as const, message })
    )
    const combinedEvaluation = {
      ...evaluation,
      pass: evaluation.pass && visibilityViolations.length === 0,
      violations: [...evaluation.violations, ...visibilityViolations]
    }
    const violations = combinedEvaluation.violations.map(
      ({ code, message }) => `${code}: ${message}`
    )
    const storedResult = {
      variant,
      status: 'complete' as const,
      cache_key: cacheKey,
      cache_hit: false,
      duration_ms: durationMs,
      artifact_directory: artifactDirectory,
      render_path: join(artifactDirectory, 'render.png'),
      preview_path: join(artifactDirectory, 'preview.webp'),
      render_sha256: await sha256File(renderPath),
      preview_sha256: await sha256File(previewPath),
      plan: evaluation.plan,
      evaluation_pass: combinedEvaluation.pass,
      violations,
      error: null
    }
    await Promise.all([
      writeFile(join(pendingDirectory, 'result.json'), rawOutput, 'utf8'),
      writeFile(
        join(pendingDirectory, 'evaluation.json'),
        `${JSON.stringify(combinedEvaluation, null, 2)}\n`,
        'utf8'
      ),
      writeFile(
        join(pendingDirectory, 'complete.json'),
        `${JSON.stringify(storedResult, null, 2)}\n`,
        'utf8'
      ),
      writeFile(join(pendingDirectory, 'request.json'), requestJson, 'utf8')
    ])
    await rename(pendingDirectory, artifactDirectory)
    return storedResult
  } catch (err) {
    const failureDirectory = join(
      artifactRoot,
      'failures',
      fixture.id,
      variant,
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

export async function buildVariantCacheKey({
  fixture,
  variant,
  requestJson,
  prompt,
  codexVersion,
  model
}: {
  readonly fixture: MemeSkillFixture
  readonly variant: ArchiveAbVariant
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
  for (const path of [
    outputSchemaSource,
    rendererSource,
    frameGeometrySource,
    evaluatorSource,
    schemaSource,
    textLayoutSource,
    fileURLToPath(new URL('./project-geometry.ts', import.meta.url))
  ]) {
    hash.update(relative(workspaceDirectory, path))
    hash.update(await readFile(path))
  }
  for (const file of getSkillPackageFiles(variant)) {
    hash.update(file.destination)
    hash.update(await readFile(file.source))
  }
  for (const image of fixture.images) {
    hash.update(image.id)
    hash.update(await readFile(image.path))
  }
  return hash.digest('hex')
}

async function stageRunDirectory({
  runDirectory,
  fixture,
  variant,
  requestJson,
  outputSchemaPath
}: {
  readonly runDirectory: string
  readonly fixture: MemeSkillFixture
  readonly variant: ArchiveAbVariant
  readonly requestJson: string
  readonly outputSchemaPath: string
}): Promise<void> {
  const packageFiles = getSkillPackageFiles(variant)
  for (const file of packageFiles) {
    const destination = join(runDirectory, file.destination)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(file.source, destination)
  }
  await Promise.all([
    copyFile(outputSchemaSource, outputSchemaPath),
    writeFile(join(runDirectory, 'request.json'), requestJson, 'utf8'),
    ...fixture.images.map(({ path }) =>
      copyFile(path, join(runDirectory, basename(path)))
    )
  ])
}

async function readCachedResult(
  artifactDirectory: string
): Promise<Omit<ArchiveAbVariantResult, 'attempts'> | undefined> {
  try {
    const result = JSON.parse(
      await readFile(join(artifactDirectory, 'complete.json'), 'utf8')
    ) as Omit<ArchiveAbVariantResult, 'attempts'>
    if (
      result.status !== 'complete' ||
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

export async function readCodexVersion(codexBin: string): Promise<string> {
  const result = await runChildProcess({
    command: codexBin,
    args: ['--version'],
    cwd: workspaceDirectory,
    stdin: '',
    timeoutMs: 10_000
  })
  if (result.exitCode !== 0 || result.timedOut) {
    throw new Error(`Could not read Codex version: ${result.stderr}`)
  }
  return result.stdout.trim() || result.stderr.trim()
}

export async function runChildProcess({
  command,
  args,
  cwd,
  stdin,
  timeoutMs
}: {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly stdin: string
  readonly timeoutMs: number
}): Promise<{
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
  readonly timedOut: boolean
}> {
  return new Promise((resolvePromise, rejectPromise) => {
    const detached = process.platform !== 'win32'
    const child = spawn(command, args, {
      cwd,
      env: buildCodexEnvironment(cwd),
      detached,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)

    let forceKill: NodeJS.Timeout | undefined
    const timeout = setTimeout(() => {
      timedOut = true
      signalChildProcess(child.pid, child.kill.bind(child), 'SIGTERM', detached)
      forceKill = setTimeout(
        () =>
          signalChildProcess(
            child.pid,
            child.kill.bind(child),
            'SIGKILL',
            detached
          ),
        2_000
      )
      forceKill.unref()
    }, timeoutMs)
    timeout.unref()
    child.on('close', (exitCode) => {
      clearTimeout(timeout)
      if (forceKill) clearTimeout(forceKill)
      resolvePromise({ stdout, stderr, exitCode, timedOut })
    })
    child.stdin.end(stdin)
  })
}

function buildCodexEnvironment(cwd: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, PWD: cwd }
  for (const key of Object.keys(environment)) {
    if (/^npm_/i.test(key) || key === 'INIT_CWD' || key === 'OLDPWD') {
      delete environment[key]
    }
  }
  if (environment.PATH) {
    environment.PATH = environment.PATH.split(delimiter)
      .filter((entry) => !entry.startsWith(workspaceDirectory))
      .join(delimiter)
  }
  return environment
}

function signalChildProcess(
  pid: number | undefined,
  fallback: (signal: NodeJS.Signals) => boolean,
  signal: NodeJS.Signals,
  detached: boolean
) {
  if (detached && pid) {
    try {
      process.kill(-pid, signal)
      return
    } catch {
      // The child may already be gone.
    }
  }
  fallback(signal)
}

function isTransientFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /timed out|rate.?limit|temporar|connection|network|socket|HTTP 429|HTTP 5\d\d|did not match the plan schema|agent contract|not valid JSON|final message was empty|ENOENT.*result\.json|result\.json.*ENOENT/i.test(
    message
  )
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

export async function runArchiveAbCli(): Promise<string> {
  const startedAt = new Date().toISOString()
  const manifest = await buildArchiveComparisonManifest()
  const requestedIds = new Set(
    (process.env.MEME_SKILL_ARCHIVE_AB_CASES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const limit = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_AB_LIMIT,
    manifest.cases.length
  )
  const cases = manifest.cases
    .filter(
      ({ case_id, idea_id }) =>
        requestedIds.size === 0 ||
        requestedIds.has(case_id) ||
        requestedIds.has(idea_id)
    )
    .slice(0, limit)
  if (cases.length === 0) throw new Error('No archive A/B cases selected')
  const concurrency = positiveInteger(
    process.env.MEME_SKILL_ARCHIVE_AB_CONCURRENCY,
    4
  )
  const { codexVersion, results } = await runArchiveAbComparison({
    cases,
    concurrency
  })
  const runManifest: ArchiveAbRunManifest = {
    schema_version: 1,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    codex_version: codexVersion,
    requested_model:
      process.env.MEME_SKILL_ARCHIVE_AB_MODEL ||
      process.env.MEME_SKILL_EVAL_MODEL ||
      'default authenticated session',
    concurrency,
    case_count: cases.length,
    selection: { ...manifest, cases },
    results
  }
  const runManifestPath = join(defaultArtifactRoot, 'run-manifest.json')
  await mkdir(dirname(runManifestPath), { recursive: true })
  const temporaryPath = `${runManifestPath}.${randomUUID()}.tmp`
  await writeFile(
    temporaryPath,
    `${JSON.stringify(runManifest, null, 2)}\n`,
    'utf8'
  )
  await rename(temporaryPath, runManifestPath)
  return runManifestPath
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await runArchiveAbCli())
}
