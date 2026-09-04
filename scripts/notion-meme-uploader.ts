import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { Client, isNotionClientError } from '@notionhq/client'
import pMap from 'p-map'
import { z } from 'zod'

export const NOTION_MEME_API_VERSION = '2026-03-11'
export const NOTION_MEMES_PROPERTY = 'Memes'
export const MAX_NOTION_FILES_PER_PROPERTY = 100

const sha256Schema = z.string().regex(/^[a-f\d]{64}$/i)
const safeFilenameSchema = z
  .string()
  .min(1)
  .max(900)
  .refine((value) => basename(value) === value, 'must be a basename')
  .refine(
    (value) =>
      ['.jpg', '.jpeg', '.webp'].includes(extname(value).toLowerCase()),
    'must be a JPEG or WebP filename'
  )

export const finalizedMemeExportFileSchema = z.object({
  scenarioSlug: z.string().min(1),
  ideaId: z.string().min(1),
  revisionKey: z.string().min(1),
  payloadFingerprint: z.string().min(1),
  path: z.string().min(1).refine(isAbsolute, 'must be an absolute path'),
  filename: safeFilenameSchema,
  sha256: sha256Schema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  terminalPeriodsRemoved: z.number().int().nonnegative()
})

export const finalizedMemeExportManifestSchema = z.object({
  schemaVersion: z.literal(1),
  files: z.array(finalizedMemeExportFileSchema)
})

const scenarioSnapshotSchema = z.array(
  z.object({
    id: z.string().min(1),
    slug: z.string().min(1)
  })
)

const checkpointEntrySchema = z.object({
  scenarioSlug: z.string().min(1),
  pageId: z.string().min(1),
  filename: z.string().min(1),
  sha256: sha256Schema,
  fileUploadId: z.string().min(1).optional(),
  state: z.enum(['uploaded', 'attached', 'already-present']),
  updatedAt: z.string().datetime()
})

const checkpointSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime(),
  entries: z.record(z.string(), checkpointEntrySchema)
})

export type FinalizedMemeExportFile = z.infer<
  typeof finalizedMemeExportFileSchema
>
export type FinalizedMemeExportManifest = z.infer<
  typeof finalizedMemeExportManifestSchema
>
type CheckpointEntry = z.infer<typeof checkpointEntrySchema>
type UploadCheckpoint = z.infer<typeof checkpointSchema>

export type ExistingNotionFile =
  | {
      type: 'file'
      name: string
      file: { url: string; expiry_time?: string }
    }
  | { type: 'external'; name: string; external: { url: string } }

type InternalNotionFile = Extract<ExistingNotionFile, { type: 'file' }>

export type NewNotionFile = {
  type: 'file_upload'
  name: string
  file_upload: { id: string }
}

export type ScenarioUpload = {
  scenarioSlug: string
  pageId: string
  files: FinalizedMemeExportFile[]
}

export type ScenarioAppendPlan = {
  existing: ExistingNotionFile[]
  alreadyPresent: FinalizedMemeExportFile[]
  missing: FinalizedMemeExportFile[]
  finalCount: number
}

export type ScenarioReplacementPlan = {
  existing: ExistingNotionFile[]
  targets: FinalizedMemeExportFile[]
  finalCount: number
}

type RetrievedFiles = {
  propertyId: string
  files: ExistingNotionFile[]
}

export interface NotionMemeGateway {
  retrievePage(pageId: string): Promise<unknown>
  retrievePageProperty(pageId: string, propertyId: string): Promise<unknown>
  createFileUpload(input: {
    filename: string
    contentType: string
  }): Promise<{ id: string; status: string }>
  sendFileUpload(input: {
    fileUploadId: string
    filename: string
    contentType: string
    bytes: Uint8Array
  }): Promise<{ id: string; status: string }>
  retrieveFileUpload(fileUploadId: string): Promise<{
    id: string
    status: string
    expiryTime: string | null
  }>
  downloadFile(url: string): Promise<Uint8Array>
  updateMemes(
    pageId: string,
    files: (ExistingNotionFile | NewNotionFile)[]
  ): Promise<void>
}

export type RunNotionMemeUploadOptions = {
  manifestPath: string
  scenariosPath: string
  checkpointPath: string
  apply: boolean
  replaceExisting?: boolean
  concurrency: number
  retries: number
  token: string
  log?: (message: string) => void
}

