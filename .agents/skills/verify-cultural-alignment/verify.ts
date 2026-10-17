#!/usr/bin/env -S node --import tsx
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { closeSync, existsSync, openSync, writeFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Launches, checks, drives, and stops isolated Cultural Alignment servers for
 * verification. Instance state lives in work/verify/instances/<run>/ and is
 * removed by `stop`; evidence lives in work/verify/evidence/<run>/ and is
 * never removed by this script. See SKILL.md beside this file.
 */

const CLI = '.agents/skills/verify-cultural-alignment/verify.ts'
const HELP = `Usage (from the repository root):
  ${CLI} launch [--dev] [--rebuild]
  ${CLI} doctor [--run=<id>]
  ${CLI} drive <journey.ts>... [--run=<id>] [--headed] [-- <playwright args>]
  ${CLI} list
  ${CLI} stop [--run=<id> | --all]`

const skillDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(skillDir, '../../..')
const verifyRoot = join(repoRoot, 'work/verify')
const instancesRoot = join(verifyRoot, 'instances')
const evidenceRoot = join(verifyRoot, 'evidence')
const buildLockPath = join(verifyRoot, 'build.lock')
const buildRecordPath = join(repoRoot, '.next/verify-build.json')
const buildIdPath = join(repoRoot, '.next/BUILD_ID')
const devLockPath = join(repoRoot, '.next/dev/lock')

/** Paths that cannot change the built site, so editing them needs no rebuild. */
const buildIrrelevantPaths = [
  ':(exclude).agents',
  ':(exclude)docs',
  ':(exclude)tests',
  ':(exclude,glob)**/*.md'
]

type Mode = 'production' | 'development'

type Instance = {
  runId: string
  mode: Mode
  /** Process-group leader; the server runs detached in its own group. */
  pid: number
  port: number
  url: string
  buildId?: string
  fingerprint?: string
  head: string
  startedAt: string
  instanceDir: string
  evidenceDir: string
  serverLog: string
}

type Check = { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }

const [command, ...rest] = process.argv.slice(2)
const separator = rest.indexOf('--')
const args = separator === -1 ? rest : rest.slice(0, separator)
const passthrough = separator === -1 ? [] : rest.slice(separator + 1)
const flags = new Map(
  args
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value] = arg.slice(2).split('=', 2)
      return [key!, value ?? 'true'] as const
    })
)
const positional = args.filter((arg) => !arg.startsWith('--'))

