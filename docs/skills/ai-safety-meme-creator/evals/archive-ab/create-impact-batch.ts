import { constants } from 'node:fs'
import { access, copyFile, cp, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  defaultArchiveV3ManifestPath,
  recomposeArchiveV3Manifest
} from './recompose-v3-manifest'
import { workspaceDirectory } from './selection'

interface CreateImpactBatchOptions {
  readonly baselineManifestPath?: string
  readonly artifactRoot?: string
  readonly expectedCaseCount?: number
  readonly concurrency?: number
}

export const defaultImpactBatchArtifactRoot = join(
  workspaceDirectory,
  'test-results',
  'meme-skill-archive-v4-impact'
)

export async function createImpactBatch({
  baselineManifestPath = defaultArchiveV3ManifestPath,
  artifactRoot = defaultImpactBatchArtifactRoot,
  expectedCaseCount = 50,
  concurrency = 4
}: CreateImpactBatchOptions = {}) {
  await mkdir(artifactRoot, { recursive: true })
  const manifestPath = join(artifactRoot, 'run-manifest.json')
  const frozenBaselinePath = join(artifactRoot, 'baseline-v3-manifest.json')

  if (!(await pathExists(frozenBaselinePath))) {
    await copyFile(
      baselineManifestPath,
      frozenBaselinePath,
      constants.COPYFILE_EXCL
    )
  }
  if (!(await pathExists(manifestPath))) {
    await copyFile(frozenBaselinePath, manifestPath, constants.COPYFILE_EXCL)
  }

  const baselineSourceDirectory = join(dirname(baselineManifestPath), 'sources')
  if (await pathExists(baselineSourceDirectory)) {
    await cp(baselineSourceDirectory, join(artifactRoot, 'sources'), {
      recursive: true,
      force: false,
      errorOnExist: false
    })
  }

  const result = await recomposeArchiveV3Manifest({
    manifestPath,
    artifactRoot,
    expectedCaseCount,
    concurrency
  })
  return { ...result, baselineManifestPath: frozenBaselinePath }
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
  console.log(JSON.stringify(await createImpactBatch(), null, 2))
}
