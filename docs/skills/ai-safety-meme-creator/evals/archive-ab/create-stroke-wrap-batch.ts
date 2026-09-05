import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  recomposeArchiveV3Manifest,
  type RecomposeArchiveV3ManifestResult
} from './recompose-v3-manifest'
import { defaultImpactBatchArtifactRoot } from './create-impact-batch'
import { workspaceDirectory } from './selection'

interface CreateStrokeWrapBatchOptions {
  readonly baselineManifestPath?: string
  readonly artifactRoot?: string
  readonly expectedCaseCount?: number
  readonly concurrency?: number
  readonly recomposeManifest?: RecomposeManifest
}

interface CreateStrokeWrapBatchResult {
  readonly manifestPath: string
  readonly baselineManifestPath: string
  readonly backupPath: string | null
  readonly caseCount: number
  readonly completeCount: number
  readonly invalidCount: number
  readonly blockedCount: number
}

export type RecomposeManifest = (options: {
  readonly manifestPath: string
  readonly artifactRoot: string
  readonly expectedCaseCount: number
  readonly concurrency: number
}) => Promise<RecomposeArchiveV3ManifestResult>

export const defaultArchiveV4ManifestPath = join(
  defaultImpactBatchArtifactRoot,
  'run-manifest.json'
)

export const defaultStrokeWrapBatchArtifactRoot = join(
  workspaceDirectory,
  'test-results',
  'meme-skill-archive-v5-stroke-wrap'
)

export async function createStrokeWrapBatch({
  baselineManifestPath = defaultArchiveV4ManifestPath,
  artifactRoot = defaultStrokeWrapBatchArtifactRoot,
  expectedCaseCount = 50,
  concurrency = 4,
  recomposeManifest = recomposeArchiveV3Manifest
}: CreateStrokeWrapBatchOptions = {}): Promise<CreateStrokeWrapBatchResult> {
  await mkdir(artifactRoot, { recursive: true })
  const manifestPath = join(artifactRoot, 'run-manifest.json')
  const frozenBaselinePath = join(artifactRoot, 'baseline-v4-manifest.json')

  await freezeBaseline(baselineManifestPath, frozenBaselinePath)
  await copyBaselineSources(baselineManifestPath, artifactRoot)

  const pendingDirectory = await mkdtemp(
    join(artifactRoot, '.pending-stroke-wrap-')
  )
  try {
    const pendingManifestPath = join(pendingDirectory, 'run-manifest.json')
    await copyFile(
      frozenBaselinePath,
      pendingManifestPath,
      constants.COPYFILE_EXCL
    )
    const recomposed = await recomposeManifest({
      manifestPath: pendingManifestPath,
      artifactRoot,
      expectedCaseCount,
      concurrency
    })

    await access(pendingManifestPath)
    const backupPath = await backupPriorManifest(manifestPath)
    await rename(pendingManifestPath, manifestPath)

    return {
      manifestPath,
      baselineManifestPath: frozenBaselinePath,
      backupPath,
      caseCount: recomposed.caseCount,
      completeCount: recomposed.completeCount,
      invalidCount: recomposed.invalidCount,
      blockedCount: recomposed.blockedCount
    }
  } finally {
    await rm(pendingDirectory, { recursive: true, force: true })
  }
}

async function freezeBaseline(
  baselineManifestPath: string,
  frozenBaselinePath: string
): Promise<void> {
  try {
    await copyFile(
      baselineManifestPath,
      frozenBaselinePath,
      constants.COPYFILE_EXCL
    )
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return
    throw err
  }
}

async function copyBaselineSources(
  baselineManifestPath: string,
  artifactRoot: string
): Promise<void> {
  const sourceDirectory = join(dirname(baselineManifestPath), 'sources')
  if (!(await pathExists(sourceDirectory))) return
  await cp(sourceDirectory, join(artifactRoot, 'sources'), {
    recursive: true,
    force: false,
    errorOnExist: false
  })
}

async function backupPriorManifest(
  manifestPath: string
): Promise<string | null> {
  let source: Buffer
  try {
    source = await readFile(manifestPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }

  const extension = '.json'
  const stem = basename(manifestPath, extension)
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
  const backupPath = join(
    dirname(manifestPath),
    `${stem}.before-stroke-wrap-${timestamp}-${randomUUID().slice(0, 8)}${extension}`
  )
  await writeFile(backupPath, source, { flag: 'wx' })
  return backupPath
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(JSON.stringify(await createStrokeWrapBatch(), null, 2))
}