try {
  switch (command) {
    case 'launch':
      await launch(flags.has('dev') ? 'development' : 'production')
      break
    case 'doctor': {
      const checks = await doctor(await resolveInstance(flags.get('run')))
      printChecks(checks)
      if (checks.some(({ status }) => status === 'fail')) process.exitCode = 1
      break
    }
    case 'drive':
      await drive(await resolveInstance(flags.get('run')), positional)
      break
    case 'list':
      await list()
      break
    case 'stop':
      await stop(flags.has('all'))
      break
    default:
      console.log(HELP)
      if (command && command !== 'help') process.exitCode = 1
  }
} catch (err) {
  console.error(`verify: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
}

async function launch(mode: Mode) {
  const runId = `${timestamp()}-${randomBytes(2).toString('hex')}`
  const instanceDir = join(instancesRoot, runId)
  const evidenceDir = join(evidenceRoot, runId)
  await mkdir(instanceDir, { recursive: true })
  await mkdir(evidenceDir, { recursive: true })

  const fingerprint = await sourceFingerprint()
  let buildId: string | undefined

  if (mode === 'production') {
    try {
      buildId = await ensureBuild(fingerprint, evidenceDir)
    } catch (err) {
      await abandonLaunch(instanceDir, evidenceDir)
      throw err
    }
  } else {
    const lock = await readDevLock()
    if (lock && isAlive(lock.pid)) {
      await abandonLaunch(instanceDir, evidenceDir)
      throw new Error(
        `next dev is already running for this checkout (pid ${lock.pid}${lock.url ? `, ${lock.url}` : ''}). ` +
          'Next.js allows one dev server per checkout and it is not ours to drive or stop; launch without --dev instead.'
      )
    }
  }

  const port = await freePort()
  // Bind IPv4 loopback but browse via localhost: YouTube refuses embeds whose
  // origin is an IP address ("This video is unavailable").
  const url = `http://localhost:${port}`
  // Logs stay with the evidence: server errors during a drive are proof too.
  const serverLog = join(evidenceDir, 'server.log')
  const log = openSync(serverLog, 'a')
  // A shell inside `pnpm dev` would otherwise point metadata at Portless.
  const { PORTLESS_URL: _url, PORT: _port, ...inherited } = process.env
  const env = { ...inherited, NEXT_TELEMETRY_DISABLED: '1' }

  // Run Next's CLI directly: pnpm moves its children into their own process
  // groups, which would hide the server from this run's group-based checks.
  const child = spawn(
    process.execPath,
    [
      join(repoRoot, 'node_modules/next/dist/bin/next'),
      mode === 'production' ? 'start' : 'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port)
    ],
    { cwd: repoRoot, detached: true, env, stdio: ['ignore', log, log] }
  )
  child.unref()
  closeSync(log)

  if (!child.pid) throw new Error('The server process did not start')

  const instance: Instance = {
    runId,
    mode,
    pid: child.pid,
    port,
    url,
    buildId,
    fingerprint,
    head: git(['rev-parse', '--short', 'HEAD']).toString().trim(),
    startedAt: new Date().toISOString(),
    instanceDir,
    evidenceDir,
    serverLog
  }
  await writeFile(
    join(instanceDir, 'instance.json'),
    `${JSON.stringify(instance, null, 2)}\n`
  )

  const timeoutMs = mode === 'production' ? 60_000 : 180_000
  const deadline = Date.now() + timeoutMs
  let problems: string[] = []

  while (Date.now() < deadline) {
    if (!isAlive(child.pid)) {
      throw new Error(
        `The server exited before it was ready. Log: ${relative(repoRoot, serverLog)}\n${await tail(serverLog)}`
      )
    }
    problems = await readinessProblems(url)
    if (problems.length === 0) break
    await sleep(500)
  }

  if (problems.length > 0) {
    throw new Error(
      `Not ready after ${timeoutMs / 1000}s (${problems.join('; ')}). ` +
        `The server is still running; stop it with: ${CLI} stop --run=${runId}`
    )
  }

  console.log(
    [
      `run       ${runId}`,
      `mode      ${mode}${buildId ? ` (build ${buildId})` : ''}`,
      `url       ${url}`,
      `evidence  ${relative(repoRoot, evidenceDir)}`,
      `log       ${relative(repoRoot, serverLog)}`,
      `next      ${CLI} doctor --run=${runId}`
    ].join('\n')
  )

  if (mode === 'development') {
    console.log(
      'note      next dev may rewrite the managed block in AGENTS.md; check git status before committing.'
    )
  }
}

/** Removes state from a launch that never started a server; keeps a build log. */
async function abandonLaunch(instanceDir: string, evidenceDir: string) {
  await rm(instanceDir, { recursive: true, force: true })
  if ((await readdir(evidenceDir).catch(() => [])).length === 0) {
    await rm(evidenceDir, { recursive: true, force: true })
  }
}

/** Reuses `.next` when it was built from the current tree; otherwise rebuilds. */
async function ensureBuild(fingerprint: string, evidenceDir: string) {
  const record = await readJson<{ fingerprint: string; buildId: string }>(
    buildRecordPath
  )
  const currentBuildId = await readBuildId()

  if (
    !flags.has('rebuild') &&
    record?.fingerprint === fingerprint &&
    record.buildId === currentBuildId
  ) {
    console.log(`build     reusing ${currentBuildId} (tree unchanged)`)
    return currentBuildId
  }

  const servers = await liveInstances()
  const sharing = servers.filter(({ mode }) => mode === 'production')
  if (sharing.length > 0) {
    throw new Error(
      `Rebuilding would replace .next under running verification servers: ${sharing.map(({ runId }) => runId).join(', ')}. ` +
        `Stop them first (${CLI} stop --run=<id>), or verify from a separate worktree.`
    )
  }
  const foreign = foreignNextProcesses(new Set(servers.map(({ pid }) => pid)))
  if (foreign.length > 0) {
    throw new Error(
      `Another Next.js process is using this checkout (${foreign.join('; ')}). ` +
        'A rebuild would replace its .next output; ask its owner or verify from a separate worktree.'
    )
  }

  await mkdir(verifyRoot, { recursive: true })
  let lock: number
  try {
    lock = openSync(buildLockPath, 'wx')
  } catch {
    const holder = Number((await readFile(buildLockPath, 'utf8')).trim())
    if (isAlive(holder)) {
      throw new Error(
        `Another verification build is running (pid ${holder}); wait for it to finish.`
      )
    }
    await rm(buildLockPath, { force: true })
    lock = openSync(buildLockPath, 'wx')
  }
  writeFileSync(lock, String(process.pid))
  closeSync(lock)

  try {
    const buildLog = join(evidenceDir, 'build.log')
    console.log(`build     pnpm build (log: ${relative(repoRoot, buildLog)})`)
    const log = openSync(buildLog, 'a')
    const result = spawnSync('pnpm', ['build'], {
      cwd: repoRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', log, log]
    })
    closeSync(log)
    if (result.status !== 0) {
      throw new Error(`pnpm build failed:\n${await tail(buildLog)}`)
    }

    const buildId = await readBuildId()
    if (!buildId) throw new Error('pnpm build succeeded without a BUILD_ID')
    await writeFile(
      buildRecordPath,
      `${JSON.stringify({ fingerprint, buildId, builtAt: new Date().toISOString() }, null, 2)}\n`
    )
    return buildId
  } finally {
    await rm(buildLockPath, { force: true })
  }
}

async function doctor(instance: Instance): Promise<Check[]> {
  const checks: Check[] = []
  const add = (name: string, status: Check['status'], detail: string) =>
    checks.push({ name, status, detail })

  add('run', 'pass', `${instance.runId} (${instance.mode}, ${instance.url})`)

  const members = processGroup(instance.pid)
  if (members.length === 0) {
    add('process', 'fail', `process group ${instance.pid} is gone`)
    return checks
  }
  add('process', 'pass', `process group ${instance.pid} is running`)

  const listeners = listenerPids(instance.port)
  if (listeners === undefined) {
    add('port', 'warn', 'lsof is unavailable; port ownership not checked')
  } else if (listeners.length === 0) {
    add('port', 'fail', `nothing listens on ${instance.port}`)
  } else if (
    listeners.every((pid) => members.some((member) => member.pid === pid))
  ) {
    add('port', 'pass', `${instance.port} is owned by this run`)
  } else {
    add(
      'port',
      'fail',
      `${instance.port} is held by pid ${listeners.join(', ')}, outside process group ${instance.pid}`
    )
  }

  const problems = await readinessProblems(instance.url)
  add(
    'http',
    problems.length === 0 ? 'pass' : 'fail',
    problems.length === 0
      ? 'homepage gallery and search index respond'
      : problems.join('; ')
  )

  if (instance.mode === 'production') {
    const onDisk = await readBuildId()
    const html = await fetchText(`${instance.url}/about`)
    const served = html?.match(/\\?"b\\?":\\?"([\w-]+)\\?"/)?.[1]
    if (served !== instance.buildId || onDisk !== instance.buildId) {
      add(
        'build',
        'fail',
        `launched ${instance.buildId}, serving ${served ?? 'unknown'}, on disk ${onDisk ?? 'none'}; something rebuilt .next under this run`
      )
    } else {
      add('build', 'pass', `serving ${served}`)
    }

    const fingerprint = await sourceFingerprint()
    add(
      'source',
      fingerprint === instance.fingerprint ? 'pass' : 'fail',
      fingerprint === instance.fingerprint
        ? `build matches the working tree (HEAD ${instance.head})`
        : 'the working tree changed since this build; stop and relaunch to verify current code'
    )
  } else {
    const lock = await readDevLock()
    add(
      'dev-lock',
      lock && members.some(({ pid }) => pid === lock.pid) ? 'pass' : 'warn',
      lock ? `.next/dev/lock names pid ${lock.pid}` : 'no .next/dev/lock'
    )
  }

  const scenarios = await readJson<{ slug: string }[]>(
    join(repoRoot, 'content/snapshot/scenarios.json')
  )
  const archive = await fetchText(`${instance.url}/scenarios`)
  const linked = new Set(
    [...(archive ?? '').matchAll(/href="\/scenarios\/([^"/?#]+)"/g)].map(
      (match) => match[1]
    )
  )
  const missing = (scenarios ?? []).filter(({ slug }) => !linked.has(slug))
  add(
    'content',
    scenarios && missing.length === 0 ? 'pass' : 'fail',
    scenarios
      ? missing.length === 0
        ? `/scenarios links all ${scenarios.length} snapshot scenarios`
        : `/scenarios is missing ${missing.length} snapshot scenarios (e.g. ${missing[0]!.slug})`
      : 'content/snapshot/scenarios.json is unreadable'
  )

  return checks
}

async function drive(instance: Instance, journeys: string[]) {
  if (journeys.length === 0) throw new Error(`Name a journey file.\n${HELP}`)

  const checks = await doctor(instance)
  if (checks.some(({ status }) => status === 'fail')) {
    printChecks(checks)
    throw new Error('Doctor failed; refusing to drive this instance')
  }

  const files = journeys.map((journey) => resolve(journey))
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`No journey at ${file}`)
  }

  const drives = (await readdir(instance.evidenceDir).catch(() => [])).filter(
    (entry) => /^\d{2}-/.test(entry)
  )
  const name = files
    .map((file) =>
      file
        .split(sep)
        .at(-1)!
        .replace(/\.journey\.ts$/, '')
    )
    .join('+')
  const evidenceDir = join(
    instance.evidenceDir,
    `${String(drives.length + 1).padStart(2, '0')}-${name}`
  )
  await mkdir(evidenceDir, { recursive: true })

  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      join(skillDir, 'playwright.config.ts'),
      ...(flags.has('headed') ? ['--headed'] : []),
      ...passthrough
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        VERIFY_BASE_URL: instance.url,
        VERIFY_EVIDENCE_DIR: evidenceDir,
        VERIFY_JOURNEYS: JSON.stringify(files),
        VERIFY_RUN_ID: instance.runId
      },
      stdio: 'inherit'
    }
  )

  console.log(`evidence  ${relative(repoRoot, evidenceDir)}`)
  if (result.status !== 0) process.exitCode = result.status ?? 1
}