export type UploadSummary = {
  mode: 'dry-run' | 'apply'
  operation: 'append' | 'replace'
  scenarioCount: number
  fileCount: number
  alreadyPresentCount: number
  uploadedCount: number
  attachedCount: number
  replacedCount: number
}

export function parseFinalizedMemeExportManifest(input: unknown) {
  const manifest = finalizedMemeExportManifestSchema.parse(input)
  const seen = new Set<string>()

  for (const file of manifest.files) {
    if (seen.has(file.filename)) {
      throw new Error(`Duplicate export filename: ${file.filename}`)
    }
    seen.add(file.filename)
  }

  return manifest
}

export function bindManifestToScenarios(
  manifest: FinalizedMemeExportManifest,
  snapshotInput: unknown
): ScenarioUpload[] {
  const scenarios = scenarioSnapshotSchema.parse(snapshotInput)
  const pageIdBySlug = new Map<string, string>()

  for (const scenario of scenarios) {
    if (pageIdBySlug.has(scenario.slug)) {
      throw new Error(`Duplicate scenario slug in snapshot: ${scenario.slug}`)
    }
    pageIdBySlug.set(scenario.slug, scenario.id)
  }

  const filesBySlug = new Map<string, FinalizedMemeExportFile[]>()
  for (const file of manifest.files) {
    if (!pageIdBySlug.has(file.scenarioSlug)) {
      throw new Error(
        `Export references unknown scenario slug: ${file.scenarioSlug}`
      )
    }
    const files = filesBySlug.get(file.scenarioSlug) ?? []
    files.push(file)
    filesBySlug.set(file.scenarioSlug, files)
  }

  return [...filesBySlug]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([scenarioSlug, files]) => ({
      scenarioSlug,
      pageId: pageIdBySlug.get(scenarioSlug)!,
      files: files.toSorted((left, right) =>
        left.filename.localeCompare(right.filename)
      )
    }))
}

export function planScenarioAppend(
  scenario: ScenarioUpload,
  existing: readonly ExistingNotionFile[]
): ScenarioAppendPlan {
  const existingNames = new Set(existing.map((file) => file.name))
  const alreadyPresent = scenario.files.filter((file) =>
    existingNames.has(file.filename)
  )
  const missing = scenario.files.filter(
    (file) => !existingNames.has(file.filename)
  )
  const finalCount = existing.length + missing.length

  if (finalCount > MAX_NOTION_FILES_PER_PROPERTY) {
    throw new Error(
      `${scenario.scenarioSlug} would have ${finalCount} files in “${NOTION_MEMES_PROPERTY}”; Notion accepts at most ${MAX_NOTION_FILES_PER_PROPERTY}`
    )
  }

  return {
    existing: [...existing],
    alreadyPresent,
    missing,
    finalCount
  }
}

export function appendUploadedFiles(
  existing: readonly ExistingNotionFile[],
  uploads: readonly { filename: string; fileUploadId: string }[]
): (ExistingNotionFile | NewNotionFile)[] {
  const existingNames = new Set(existing.map((file) => file.name))
  const appended = uploads
    .filter((upload) => !existingNames.has(upload.filename))
    .map((upload): NewNotionFile => ({
      type: 'file_upload',
      name: upload.filename,
      file_upload: { id: upload.fileUploadId }
    }))

  return [...existing, ...appended]
}

export function planScenarioReplacement(
  scenario: ScenarioUpload,
  existing: readonly ExistingNotionFile[]
): ScenarioReplacementPlan {
  for (const target of scenario.files) {
    const matchCount = existing.filter(
      (file) => file.name === target.filename
    ).length
    if (matchCount === 0) {
      throw new Error(
        `${scenario.scenarioSlug} does not contain attachment ${target.filename}; replacement refuses to append a missing target`
      )
    }
    if (matchCount !== 1) {
      throw new Error(
        `${scenario.scenarioSlug} contains ${matchCount} attachments named ${target.filename}; replacement requires exactly one`
      )
    }
  }

  return {
    existing: [...existing],
    targets: [...scenario.files],
    finalCount: existing.length
  }
}

