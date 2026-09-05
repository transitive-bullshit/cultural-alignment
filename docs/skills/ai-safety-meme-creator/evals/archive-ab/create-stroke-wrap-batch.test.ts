import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createStrokeWrapBatch,
  type RecomposeManifest
} from './create-stroke-wrap-batch'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('V5 stroke and balanced-wrap batch', () => {
  it('keeps V4 immutable and withholds the initial manifest until recomposition finishes', async () => {
    const setup = await batchSetup()
    const recomposedSource = '{"version":"v5"}\n'
    const recomposeManifest = vi.fn<RecomposeManifest>(
      async ({ manifestPath }) => {
        await expectMissing(setup.publicManifestPath)
        expect(await readFile(manifestPath, 'utf8')).toBe(setup.v4Source)
        expect(await readFile(setup.v4ManifestPath, 'utf8')).toBe(
          setup.v4Source
        )
        expect(await readFile(setup.frozenBaselinePath, 'utf8')).toBe(
          setup.v4Source
        )
        await writeFile(manifestPath, recomposedSource, 'utf8')
        await expectMissing(setup.publicManifestPath)
        return recompositionResult(manifestPath)
      }
    )

    const result = await createStrokeWrapBatch({
      baselineManifestPath: setup.v4ManifestPath,
      artifactRoot: setup.artifactRoot,
      expectedCaseCount: 1,
      concurrency: 2,
      recomposeManifest
    })

    expect(recomposeManifest).toHaveBeenCalledWith({
      manifestPath: expect.stringContaining('.pending-stroke-wrap-'),
      artifactRoot: setup.artifactRoot,
      expectedCaseCount: 1,
      concurrency: 2
    })
    expect(await readFile(setup.v4ManifestPath, 'utf8')).toBe(setup.v4Source)
    expect(await readFile(setup.frozenBaselinePath, 'utf8')).toBe(
      setup.v4Source
    )
    expect(await readFile(setup.publicManifestPath, 'utf8')).toBe(
      recomposedSource
    )
    expect(
      await readFile(join(setup.artifactRoot, 'sources', 'frame.png'), 'utf8')
    ).toBe('source pixels')
    expect(result).toEqual({
      manifestPath: setup.publicManifestPath,
      baselineManifestPath: setup.frozenBaselinePath,
      backupPath: null,
      caseCount: 1,
      completeCount: 1,
      invalidCount: 0,
      blockedCount: 0
    })
    expect(await pendingDirectories(setup.artifactRoot)).toEqual([])
  })

  it('leaves no public manifest when initial recomposition fails', async () => {
    const setup = await batchSetup()

    await expect(
      createStrokeWrapBatch({
        baselineManifestPath: setup.v4ManifestPath,
        artifactRoot: setup.artifactRoot,
        expectedCaseCount: 1,
        recomposeManifest: async ({ manifestPath }) => {
          await writeFile(manifestPath, '{"partial":true}\n', 'utf8')
          throw new Error('renderer failed')
        }
      })
    ).rejects.toThrow('renderer failed')

    await expectMissing(setup.publicManifestPath)
    expect(await readFile(setup.v4ManifestPath, 'utf8')).toBe(setup.v4Source)
    expect(await readFile(setup.frozenBaselinePath, 'utf8')).toBe(
      setup.v4Source
    )
    expect(await pendingDirectories(setup.artifactRoot)).toEqual([])
  })

  it('reuses the frozen V4 baseline and backs up a prior V5 manifest before replacement', async () => {
    const setup = await batchSetup()
    const frozenSource = '{"version":"frozen-v4"}\n'
    const changedV4Source = '{"version":"changed-v4"}\n'
    const priorV5Source = '{"version":"prior-v5"}\n'
    const nextV5Source = '{"version":"next-v5"}\n'
    await Promise.all([
      writeFile(setup.frozenBaselinePath, frozenSource, 'utf8'),
      writeFile(setup.v4ManifestPath, changedV4Source, 'utf8'),
      writeFile(setup.publicManifestPath, priorV5Source, 'utf8')
    ])

    const result = await createStrokeWrapBatch({
      baselineManifestPath: setup.v4ManifestPath,
      artifactRoot: setup.artifactRoot,
      expectedCaseCount: 1,
      recomposeManifest: async ({ manifestPath }) => {
        expect(await readFile(manifestPath, 'utf8')).toBe(frozenSource)
        expect(await readFile(setup.publicManifestPath, 'utf8')).toBe(
          priorV5Source
        )
        await writeFile(manifestPath, nextV5Source, 'utf8')
        return recompositionResult(manifestPath)
      }
    })

    expect(await readFile(setup.v4ManifestPath, 'utf8')).toBe(changedV4Source)
    expect(await readFile(setup.frozenBaselinePath, 'utf8')).toBe(frozenSource)
    expect(await readFile(setup.publicManifestPath, 'utf8')).toBe(nextV5Source)
    expect(result.backupPath).toMatch(
      /run-manifest\.before-stroke-wrap-.*\.json$/
    )
    expect(await readFile(result.backupPath!, 'utf8')).toBe(priorV5Source)
  })
})

async function batchSetup() {
  const directory = await mkdtemp(join(tmpdir(), 'meme-v5-batch-'))
  temporaryDirectories.push(directory)
  const v4Root = join(directory, 'v4')
  const artifactRoot = join(directory, 'v5')
  const v4ManifestPath = join(v4Root, 'run-manifest.json')
  const v4Source = '{"version":"v4"}\n'
  await Promise.all([
    mkdir(join(v4Root, 'sources'), { recursive: true }),
    mkdir(artifactRoot, { recursive: true })
  ])
  await Promise.all([
    writeFile(v4ManifestPath, v4Source, 'utf8'),
    writeFile(join(v4Root, 'sources', 'frame.png'), 'source pixels', 'utf8')
  ])
  return {
    artifactRoot,
    v4ManifestPath,
    v4Source,
    publicManifestPath: join(artifactRoot, 'run-manifest.json'),
    frozenBaselinePath: join(artifactRoot, 'baseline-v4-manifest.json')
  }
}

function recompositionResult(manifestPath: string) {
  return {
    manifestPath,
    backupPath: `${manifestPath}.internal-backup`,
    caseCount: 1,
    completeCount: 1,
    invalidCount: 0,
    blockedCount: 0
  }
}

async function expectMissing(path: string): Promise<void> {
  await expect(access(path)).rejects.toMatchObject({ code: 'ENOENT' })
}

async function pendingDirectories(artifactRoot: string): Promise<string[]> {
  return (await readdir(artifactRoot)).filter((name) =>
    name.startsWith('.pending-stroke-wrap-')
  )
}
