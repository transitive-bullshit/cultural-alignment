import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'

const ownerFileName = 'owner.json'
const defaultTimeoutMs = 10_000
const defaultRetryMs = 25
const defaultStaleMs = 5 * 60_000

export type MemeReviewFileLockOptions = {
  readonly timeoutMs?: number
  readonly retryMs?: number
  readonly staleMs?: number
}

type LockOwner = {
  readonly version: 1
  readonly token: string
  readonly pid: number
  readonly hostname: string
  readonly acquiredAt: string
}

export class MemeReviewFileLockTimeoutError extends Error {
  readonly lockPath: string

  constructor(lockPath: string) {
    super(`Timed out waiting for meme review lock ${lockPath}`)
    this.name = 'MemeReviewFileLockTimeoutError'
    this.lockPath = lockPath
  }
}

export function memeReviewLockPath(feedbackPath: string) {
  return `${feedbackPath}.lock`
}

/**
 * Serializes feedback mutations with generation publishes across processes.
 * Keep the operation short: an expired owner is assumed abandoned so a dead
 * process, or a reused PID, cannot permanently wedge the review queue.
 */
export async function withMemeReviewFileLock<T>(
  feedbackPath: string,
  operation: () => Promise<T>,
  options: MemeReviewFileLockOptions = {}
): Promise<T> {
  const release = await acquireMemeReviewFileLock(feedbackPath, options)

  try {
    return await operation()
  } finally {
    await release()
  }
}

async function acquireMemeReviewFileLock(
  feedbackPath: string,
  options: MemeReviewFileLockOptions
) {
  const lockPath = memeReviewLockPath(feedbackPath)
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
  const retryMs = options.retryMs ?? defaultRetryMs
  const staleMs = options.staleMs ?? defaultStaleMs
  const startedAt = Date.now()
  const owner: LockOwner = {
    version: 1,
    token: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    acquiredAt: new Date().toISOString()
  }

  assertPositiveDuration('timeoutMs', timeoutMs)
  assertPositiveDuration('retryMs', retryMs)
  assertPositiveDuration('staleMs', staleMs)
  await mkdir(dirname(lockPath), { recursive: true })

  while (true) {
    try {
      await mkdir(lockPath)
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err

      if (await recoverStaleLock(lockPath, staleMs)) continue

      const elapsedMs = Date.now() - startedAt
      if (elapsedMs >= timeoutMs) {
        throw new MemeReviewFileLockTimeoutError(lockPath)
      }

      await delay(Math.min(retryMs, timeoutMs - elapsedMs))
      continue
    }

    try {
      await writeFile(
        join(lockPath, ownerFileName),
        `${JSON.stringify(owner, null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' }
      )
    } catch (err) {
      await rm(lockPath, { recursive: true, force: true })
      throw err
    }

    return () => releaseOwnedLock(lockPath, owner.token)
  }
}

async function releaseOwnedLock(lockPath: string, token: string) {
  await removeLockIfOwned(lockPath, token)
}

async function removeLockIfOwned(lockPath: string, token: string) {
  const owner = await readOwner(lockPath)
  if (owner?.token !== token) return
  await rm(lockPath, { recursive: true, force: true })
}

async function recoverStaleLock(lockPath: string, staleMs: number) {
  const [owner, metadata] = await Promise.all([
    readOwner(lockPath),
    stat(lockPath).catch((err: unknown) => {
      if (isMissingFileError(err)) return null
      throw err
    })
  ])

  if (!metadata) return true

  const ageMs = Date.now() - metadata.mtimeMs
  const stale =
    ageMs >= staleMs ||
    (owner?.hostname === hostname() && !isProcessAlive(owner.pid))

  if (!stale) return false

  const recoveryIdentity = owner?.token
    ? owner.token
    : `${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}`
  const recoveryKey = createHash('sha256')
    .update(recoveryIdentity)
    .digest('hex')
    .slice(0, 16)
  const recoveredPath = `${lockPath}.recovered-${recoveryKey}`
  try {
    await rename(lockPath, recoveredPath)
  } catch (err) {
    if (isMissingFileError(err)) return true
    if (isDestinationExistsError(err)) return false
    throw err
  }

  // Keep the quarantine as a recovery claim. Concurrent contenders that saw
  // the same stale owner cannot subsequently rename a newly acquired lock.
  return true
}

async function readOwner(lockPath: string): Promise<LockOwner | null> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(lockPath, ownerFileName), 'utf8')
    )
    if (!isRecord(value)) return null
    if (
      value.version !== 1 ||
      typeof value.token !== 'string' ||
      typeof value.pid !== 'number' ||
      !Number.isInteger(value.pid) ||
      value.pid <= 0 ||
      typeof value.hostname !== 'string' ||
      typeof value.acquiredAt !== 'string'
    ) {
      return null
    }

    return value as LockOwner
  } catch (err) {
    if (isMissingFileError(err) || err instanceof SyntaxError) return null
    throw err
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return !(
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ESRCH'
    )
  }
}

function assertPositiveDuration(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive duration`)
  }
}

function delay(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

function isAlreadyExistsError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'EEXIST'
  )
}

function isDestinationExistsError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    'code' in err &&
    ['EEXIST', 'ENOTEMPTY'].includes((err as NodeJS.ErrnoException).code ?? '')
  )
}

function isMissingFileError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