async function list() {
  const instances = await allInstances()
  if (instances.length === 0) {
    console.log('No verification instances in this checkout.')
    return
  }
  for (const instance of instances) {
    const state = processGroup(instance.pid).length > 0 ? 'running' : 'dead'
    console.log(
      `${instance.runId}  ${state}  ${instance.mode}  ${instance.url}  evidence: ${relative(repoRoot, instance.evidenceDir)}`
    )
  }
}

async function stop(all: boolean) {
  const instances = all
    ? await allInstances()
    : [await resolveInstance(flags.get('run'))]

  for (const instance of instances) {
    const members = processGroup(instance.pid)
    if (members.length > 0 && !members.some(isNextProcess)) {
      console.log(
        `${instance.runId}: process group ${instance.pid} no longer runs Next.js; not signalling it`
      )
    } else if (members.length > 0) {
      signalGroup(instance.pid, 'SIGTERM')
      const deadline = Date.now() + 10_000
      while (processGroup(instance.pid).length > 0 && Date.now() < deadline) {
        await sleep(200)
      }
      if (processGroup(instance.pid).length > 0) {
        signalGroup(instance.pid, 'SIGKILL')
      }
    }

    await rm(instance.instanceDir, { recursive: true, force: true })
    console.log(
      `${instance.runId}: stopped; evidence kept in ${relative(repoRoot, instance.evidenceDir)}`
    )
  }

  if (instances.length === 0) console.log('Nothing to stop.')
}