export function replaceUploadedFiles(
  existing: readonly ExistingNotionFile[],
  uploads: readonly { filename: string; fileUploadId: string }[]
): (ExistingNotionFile | NewNotionFile)[] {
  const uploadByName = new Map<string, string>()
  for (const upload of uploads) {
    if (uploadByName.has(upload.filename)) {
      throw new Error(`Duplicate replacement filename: ${upload.filename}`)
    }
    uploadByName.set(upload.filename, upload.fileUploadId)
  }

  const matchCountByName = new Map<string, number>()
  const next = existing.map((file): ExistingNotionFile | NewNotionFile => {
    const fileUploadId = uploadByName.get(file.name)
    if (!fileUploadId) return file

    matchCountByName.set(file.name, (matchCountByName.get(file.name) ?? 0) + 1)
    return {
      type: 'file_upload',
      name: file.name,
      file_upload: { id: fileUploadId }
    }
  })

  for (const filename of uploadByName.keys()) {
    const matchCount = matchCountByName.get(filename) ?? 0
    if (matchCount !== 1) {
      throw new Error(
        `Cannot replace ${filename}: expected exactly one existing attachment, received ${matchCount}`
      )
    }
  }

  return next
}

export function assertAppendVerified(input: {
  before: readonly ExistingNotionFile[]
  expectedNames: readonly string[]
  after: readonly ExistingNotionFile[]
}) {
  const beforeCounts = countFileIdentities(input.before)
  const afterCounts = countFileIdentities(input.after)

  for (const [identity, count] of beforeCounts) {
    if ((afterCounts.get(identity) ?? 0) < count) {
      throw new Error(
        `Notion verification failed: an existing “${NOTION_MEMES_PROPERTY}” file was not preserved (${identity})`
      )
    }
  }

  const afterNames = new Set(input.after.map((file) => file.name))
  for (const filename of input.expectedNames) {
    if (!afterNames.has(filename)) {
      throw new Error(
        `Notion verification failed: ${filename} is missing from “${NOTION_MEMES_PROPERTY}”`
      )
    }
  }
}

export function assertReplacementVerified(input: {
  before: readonly ExistingNotionFile[]
  targetNames: readonly string[]
  after: readonly ExistingNotionFile[]
}) {
  const targets = new Set(input.targetNames)
  if (targets.size !== input.targetNames.length) {
    throw new Error('Replacement verification received duplicate target names')
  }

  const unrelatedBefore = input.before.filter((file) => !targets.has(file.name))
  const unrelatedAfter = input.after.filter((file) => !targets.has(file.name))
  const unrelatedBeforeCounts = countFileIdentities(unrelatedBefore)
  const unrelatedAfterCounts = countFileIdentities(unrelatedAfter)
  if (!sameCounts(unrelatedBeforeCounts, unrelatedAfterCounts)) {
    throw new Error(
      `Notion replacement verification failed: an unrelated “${NOTION_MEMES_PROPERTY}” attachment or name changed`
    )
  }

  for (const filename of targets) {
    const matches = input.after.filter((file) => file.name === filename)
    if (matches.length !== 1) {
      throw new Error(
        `Notion replacement verification failed: ${filename} must appear exactly once`
      )
    }
    if (matches[0]!.type !== 'file') {
      throw new Error(
        `Notion replacement verification failed: ${filename} is not an uploaded file`
      )
    }
  }
  if (input.after.length !== input.before.length) {
    throw new Error(
      `Notion replacement verification failed: file count changed from ${input.before.length} to ${input.after.length}`
    )
  }
}

export async function assertReplacementBytesVerified(input: {
  expected: readonly FinalizedMemeExportFile[]
  after: readonly ExistingNotionFile[]
  download: (url: string) => Promise<Uint8Array>
}) {
  for (const expected of input.expected) {
    const matches = input.after.filter(
      (file): file is InternalNotionFile =>
        file.name === expected.filename && file.type === 'file'
    )
    if (matches.length !== 1) {
      throw new Error(
        `Notion byte verification failed: ${expected.filename} must appear exactly once as an uploaded file`
      )
    }

    const actualSha256 = createHash('sha256')
      .update(await input.download(matches[0]!.file.url))
      .digest('hex')
    if (actualSha256 !== expected.sha256.toLowerCase()) {
      throw new Error(
        `Notion byte verification failed for ${expected.filename}: expected ${expected.sha256}, received ${actualSha256}`
      )
    }
  }
}

