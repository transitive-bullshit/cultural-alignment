import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  mergeArchiveV3Manifests,
  runMergeArchiveV3ManifestsCli
} from './merge-v3-manifests'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('archive v3 manifest repair merge', () => {
  it('replaces repaired cases by identity and emits results in baseline selection order', async () => {
    const directory = await temporaryDirectory()
    const basePath = join(directory, 'run-manifest.pass-1.json')
    const repairPath = join(directory, 'run-manifest.json')
    const base = manifest(['case-a', 'case-b', 'case-c'], 'base')
    const repair = manifest(['case-c', 'case-b'], 'repair')
    const originalRepair = `${JSON.stringify(repair, null, 2)}\n`
    await Promise.all([
      writeFile(basePath, `${JSON.stringify(base, null, 2)}\n`, 'utf8'),
      writeFile(repairPath, originalRepair, 'utf8')
    ])

    const result = await mergeArchiveV3Manifests({
      baseManifestPath: basePath,
      repairManifestPath: repairPath,
      outputManifestPath: repairPath,
      expectedBaseCaseCount: 3
    })

    const merged = JSON.parse(await readFile(repairPath, 'utf8'))
    expect(merged.selection).toEqual(base.selection)
    expect(
      merged.results.map(({ case_id }: { case_id: string }) => case_id)
    ).toEqual(['case-a', 'case-b', 'case-c'])
    expect(
      merged.results.map(
        ({ revised }: { revised: { cache_key: string } }) => revised.cache_key
      )
    ).toEqual(['base-case-a', 'repair-case-b', 'repair-case-c'])
    expect({ ...merged, results: [] }).toEqual({ ...base, results: [] })
    expect(result).toEqual({
      outputManifestPath: repairPath,
      caseCount: 3,
      replacedCaseIds: ['case-b', 'case-c'],
      preservedCaseIds: ['case-a']
    })
    expect((await readdir(directory)).sort()).toEqual([
      'run-manifest.json',
      'run-manifest.pass-1.json'
    ])
  })

  it.each([
    {
      name: 'an unknown repair case',
      mutate: (repair: TestManifest) => {
        repair.selection.cases[0] = identity('case-unknown')
        repair.results[0] = result('case-unknown', 'repair')
      },
      message: /unknown repair case case-unknown/i
    },
    {
      name: 'a duplicate selected case',
      mutate: (repair: TestManifest) => {
        repair.selection.cases.push(identity('case-b'))
        repair.results.push(result('case-b', 'repair-duplicate'))
        repair.case_count += 1
      },
      message: /duplicate case_id case-b in repair selection/i
    },
    {
      name: 'a duplicate result case',
      mutate: (repair: TestManifest) => {
        repair.results.push(result('case-b', 'repair-duplicate'))
        repair.selection.cases.push(identity('case-c'))
        repair.case_count += 1
      },
      message: /duplicate case_id case-b in repair results/i
    },
    {
      name: 'a changed idea identity',
      mutate: (repair: TestManifest) => {
        repair.selection.cases[0] = {
          case_id: 'case-b',
          idea_id: 'different-idea'
        }
        repair.results[0] = {
          ...result('case-b', 'repair'),
          idea_id: 'different-idea'
        }
      },
      message: /repair identity for case-b does not match the baseline/i
    }
  ])(
    'refuses $name before changing the output',
    async ({ mutate, message }) => {
      const directory = await temporaryDirectory()
      const basePath = join(directory, 'base.json')
      const repairPath = join(directory, 'repair.json')
      const outputPath = join(directory, 'merged.json')
      const base = manifest(['case-a', 'case-b', 'case-c'], 'base')
      const repair = manifest(['case-b'], 'repair')
      mutate(repair)
      const originalOutput = 'leave this file unchanged\n'
      await Promise.all([
        writeFile(basePath, JSON.stringify(base), 'utf8'),
        writeFile(repairPath, JSON.stringify(repair), 'utf8'),
        writeFile(outputPath, originalOutput, 'utf8')
      ])

      await expect(
        mergeArchiveV3Manifests({
          baseManifestPath: basePath,
          repairManifestPath: repairPath,
          outputManifestPath: outputPath,
          expectedBaseCaseCount: 3
        })
      ).rejects.toThrow(message)

      expect(await readFile(outputPath, 'utf8')).toBe(originalOutput)
      expect(
        (await readdir(directory)).some((name) => name.endsWith('.tmp'))
      ).toBe(false)
    }
  )

  it('requires a structurally complete 50-case baseline by default', async () => {
    const directory = await temporaryDirectory()
    const basePath = join(directory, 'base.json')
    const repairPath = join(directory, 'repair.json')
    await Promise.all([
      writeFile(basePath, JSON.stringify(manifest(['case-a'], 'base')), 'utf8'),
      writeFile(
        repairPath,
        JSON.stringify(manifest(['case-a'], 'repair')),
        'utf8'
      )
    ])

    await expect(
      mergeArchiveV3Manifests({
        baseManifestPath: basePath,
        repairManifestPath: repairPath
      })
    ).rejects.toThrow(/baseline must contain exactly 50 cases/i)
  })

  it('exposes the same merge through a positional CLI', async () => {
    const directory = await temporaryDirectory()
    const basePath = join(directory, 'base.json')
    const repairPath = join(directory, 'repair.json')
    const outputPath = join(directory, 'merged.json')
    const caseIds = Array.from({ length: 50 }, (_, index) => `case-${index}`)
    await Promise.all([
      writeFile(basePath, JSON.stringify(manifest(caseIds, 'base')), 'utf8'),
      writeFile(
        repairPath,
        JSON.stringify(manifest(['case-7', 'case-42'], 'repair')),
        'utf8'
      )
    ])

    const output = JSON.parse(
      await runMergeArchiveV3ManifestsCli([basePath, repairPath, outputPath])
    )

    expect(output).toMatchObject({
      outputManifestPath: outputPath,
      caseCount: 50,
      replacedCaseIds: ['case-7', 'case-42']
    })
    expect(JSON.parse(await readFile(outputPath, 'utf8')).results).toHaveLength(
      50
    )
  })
})

interface TestManifest {
  schema_version: 1
  started_at: string
  completed_at: string
  codex_version: string
  requested_model: string
  concurrency: number
  case_count: number
  selection: {
    schema_version: 1
    cases: { case_id: string; idea_id: string }[]
  }
  results: ReturnType<typeof result>[]
}

function manifest(caseIds: string[], marker: string): TestManifest {
  return {
    schema_version: 1,
    started_at: `${marker}-started`,
    completed_at: `${marker}-completed`,
    codex_version: `${marker}-codex`,
    requested_model: `${marker}-model`,
    concurrency: 1,
    case_count: caseIds.length,
    selection: {
      schema_version: 1,
      cases: caseIds.map(identity)
    },
    results: caseIds.map((caseId) => result(caseId, marker))
  }
}

function identity(caseId: string) {
  return { case_id: caseId, idea_id: `idea-${caseId}` }
}

function result(caseId: string, marker: string) {
  return {
    ...identity(caseId),
    revised: {
      variant: 'revised',
      status: 'complete',
      cache_key: `${marker}-${caseId}`
    }
  }
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'meme-v3-merge-'))
  temporaryDirectories.push(directory)
  return directory
}