async function readinessProblems(url: string) {
  const problems: string[] = []
  const home = await fetchText(url)

  if (home === undefined) {
    problems.push('GET / failed')
  } else {
    if (!home.includes('data-site-header'))
      problems.push('/ has no site header')
    if (!home.includes('data-spatial-gallery'))
      problems.push('/ has no gallery')
  }

  const index = await fetch(`${url}/content/search-index.json`, {
    signal: AbortSignal.timeout(30_000)
  }).catch(() => undefined)
  if (!index?.ok) problems.push('search index unavailable')

  return problems
}

async function resolveInstance(runId: string | undefined) {
  const instances = await allInstances()

  if (runId) {
    const match = instances.find((instance) => instance.runId === runId)
    if (!match) throw new Error(`No verification instance named ${runId}`)
    return match
  }

  const running = instances.filter(
    (instance) => processGroup(instance.pid).length > 0
  )
  if (running.length === 1) return running[0]!
  if (running.length === 0) {
    throw new Error(`No running verification instance; run ${CLI} launch`)
  }
  throw new Error(
    `Several instances are running (${running.map(({ runId }) => runId).join(', ')}); pass --run=<id>`
  )
}

async function allInstances() {
  const entries = await readdir(instancesRoot).catch(() => [])
  const instances = await Promise.all(
    entries.map((entry) =>
      readJson<Instance>(join(instancesRoot, entry, 'instance.json'))
    )
  )
  return instances.filter((instance): instance is Instance => !!instance)
}