export function createNotionMemeGateway(token: string): NotionMemeGateway {
  const notion = new Client({
    auth: token,
    notionVersion: NOTION_MEME_API_VERSION
  })

  return {
    retrievePage: (pageId) => notion.pages.retrieve({ page_id: pageId }),
    retrievePageProperty: (pageId, propertyId) =>
      notion.pages.properties.retrieve({
        page_id: pageId,
        property_id: propertyId
      }),
    async createFileUpload({ filename, contentType }) {
      const response = await notion.fileUploads.create({
        mode: 'single_part',
        filename,
        content_type: contentType
      })
      return { id: response.id, status: response.status }
    },
    async sendFileUpload({ fileUploadId, filename, contentType, bytes }) {
      const response = await notion.fileUploads.send({
        file_upload_id: fileUploadId,
        file: {
          filename,
          data: new Blob([new Uint8Array(bytes).buffer], { type: contentType })
        }
      })
      return { id: response.id, status: response.status }
    },
    async retrieveFileUpload(fileUploadId) {
      const response = await notion.fileUploads.retrieve({
        file_upload_id: fileUploadId
      })
      return {
        id: response.id,
        status: response.status,
        expiryTime: response.expiry_time
      }
    },
    async downloadFile(url) {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        throw new Error(`Refusing to download a non-HTTPS Notion file URL`)
      }
      const response = await fetch(parsed, { redirect: 'follow' })
      if (!response.ok) {
        throw new Error(
          `Notion file download failed with HTTP ${response.status}`
        )
      }
      return new Uint8Array(await response.arrayBuffer())
    },
    async updateMemes(pageId, files) {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          [NOTION_MEMES_PROPERTY]: {
            type: 'files',
            files
          }
        }
      })
    }
  }
}

export async function runNotionMemeUpload(
  options: RunNotionMemeUploadOptions,
  gateway = createNotionMemeGateway(options.token)
): Promise<UploadSummary> {
  const log = options.log ?? console.log
  const [manifestText, scenariosText] = await Promise.all([
    readFile(options.manifestPath, 'utf8'),
    readFile(options.scenariosPath, 'utf8')
  ])
  const manifest = parseFinalizedMemeExportManifest(JSON.parse(manifestText))
  const scenarios = bindManifestToScenarios(manifest, JSON.parse(scenariosText))

  await verifyLocalExports(manifest.files)

  const checkpoint = options.apply
    ? await CheckpointStore.load(options.checkpointPath)
    : undefined
  let alreadyPresentCount = 0
  let uploadedCount = 0
  let attachedCount = 0
  let replacedCount = 0

  await pMap(
    scenarios,
    async (scenario) => {
      if (options.replaceExisting) {
        const result = await runScenarioReplacement({
          gateway,
          scenario,
          checkpoint,
          apply: options.apply,
          retries: options.retries,
          log
        })
        alreadyPresentCount += result.alreadyPresentCount
        uploadedCount += result.uploadedCount
        replacedCount += result.replacedCount
        return
      }

      const before = await retrieveMemesWithRetry(
        gateway,
        scenario.pageId,
        options.retries
      )
      const plan = planScenarioAppend(scenario, before.files)
      alreadyPresentCount += plan.alreadyPresent.length

      log(
        `${options.apply ? 'Apply' : 'Dry run'} ${scenario.scenarioSlug}: ${plan.missing.length} to append, ${plan.alreadyPresent.length} already present, ${plan.finalCount} final`
      )

      if (!options.apply) return

      for (const file of plan.alreadyPresent) {
        await checkpoint!.set(
          fileCheckpointKey(scenario.pageId, file.filename),
          {
            scenarioSlug: scenario.scenarioSlug,
            pageId: scenario.pageId,
            filename: file.filename,
            sha256: file.sha256,
            state: 'already-present',
            updatedAt: new Date().toISOString()
          }
        )
      }

      const uploads: { filename: string; fileUploadId: string }[] = []
      for (const file of plan.missing) {
        const entry = checkpoint!.get(
          fileCheckpointKey(scenario.pageId, file.filename)
        )
        const reusableId = await reusableCheckpointUpload(
          gateway,
          entry,
          file,
          scenario,
          options.retries
        )
        const fileUploadId =
          reusableId ??
          (await uploadFile(
            gateway,
            file,
            scenario,
            checkpoint!,
            options.retries
          ))

        if (!reusableId) uploadedCount += 1
        uploads.push({ filename: file.filename, fileUploadId })
      }

      if (uploads.length === 0) return

      const after = await attachWithRetry({
        gateway,
        scenario,
        uploads,
        retries: options.retries
      })
      assertAppendVerified({
        before: before.files,
        expectedNames: uploads.map((upload) => upload.filename),
        after
      })

      for (const upload of uploads) {
        const file = scenario.files.find(
          (candidate) => candidate.filename === upload.filename
        )!
        await checkpoint!.set(
          fileCheckpointKey(scenario.pageId, upload.filename),
          {
            scenarioSlug: scenario.scenarioSlug,
            pageId: scenario.pageId,
            filename: upload.filename,
            sha256: file.sha256,
            fileUploadId: upload.fileUploadId,
            state: 'attached',
            updatedAt: new Date().toISOString()
          }
        )
      }
      attachedCount += uploads.length
    },
    { concurrency: options.concurrency }
  )

  return {
    mode: options.apply ? 'apply' : 'dry-run',
    operation: options.replaceExisting ? 'replace' : 'append',
    scenarioCount: scenarios.length,
    fileCount: manifest.files.length,
    alreadyPresentCount,
    uploadedCount,
    attachedCount,
    replacedCount
  }
}

