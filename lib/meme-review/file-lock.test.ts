import { access, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { memeReviewLockPath, withMemeReviewFileLock } from './file-lock'

describe('meme review file lock', () => {
  it('serializes operations keyed to the same feedback path', async () => {
    await withTemporaryDirectory('meme-review-lock-', async (path) => {
      const feedbackPath = join(path, 'feedback.json')
      const firstEntered = Promise.withResolvers<void>()
      const releaseFirst = Promise.withResolvers<void>()
      const order: string[] = []

      const first = withMemeReviewFileLock(feedbackPath, async () => {
        order.push('first entered')
        firstEntered.resolve()
        await releaseFirst.promise
        order.push('first exited')
      })
      await firstEntered.promise

      const second = withMemeReviewFileLock(
        feedbackPath,
        async () => {
          order.push('second entered')
        },
        { retryMs: 2, timeoutMs: 500 }
      )

      await new Promise((resolve) => setTimeout(resolve, 15))
      expect(order).toEqual(['first entered'])

      releaseFirst.resolve()
      await Promise.all([first, second])
      expect(order).toEqual(['first entered', 'first exited', 'second entered'])
    })
  })

  it('recovers a lock whose local owner process no longer exists', async () => {
    await withTemporaryDirectory('meme-review-lock-', async (path) => {
      const feedbackPath = join(path, 'feedback.json')
      const lockPath = memeReviewLockPath(feedbackPath)
      await mkdir(lockPath)
      await writeFile(
        join(lockPath, 'owner.json'),
        `${JSON.stringify({
          version: 1,
          token: 'abandoned-owner',
          pid: 2_147_483_647,
          hostname: hostname(),
          acquiredAt: '2000-01-01T00:00:00.000Z'
        })}\n`,
        'utf8'
      )

      let ran = false
      await withMemeReviewFileLock(
        feedbackPath,
        async () => {
          ran = true
        },
        { retryMs: 2, timeoutMs: 500 }
      )

      expect(ran).toBe(true)
      await expect(access(lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('recovers an expired lock even if its PID was reused', async () => {
    await withTemporaryDirectory('meme-review-lock-', async (path) => {
      const feedbackPath = join(path, 'feedback.json')
      const lockPath = memeReviewLockPath(feedbackPath)
      await mkdir(lockPath)
      await writeFile(
        join(lockPath, 'owner.json'),
        `${JSON.stringify({
          version: 1,
          token: 'expired-owner',
          pid: process.pid,
          hostname: hostname(),
          acquiredAt: '2000-01-01T00:00:00.000Z'
        })}\n`,
        'utf8'
      )
      const expiredAt = new Date('2000-01-01T00:00:00.000Z')
      await utimes(lockPath, expiredAt, expiredAt)

      await expect(
        withMemeReviewFileLock(feedbackPath, async () => 'recovered', {
          retryMs: 2,
          staleMs: 10,
          timeoutMs: 500
        })
      ).resolves.toBe('recovered')
    })
  })

  it('serializes contenders that recover the same stale lock', async () => {
    await withTemporaryDirectory('meme-review-lock-', async (path) => {
      const feedbackPath = join(path, 'feedback.json')
      const lockPath = memeReviewLockPath(feedbackPath)
      await mkdir(lockPath)
      await writeFile(
        join(lockPath, 'owner.json'),
        `${JSON.stringify({
          version: 1,
          token: 'shared-abandoned-owner',
          pid: 2_147_483_647,
          hostname: hostname(),
          acquiredAt: '2000-01-01T00:00:00.000Z'
        })}\n`,
        'utf8'
      )

      let active = 0
      let maximumActive = 0
      await Promise.all(
        [1, 2].map(() =>
          withMemeReviewFileLock(
            feedbackPath,
            async () => {
              active += 1
              maximumActive = Math.max(maximumActive, active)
              await new Promise((resolve) => setTimeout(resolve, 10))
              active -= 1
            },
            { retryMs: 2, timeoutMs: 500 }
          )
        )
      )

      expect(maximumActive).toBe(1)
    })
  })

  it('releases the lock when the operation throws', async () => {
    await withTemporaryDirectory('meme-review-lock-', async (path) => {
      const feedbackPath = join(path, 'feedback.json')

      await expect(
        withMemeReviewFileLock(feedbackPath, async () => {
          throw new Error('operation failed')
        })
      ).rejects.toThrow('operation failed')

      await expect(
        withMemeReviewFileLock(feedbackPath, async () => 'reacquired')
      ).resolves.toBe('reacquired')
    })
  })
})

async function withTemporaryDirectory<T>(
  prefix: string,
  operation: (path: string) => Promise<T>
) {
  const path = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await operation(path)
  } finally {
    await rm(path, { recursive: true, force: true })
  }
}
