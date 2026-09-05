import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join, resolve } from 'node:path'

import {
  evaluateMemePlan,
  summarizeViolations,
  type MemeEvalResult
} from './evaluate'
import {
  fixtureImagePath,
  memeEvalDirectory,
  memeSkillDirectory,
  workspaceDirectory
} from './fixtures'
import { buildMemeEvalPrompt, serializeAgentVisibleFixture } from './prompt'
import { renderMemeEvalPlan } from './render'
import type { MemeEvalPlan, MemeSkillFixture } from './schema'

export interface CodexMemeEvalOptions {
  readonly fixture: MemeSkillFixture
  readonly codexBin?: string
  readonly model?: string
  readonly timeoutMs?: number
  readonly artifactRoot?: string
}

export interface CodexMemeEvalRun {
  readonly plan: MemeEvalPlan
  readonly evaluation: MemeEvalResult
  readonly artifactDirectory: string
  readonly stdout: string
  readonly stderr: string
  readonly durationMs: number
  readonly renderPath: string
  readonly previewPath: string
}

export function buildCodexExecArgs({
  runDirectory,
  outputSchemaPath,
  outputPath,
  imagePaths,
  model
}: {
  readonly runDirectory: string
  readonly outputSchemaPath: string
  readonly outputPath: string
  readonly imagePaths: readonly string[]
  readonly model?: string
}): string[] {
  const args = [
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--output-schema',
    outputSchemaPath,
    '--output-last-message',
    outputPath,
    '--color',
    'never',
    '--cd',
    runDirectory
  ]

  if (model) args.push('--model', model)
  for (const imagePath of imagePaths) args.push('--image', imagePath)
  args.push('-')
  return args
}

export async function runCodexMemeEval({
  fixture,
  codexBin = process.env.CODEX_BIN || 'codex',
  model = process.env.MEME_SKILL_EVAL_MODEL,
  timeoutMs = readPositiveInteger(
    process.env.MEME_SKILL_EVAL_TIMEOUT_MS,
    180_000
  ),
  artifactRoot = process.env.MEME_SKILL_EVAL_ARTIFACTS ||
    join(workspaceDirectory, 'test-results', 'meme-skill-evals')
}: CodexMemeEvalOptions): Promise<CodexMemeEvalRun> {
  const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
  const artifactDirectory = resolve(artifactRoot, fixture.id, runId)
  const runDirectory = await mkdtemp(join(tmpdir(), 'meme-skill-eval-'))
  const agentFixture: MemeSkillFixture = {
    ...fixture,
    id: `case-${randomUUID().slice(0, 8)}`
  }
  await mkdir(artifactDirectory, { recursive: true })

  const skillPath = join(runDirectory, 'SKILL.md')
  const requestPath = join(runDirectory, 'request.json')
  const outputSchemaPath = join(runDirectory, 'output.schema.json')
  const outputPath = join(runDirectory, 'result.json')
  const renderPath = join(artifactDirectory, 'render.png')
  const previewPath = join(artifactDirectory, 'render-480.png')

  await Promise.all([
    copyFile(join(memeSkillDirectory, 'SKILL.md'), skillPath),
    copyFile(join(memeEvalDirectory, 'output.schema.json'), outputSchemaPath),
    writeFile(requestPath, serializeAgentVisibleFixture(agentFixture), 'utf8'),
    ...fixture.images.map(({ id }) =>
      copyFile(
        fixtureImagePath(fixture, id),
        join(runDirectory, basename(fixtureImagePath(fixture, id)))
      )
    )
  ])

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
  const prompt = buildMemeEvalPrompt(agentFixture)
  const startedAt = Date.now()
  const execution = await runChildProcess({
    command: codexBin,
    args,
    cwd: runDirectory,
    stdin: prompt,
    timeoutMs
  }).catch(async (err: unknown) => {
    await retainRunDirectory(runDirectory, artifactDirectory)
    await writeFile(
      join(artifactDirectory, 'failure.json'),
      `${JSON.stringify(
        {
          stage: 'spawn',
          message: err instanceof Error ? err.message : String(err)
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    throw new Error(`Could not start Codex; artifacts: ${artifactDirectory}`, {
      cause: err
    })
  })
  const durationMs = Date.now() - startedAt

  await retainRunDirectory(runDirectory, artifactDirectory)
  await Promise.all([
    writeFile(join(artifactDirectory, 'stdout.log'), execution.stdout, 'utf8'),
    writeFile(join(artifactDirectory, 'stderr.log'), execution.stderr, 'utf8'),
    writeFile(
      join(artifactDirectory, 'run.json'),
      `${JSON.stringify(
        {
          command: codexBin,
          args,
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
    throw new Error(
      `Codex timed out after ${timeoutMs} ms; artifacts: ${artifactDirectory}`
    )
  }

  if (execution.exitCode !== 0) {
    throw new Error(
      `Codex exited ${execution.exitCode}; artifacts: ${artifactDirectory}\n${execution.stderr.slice(-2_000)}`
    )
  }

  const rawOutput = await readFile(
    join(artifactDirectory, 'result.json'),
    'utf8'
  ).catch((err: unknown) => {
    throw new Error(
      `Codex did not write result.json; artifacts: ${artifactDirectory}`,
      { cause: err }
    )
  })
  let structuredOutput: unknown
  try {
    structuredOutput = parseStructuredOutput(rawOutput)
  } catch (err) {
    throw new Error(
      `Codex result was not valid JSON; artifacts: ${artifactDirectory}`,
      { cause: err }
    )
  }
  const evaluation = evaluateMemePlan(agentFixture, structuredOutput)
  await writeFile(
    join(artifactDirectory, 'evaluation.json'),
    `${JSON.stringify(evaluation, null, 2)}\n`,
    'utf8'
  )
  const plan = evaluation.plan
  if (!plan) {
    throw new Error(
      `Codex result did not match the runtime schema; artifacts: ${artifactDirectory}\n${summarizeViolations(evaluation)}`
    )
  }
  await renderMemeEvalPlan({
    fixture,
    plan,
    outputPath: renderPath,
    previewPath
  })

  return {
    plan,
    evaluation,
    artifactDirectory,
    stdout: execution.stdout,
    stderr: execution.stderr,
    durationMs,
    renderPath,
    previewPath
  }
}

export function parseStructuredOutput(value: string): unknown {
  const trimmed = value.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
    if (!fenced) throw new Error('Codex final message was not valid JSON')
    return JSON.parse(fenced)
  }
}

async function runChildProcess({
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
      // The process group may already be gone; fall through to the child handle.
    }
  }
  fallback(signal)
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

async function retainRunDirectory(
  runDirectory: string,
  artifactDirectory: string
): Promise<void> {
  try {
    await cp(runDirectory, artifactDirectory, {
      recursive: true,
      force: true
    })
  } finally {
    await rm(runDirectory, { recursive: true, force: true })
  }
}