async function runScenarioReplacement(input: {
  gateway: NotionMemeGateway
  scenario: ScenarioUpload
  checkpoint: CheckpointStore | undefined
  apply: boolean
  retries: number
  log: (message: string) => void
}) {
  const before = await retrieveMemesWithRetry(
    input.gateway,
    input.scenario.pageId,
    input.retries
  )
  const plan = planScenarioReplacement(input.scenario, before.files)
  const alreadyCorrect = await matchingReplacementFiles(
    input.gateway,
    plan.targets,
    before.files,
    input.retries
  )
  const alreadyCorrectNames = new Set(
    alreadyCorrect.map((file) => file.filename)
  )
  const replacements = plan.targets.filter(
    (file) => !alreadyCorrectNames.has(file.filename)
  )

  input.log(
    `${input.apply ? 'Apply' : 'Dry run'} replacement ${input.scenario.scenarioSlug}: ${replacements.length} to replace, ${alreadyCorrect.length} already corrected, ${plan.finalCount} final`
  )
  if (!input.apply) {
    return {
      alreadyPresentCount: alreadyCorrect.length,
      uploadedCount: 0,
      replacedCount: 0
    }
  }

  for (const file of alreadyCorrect) {
    await input.checkpoint!.set(
      fileCheckpointKey(input.scenario.pageId, file.filename),
      {
        scenarioSlug: input.scenario.scenarioSlug,
        pageId: input.scenario.pageId,
        filename: file.filename,
        sha256: file.sha256,
        state: 'already-present',
        updatedAt: new Date().toISOString()
      }
    )
  }

  const uploads: { filename: string; fileUploadId: string }[] = []
  let uploadedCount = 0
  for (const file of replacements) {
    const entry = input.checkpoint!.get(
      fileCheckpointKey(input.scenario.pageId, file.filename)
    )
    const reusableId = await reusableCheckpointUpload(
      input.gateway,
      entry,
      file,
      input.scenario,
      input.retries
    )
    const fileUploadId =
      reusableId ??
      (await uploadFile(
        input.gateway,
        file,
        input.scenario,
        input.checkpoint!,
        input.retries
      ))
    if (!reusableId) uploadedCount += 1
    uploads.push({ filename: file.filename, fileUploadId })
  }

  if (uploads.length === 0) {
    return {
      alreadyPresentCount: alreadyCorrect.length,
      uploadedCount,
      replacedCount: 0
    }
  }

  const expected = replacements.filter((file) =>
    uploads.some((upload) => upload.filename === file.filename)
  )
  await replaceWithRetry({
    gateway: input.gateway,
    scenario: input.scenario,
    uploads,
    expected,
    retries: input.retries
  })

  for (const upload of uploads) {
    const file = expected.find(
      (candidate) => candidate.filename === upload.filename
    )!
    await input.checkpoint!.set(
      fileCheckpointKey(input.scenario.pageId, upload.filename),
      {
        scenarioSlug: input.scenario.scenarioSlug,
        pageId: input.scenario.pageId,
        filename: upload.filename,
        sha256: file.sha256,
        fileUploadId: upload.fileUploadId,
        state: 'attached',
        updatedAt: new Date().toISOString()
      }
    )
  }

  return {
    alreadyPresentCount: alreadyCorrect.length,
    uploadedCount,
    replacedCount: uploads.length
  }
}