async function liveInstances() {
  return (await allInstances()).filter(
    (instance) => processGroup(instance.pid).length > 0
  )
}

/** Hashes HEAD plus build-relevant uncommitted changes, including untracked files. */
async function sourceFingerprint() {
  const hash = createHash('sha256')
  hash.update(git(['rev-parse', 'HEAD']))
  hash.update(
    git(['diff', 'HEAD', '--binary', '--', '.', ...buildIrrelevantPaths])
  )

  const untracked = git([
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    '.',
    ...buildIrrelevantPaths
  ])
    .toString()
    .split('\0')
    .filter(Boolean)
    .toSorted()

  for (const path of untracked) {
    hash.update(path)
    hash.update(await readFile(join(repoRoot, path)).catch(() => ''))
  }

  return hash.digest('hex').slice(0, 16)
}

function git(gitArgs: string[]) {
  const result = spawnSync('git', gitArgs, {
    cwd: repoRoot,
    maxBuffer: 512 * 1024 * 1024
  })
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')}: ${result.stderr.toString()}`)
  }
  return result.stdout
}

type GroupMember = { pid: number; command: string }

function processGroup(pgid: number): GroupMember[] {
  const result = spawnSync('ps', ['-A', '-o', 'pid=,pgid=,command='], {
    encoding: 'utf8'
  })
  return result.stdout
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((match) => match && Number(match[2]) === pgid)
    .map((match) => ({ pid: Number(match![1]), command: match![3]! }))
}

function isNextProcess({ command }: GroupMember) {
  return /next/.test(command)
}

/** Next.js processes whose working directory is this checkout but not ours. */
function foreignNextProcesses(ownGroups: Set<number>) {
  const result = spawnSync('ps', ['-A', '-o', 'pid=,pgid=,command='], {
    encoding: 'utf8'
  })
  return result.stdout
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(
      (match): match is RegExpMatchArray =>
        !!match &&
        !ownGroups.has(Number(match[2])) &&
        /next-server|next (start|dev|build)/.test(match[3]!)
    )
    .filter((match) => processCwd(Number(match[1])) === repoRoot)
    .map((match) => `pid ${match[1]}: ${match[3]!.slice(0, 60)}`)
}

function processCwd(pid: number) {
  const result = spawnSync(
    'lsof',
    ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
    {
      encoding: 'utf8'
    }
  )
  return result.stdout
    ?.split('\n')
    .find((line) => line.startsWith('n'))
    ?.slice(1)
}

function listenerPids(port: number) {
  const result = spawnSync(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    { encoding: 'utf8' }
  )
  if (result.error) return undefined
  return result.stdout.split('\n').filter(Boolean).map(Number)
}

function signalGroup(pgid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pgid, signal)
  } catch {
    // The group exited between the check and the signal.
  }
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function readDevLock() {
  const text = await readFile(devLockPath, 'utf8').catch(() => undefined)
  if (!text) return undefined
  try {
    const lock = JSON.parse(text) as { pid?: number; url?: string }
    return typeof lock.pid === 'number'
      ? { pid: lock.pid, url: lock.url }
      : undefined
  } catch {
    const pid = Number(text.match(/\d+/)?.[0])
    return Number.isInteger(pid) ? { pid, url: undefined } : undefined
  }
}

async function readBuildId() {
  return (await readFile(buildIdPath, 'utf8').catch(() => undefined))?.trim()
}

async function readJson<T>(path: string) {
  const text = await readFile(path, 'utf8').catch(() => undefined)
  return text === undefined ? undefined : (JSON.parse(text) as T)
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000)
  }).catch(() => undefined)
  return response?.ok ? response.text() : undefined
}

function freePort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() =>
        typeof address === 'object' && address
          ? resolvePort(address.port)
          : reject(new Error('No free port'))
      )
    })
  })
}

async function tail(path: string, lines = 30) {
  const text = await readFile(path, 'utf8').catch(() => '')
  return text.split('\n').slice(-lines).join('\n')
}

function printChecks(checks: Check[]) {
  for (const { name, status, detail } of checks) {
    console.log(
      `${status.toUpperCase().padEnd(4)}  ${name.padEnd(9)} ${detail}`
    )
  }
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15)
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}