async function verifyLocalExports(files: readonly FinalizedMemeExportFile[]) {
  await pMap(
    files,
    async (file) => {
      const metadata = await stat(file.path)
      if (!metadata.isFile()) {
        throw new Error(`Export is not a file: ${file.path}`)
      }
      if (basename(file.path) !== file.filename) {
        throw new Error(
          `Manifest filename ${file.filename} does not match path ${file.path}`
        )
      }
      const actualSha256 = createHash('sha256')
        .update(await readFile(file.path))
        .digest('hex')
      if (actualSha256 !== file.sha256.toLowerCase()) {
        throw new Error(
          `SHA-256 mismatch for ${file.filename}: expected ${file.sha256}, received ${actualSha256}`
        )
      }
    },
    { concurrency: 8 }
  )
}

async function retrieveMemesWithRetry(
  gateway: NotionMemeGateway,
  pageId: string,
  retries: number
): Promise<RetrievedFiles> {
  return withRetry(`retrieve page ${pageId}`, retries, async () => {
    const page = asRecord(await gateway.retrievePage(pageId))
    const properties = asRecord(page.properties)
    const property = asRecord(properties[NOTION_MEMES_PROPERTY])

    if (property.type !== 'files' || typeof property.id !== 'string') {
      throw new Error(
        `Page ${pageId} is missing the “${NOTION_MEMES_PROPERTY}” files property`
      )
    }

    const response = asRecord(
      await gateway.retrievePageProperty(pageId, property.id)
    )
    if (
      response.object !== 'property_item' ||
      response.type !== 'files' ||
      !Array.isArray(response.files)
    ) {
      throw new Error(
        `Page ${pageId} returned an invalid “${NOTION_MEMES_PROPERTY}” property`
      )
    }

    return {
      propertyId: property.id,
      files: response.files.map((file, index) =>
        parseExistingNotionFile(file, pageId, index)
      )
    }
  })
}

async function uploadFile(
  gateway: NotionMemeGateway,
  file: FinalizedMemeExportFile,
  scenario: ScenarioUpload,
  checkpoint: CheckpointStore,
  retries: number
) {
  const contentType = contentTypeForFilename(file.filename)
  const created = await withRetry(
    `create file upload ${file.filename}`,
    retries,
    () => gateway.createFileUpload({ filename: file.filename, contentType })
  )

  if (created.status !== 'pending') {
    throw new Error(
      `New file upload ${created.id} for ${file.filename} has unexpected status ${created.status}`
    )
  }

  const bytes = await readFile(file.path)
  const sent = await sendFileWithRetry({
    gateway,
    fileUploadId: created.id,
    filename: file.filename,
    contentType,
    bytes,
    retries
  })
  if (sent.status !== 'uploaded') {
    throw new Error(
      `File upload ${sent.id} for ${file.filename} has unexpected status ${sent.status}`
    )
  }

  await checkpoint.set(fileCheckpointKey(scenario.pageId, file.filename), {
    scenarioSlug: scenario.scenarioSlug,
    pageId: scenario.pageId,
    filename: file.filename,
    sha256: file.sha256,
    fileUploadId: sent.id,
    state: 'uploaded',
    updatedAt: new Date().toISOString()
  })
  return sent.id
}

async function sendFileWithRetry(input: {
  gateway: NotionMemeGateway
  fileUploadId: string
  filename: string
  contentType: string
  bytes: Uint8Array
  retries: number
}) {
  let lastError: unknown

  for (let attempt = 0; attempt <= input.retries; attempt += 1) {
    try {
      return await input.gateway.sendFileUpload({
        fileUploadId: input.fileUploadId,
        filename: input.filename,
        contentType: input.contentType,
        bytes: input.bytes
      })
    } catch (err) {
      lastError = err
      if (!isRetryable(err) || attempt === input.retries) throw err

      try {
        const upload = await input.gateway.retrieveFileUpload(
          input.fileUploadId
        )
        if (upload.status === 'uploaded') return upload
      } catch {
        // Retry the send below. Its original error remains authoritative.
      }

      await retryDelay(attempt)
    }
  }

  throw lastError
}

async function reusableCheckpointUpload(
  gateway: NotionMemeGateway,
  entry: CheckpointEntry | undefined,
  file: FinalizedMemeExportFile,
  scenario: ScenarioUpload,
  retries: number
) {
  if (
    !entry?.fileUploadId ||
    entry.sha256.toLowerCase() !== file.sha256.toLowerCase() ||
    entry.pageId !== scenario.pageId ||
    entry.scenarioSlug !== scenario.scenarioSlug
  ) {
    return undefined
  }

  try {
    const upload = await withRetry(
      `retrieve checkpoint upload ${entry.fileUploadId}`,
      retries,
      () => gateway.retrieveFileUpload(entry.fileUploadId!)
    )
    if (upload.status !== 'uploaded') return undefined
    if (upload.expiryTime && Date.parse(upload.expiryTime) <= Date.now()) {
      return undefined
    }
    return upload.id
  } catch {
    return undefined
  }
}

async function attachWithRetry(input: {
  gateway: NotionMemeGateway
  scenario: ScenarioUpload
  uploads: readonly { filename: string; fileUploadId: string }[]
  retries: number
}) {
  return withRetry(
    `append ${input.uploads.length} memes to ${input.scenario.scenarioSlug}`,
    input.retries,
    async () => {
      const current = await retrieveMemesWithRetry(
        input.gateway,
        input.scenario.pageId,
        input.retries
      )
      const missing = input.uploads.filter(
        (upload) => !current.files.some((file) => file.name === upload.filename)
      )

      if (missing.length > 0) {
        const nextFiles = appendUploadedFiles(current.files, missing)
        if (nextFiles.length > MAX_NOTION_FILES_PER_PROPERTY) {
          throw new Error(
            `${input.scenario.scenarioSlug} would exceed Notion’s ${MAX_NOTION_FILES_PER_PROPERTY}-file property limit`
          )
        }
        await input.gateway.updateMemes(input.scenario.pageId, nextFiles)
      }

      const verified = await retrieveMemesWithRetry(
        input.gateway,
        input.scenario.pageId,
        input.retries
      )
      assertAppendVerified({
        before: current.files,
        expectedNames: input.uploads.map((upload) => upload.filename),
        after: verified.files
      })
      return verified.files
    }
  )
}

async function matchingReplacementFiles(
  gateway: NotionMemeGateway,
  expected: readonly FinalizedMemeExportFile[],
  existing: readonly ExistingNotionFile[],
  retries: number
) {
  return pMap(
    expected,
    async (file) => {
      const matches = existing.filter(
        (candidate): candidate is InternalNotionFile =>
          candidate.name === file.filename && candidate.type === 'file'
      )
      if (matches.length !== 1) return undefined
      const sha256 = await downloadSha256WithRetry(
        gateway,
        matches[0]!.file.url,
        retries
      )
      return sha256 === file.sha256.toLowerCase() ? file : undefined
    },
    { concurrency: 4 }
  ).then((files) => files.filter((file) => file !== undefined))
}

async function replaceWithRetry(input: {
  gateway: NotionMemeGateway
  scenario: ScenarioUpload
  uploads: readonly { filename: string; fileUploadId: string }[]
  expected: readonly FinalizedMemeExportFile[]
  retries: number
}) {
  return withRetry(
    `replace ${input.uploads.length} memes in ${input.scenario.scenarioSlug}`,
    input.retries,
    async () => {
      const current = await retrieveMemesWithRetry(
        input.gateway,
        input.scenario.pageId,
        input.retries
      )
      planScenarioReplacement(
        { ...input.scenario, files: [...input.expected] },
        current.files
      )

      const alreadyCorrect = await matchingReplacementFiles(
        input.gateway,
        input.expected,
        current.files,
        input.retries
      )
      const alreadyCorrectNames = new Set(
        alreadyCorrect.map((file) => file.filename)
      )
      const pendingUploads = input.uploads.filter(
        (upload) => !alreadyCorrectNames.has(upload.filename)
      )

      if (pendingUploads.length > 0) {
        const nextFiles = replaceUploadedFiles(current.files, pendingUploads)
        await input.gateway.updateMemes(input.scenario.pageId, nextFiles)
      }

      const verified = await retrieveMemesWithRetry(
        input.gateway,
        input.scenario.pageId,
        input.retries
      )
      assertReplacementVerified({
        before: current.files,
        targetNames: input.uploads.map((upload) => upload.filename),
        after: verified.files
      })
      await assertReplacementBytesVerified({
        expected: input.expected,
        after: verified.files,
        download: (url) =>
          downloadBytesWithRetry(input.gateway, url, input.retries)
      })
      return verified.files
    }
  )
}

async function downloadSha256WithRetry(
  gateway: NotionMemeGateway,
  url: string,
  retries: number
) {
  return createHash('sha256')
    .update(await downloadBytesWithRetry(gateway, url, retries))
    .digest('hex')
}

async function downloadBytesWithRetry(
  gateway: NotionMemeGateway,
  url: string,
  retries: number
) {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await gateway.downloadFile(url)
    } catch (err) {
      lastError = err
      if (attempt === retries) throw err
      await retryDelay(attempt)
    }
  }
  throw lastError
}

async function withRetry<T>(
  label: string,
  retries: number,
  operation: () => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation()
    } catch (err) {
      if (!isRetryable(err) || attempt >= retries) {
        if (err instanceof Error) {
          err.message = `${label}: ${err.message}`
        }
        throw err
      }
      await retryDelay(attempt)
    }
  }
}

function isRetryable(error: unknown) {
  if (!isNotionClientError(error)) return false
  if ('status' in error) {
    return [409, 429, 500, 502, 503, 504].includes(error.status)
  }
  return error.code === 'notionhq_client_request_timeout'
}

async function retryDelay(attempt: number) {
  await delay(Math.min(8_000, 400 * 2 ** attempt))
}

function parseExistingNotionFile(
  input: unknown,
  pageId: string,
  index: number
): ExistingNotionFile {
  const file = asRecord(input)
  if (typeof file.name !== 'string' || file.name.length === 0) {
    throw new Error(
      `Page ${pageId} has an invalid “${NOTION_MEMES_PROPERTY}” filename at index ${index}`
    )
  }

  if (file.type === 'file') {
    const value = asRecord(file.file)
    if (typeof value.url !== 'string') {
      throw new Error(`Page ${pageId} has an invalid internal file at ${index}`)
    }
    const parsed: ExistingNotionFile = {
      type: 'file',
      name: file.name,
      file: { url: value.url }
    }
    if (typeof value.expiry_time === 'string') {
      parsed.file.expiry_time = value.expiry_time
    }
    return parsed
  }

  if (file.type === 'external') {
    const value = asRecord(file.external)
    if (typeof value.url !== 'string') {
      throw new Error(`Page ${pageId} has an invalid external file at ${index}`)
    }
    return {
      type: 'external',
      name: file.name,
      external: { url: value.url }
    }
  }

  throw new Error(
    `Page ${pageId} has unsupported “${NOTION_MEMES_PROPERTY}” file type at index ${index}`
  )
}

function countFileIdentities(files: readonly ExistingNotionFile[]) {
  const counts = new Map<string, number>()
  for (const file of files) {
    const identity = `${file.type}:${file.name}`
    counts.set(identity, (counts.get(identity) ?? 0) + 1)
  }
  return counts
}

function sameCounts(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>
) {
  if (left.size !== right.size) return false
  for (const [identity, count] of left) {
    if (right.get(identity) !== count) return false
  }
  return true
}

function contentTypeForFilename(filename: string) {
  return extname(filename).toLowerCase() === '.webp'
    ? 'image/webp'
    : 'image/jpeg'
}

function fileCheckpointKey(pageId: string, filename: string) {
  return `${pageId}:${filename}`
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }
  return input as Record<string, unknown>
}

class CheckpointStore {
  private writeQueue = Promise.resolve()

  private constructor(
    private readonly path: string,
    private readonly checkpoint: UploadCheckpoint
  ) {}

  static async load(path: string) {
    let checkpoint: UploadCheckpoint
    try {
      checkpoint = checkpointSchema.parse(
        JSON.parse(await readFile(path, 'utf8'))
      )
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err ? err.code : undefined
      if (code !== 'ENOENT') throw err
      checkpoint = {
        schemaVersion: 1,
        updatedAt: new Date(0).toISOString(),
        entries: {}
      }
    }
    return new CheckpointStore(resolve(path), checkpoint)
  }

  get(key: string) {
    return this.checkpoint.entries[key]
  }

  async set(key: string, entry: CheckpointEntry) {
    this.checkpoint.entries[key] = entry
    this.checkpoint.updatedAt = new Date().toISOString()
    const serialized = `${JSON.stringify(this.checkpoint, null, 2)}\n`

    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true })
      const temporaryPath = `${this.path}.${process.pid}.tmp`
      await writeFile(temporaryPath, serialized)
      await rename(temporaryPath, this.path)
    })
    await this.writeQueue
  }
}
