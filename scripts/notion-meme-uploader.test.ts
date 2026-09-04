import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  appendUploadedFiles,
  assertAppendVerified,
  assertReplacementBytesVerified,
  assertReplacementVerified,
  bindManifestToScenarios,
  parseFinalizedMemeExportManifest,
  planScenarioAppend,
  planScenarioReplacement,
  replaceUploadedFiles,
  type ExistingNotionFile,
  type FinalizedMemeExportFile,
  type FinalizedMemeExportManifest,
  type NewNotionFile,
  type NotionMemeGateway,
  runNotionMemeUpload,
  type ScenarioUpload
} from './notion-meme-uploader'

const fingerprint = 'a'.repeat(64)
const sha256 = 'b'.repeat(64)

function exportFile(
  overrides: Partial<FinalizedMemeExportFile> = {}
): FinalizedMemeExportFile {
  return {
    scenarioSlug: 'keep-summer-safe',
    ideaId: 'keep-summer-safe--01',
    revisionKey: 'revision-01',
    payloadFingerprint: fingerprint,
    path: '/tmp/keep-summer-safe--01--aaaaaaaaaaaa.jpg',
    filename: 'keep-summer-safe--01--aaaaaaaaaaaa.jpg',
    sha256,
    width: 1600,
    height: 900,
    terminalPeriodsRemoved: 1,
    ...overrides
  }
}

function scenario(
  files: FinalizedMemeExportFile[] = [exportFile()]
): ScenarioUpload {
  return {
    scenarioSlug: 'keep-summer-safe',
    pageId: 'page-1',
    files
  }
}

const existing: ExistingNotionFile = {
  type: 'external',
  name: 'hand-authored.jpg',
  external: { url: 'https://example.com/hand-authored.jpg' }
}

describe('parseFinalizedMemeExportManifest', () => {
  it('requires renderer identity and output integrity fields', () => {
    expect(
      parseFinalizedMemeExportManifest({
        schemaVersion: 1,
        generatedAt: '2026-09-04T00:00:00.000Z',
        files: [exportFile()]
      })
    ).toMatchObject({ files: [{ revisionKey: 'revision-01', width: 1600 }] })

    expect(() =>
      parseFinalizedMemeExportManifest({
        schemaVersion: 1,
        files: [{ ...exportFile(), sha256: undefined }]
      })
    ).toThrow()
  })

  it('rejects unsafe or duplicate filenames', () => {
    expect(() =>
      parseFinalizedMemeExportManifest({
        schemaVersion: 1,
        files: [exportFile({ filename: '../escape.jpg' })]
      })
    ).toThrow(/basename/)

    expect(() =>
      parseFinalizedMemeExportManifest({
        schemaVersion: 1,
        files: [exportFile(), exportFile({ ideaId: 'another-id' })]
      })
    ).toThrow(/Duplicate export filename/)
  })
})

describe('bindManifestToScenarios', () => {
  it('maps slugs to Notion page IDs and sorts deterministically', () => {
    const second = exportFile({
      scenarioSlug: 'ava-games-the-test',
      ideaId: 'ava--01',
      path: '/tmp/ava--01--bbbbbbbbbbbb.jpg',
      filename: 'ava--01--bbbbbbbbbbbb.jpg'
    })
    const manifest: FinalizedMemeExportManifest = {
      schemaVersion: 1,
      files: [exportFile(), second]
    }

    expect(
      bindManifestToScenarios(manifest, [
        { id: 'page-1', slug: 'keep-summer-safe', title: 'untouched' },
        { id: 'page-2', slug: 'ava-games-the-test', title: 'untouched' }
      ])
    ).toEqual([
      {
        scenarioSlug: 'ava-games-the-test',
        pageId: 'page-2',
        files: [second]
      },
      {
        scenarioSlug: 'keep-summer-safe',
        pageId: 'page-1',
        files: [exportFile()]
      }
    ])
  })

  it('refuses an export whose scenario is absent from the snapshot', () => {
    expect(() =>
      bindManifestToScenarios({ schemaVersion: 1, files: [exportFile()] }, [])
    ).toThrow(/unknown scenario slug/)
  })
})

describe('append planning', () => {
  it('preserves existing files and plans only missing deterministic names', () => {
    const plan = planScenarioAppend(scenario(), [existing])

    expect(plan.existing).toEqual([existing])
    expect(plan.alreadyPresent).toEqual([])
    expect(plan.missing).toEqual([exportFile()])
    expect(plan.finalCount).toBe(2)
  })

  it('is idempotent by filename', () => {
    const exported = exportFile()
    const alreadyUploaded: ExistingNotionFile = {
      type: 'file',
      name: exported.filename,
      file: {
        url: 'https://notion.example.com/file',
        expiry_time: '2026-09-04T01:00:00.000Z'
      }
    }

    const plan = planScenarioAppend(scenario([exported]), [
      existing,
      alreadyUploaded
    ])

    expect(plan.missing).toEqual([])
    expect(plan.alreadyPresent).toEqual([exported])
    expect(plan.finalCount).toBe(2)
  })

  it('constructs an append-only Notion files value', () => {
    expect(
      appendUploadedFiles(
        [existing],
        [
          { filename: 'new.jpg', fileUploadId: 'upload-1' },
          { filename: existing.name, fileUploadId: 'unused' }
        ]
      )
    ).toEqual([
      existing,
      {
        type: 'file_upload',
        name: 'new.jpg',
        file_upload: { id: 'upload-1' }
      }
    ])
  })

  it('verifies old and newly appended files without comparing expiring URLs', () => {
    const changedSignedUrl: ExistingNotionFile = {
      type: 'file',
      name: 'old.jpg',
      file: { url: 'https://notion.example.com/new-signature' }
    }

    expect(() =>
      assertAppendVerified({
        before: [
          {
            type: 'file',
            name: 'old.jpg',
            file: { url: 'https://notion.example.com/old-signature' }
          }
        ],
        expectedNames: ['new.jpg'],
        after: [
          changedSignedUrl,
          {
            type: 'file',
            name: 'new.jpg',
            file: { url: 'https://notion.example.com/new.jpg' }
          }
        ]
      })
    ).not.toThrow()

    expect(() =>
      assertAppendVerified({
        before: [existing],
        expectedNames: ['new.jpg'],
        after: [
          {
            type: 'file',
            name: 'new.jpg',
            file: { url: 'https://notion.example.com/new.jpg' }
          }
        ]
      })
    ).toThrow(/was not preserved/)
  })
})

describe('exact-filename replacement planning', () => {
  const contaminated: ExistingNotionFile = {
    type: 'file',
    name: exportFile().filename,
    file: { url: 'https://notion.example.com/contaminated.jpg' }
  }

  it('requires exactly one existing attachment for every replacement', () => {
    expect(
      planScenarioReplacement(scenario(), [existing, contaminated])
    ).toEqual({
      existing: [existing, contaminated],
      targets: [exportFile()],
      finalCount: 2
    })

    expect(() => planScenarioReplacement(scenario(), [existing])).toThrow(
      /does not contain/
    )
    expect(() =>
      planScenarioReplacement(scenario(), [contaminated, contaminated])
    ).toThrow(/contains 2 attachments/)
  })

  it('replaces only exact target names and preserves unrelated file objects', () => {
    const next = replaceUploadedFiles(
      [existing, contaminated],
      [
        {
          filename: contaminated.name,
          fileUploadId: 'corrected-upload'
        }
      ]
    )

    expect(next).toEqual([
      existing,
      {
        type: 'file_upload',
        name: contaminated.name,
        file_upload: { id: 'corrected-upload' }
      }
    ])
  })

  it('verifies target replacement and rejects lost or duplicated files', () => {
    const corrected: ExistingNotionFile = {
      type: 'file',
      name: contaminated.name,
      file: { url: 'https://notion.example.com/corrected.jpg' }
    }

    expect(() =>
      assertReplacementVerified({
        before: [existing, contaminated],
        targetNames: [contaminated.name],
        after: [existing, corrected]
      })
    ).not.toThrow()

    expect(() =>
      assertReplacementVerified({
        before: [existing, contaminated],
        targetNames: [contaminated.name],
        after: [corrected]
      })
    ).toThrow(/file count|unrelated/)

    expect(() =>
      assertReplacementVerified({
        before: [existing, contaminated],
        targetNames: [contaminated.name],
        after: [existing, corrected, corrected]
      })
    ).toThrow(/exactly once/)
  })

  it('verifies the downloaded replacement bytes, not only its filename', async () => {
    const correctedBytes = new TextEncoder().encode('corrected image bytes')
    const correctedSha256 = createHash('sha256')
      .update(correctedBytes)
      .digest('hex')
    const correctedFile = exportFile({ sha256: correctedSha256 })
    const after: ExistingNotionFile[] = [
      {
        type: 'file',
        name: correctedFile.filename,
        file: { url: 'https://notion.example.com/corrected.jpg' }
      }
    ]

    await expect(
      assertReplacementBytesVerified({
        expected: [correctedFile],
        after,
        download: async () => correctedBytes
      })
    ).resolves.toBeUndefined()

    await expect(
      assertReplacementBytesVerified({
        expected: [correctedFile],
        after,
        download: async () => new TextEncoder().encode('stale image bytes')
      })
    ).rejects.toThrow(/byte verification failed/)
  })
})

describe('replacement upload workflow', () => {
  it('fresh-reads, swaps the exact attachment, verifies bytes, and is idempotent', async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'notion-meme-replacement-')
    )
    try {
      const staleBytes = new TextEncoder().encode('image with dev-server icon')
      const correctedBytes = new TextEncoder().encode('corrected image')
      const correctedSha256 = createHash('sha256')
        .update(correctedBytes)
        .digest('hex')
      const filename = 'keep-summer-safe--01--aaaaaaaaaaaa.jpg'
      const imagePath = join(temporaryDirectory, filename)
      const manifestPath = join(temporaryDirectory, 'manifest.json')
      const scenariosPath = join(temporaryDirectory, 'scenarios.json')
      const checkpointPath = join(temporaryDirectory, 'checkpoint.json')
      await Promise.all([
        writeFile(imagePath, correctedBytes),
        writeFile(
          manifestPath,
          JSON.stringify({
            schemaVersion: 1,
            files: [
              exportFile({
                path: imagePath,
                filename,
                sha256: correctedSha256
              })
            ]
          })
        ),
        writeFile(
          scenariosPath,
          JSON.stringify([{ id: 'page-1', slug: 'keep-summer-safe' }])
        )
      ])

      let currentFiles: ExistingNotionFile[] = [
        existing,
        {
          type: 'file',
          name: filename,
          file: { url: 'memory://stale' }
        }
      ]
      const bytesByUrl = new Map<string, Uint8Array>([
        ['memory://stale', staleBytes]
      ])
      const uploadedBytes = new Map<string, Uint8Array>()
      const updates: (ExistingNotionFile | NewNotionFile)[][] = []
      const gateway: NotionMemeGateway = {
        retrievePage: async () => ({
          properties: { Memes: { id: 'memes-property', type: 'files' } }
        }),
        retrievePageProperty: async () => ({
          object: 'property_item',
          type: 'files',
          files: currentFiles
        }),
        createFileUpload: async () => ({ id: 'upload-1', status: 'pending' }),
        sendFileUpload: async ({ fileUploadId, bytes }) => {
          uploadedBytes.set(fileUploadId, bytes)
          return { id: fileUploadId, status: 'uploaded' }
        },
        retrieveFileUpload: async (fileUploadId) => ({
          id: fileUploadId,
          status: 'uploaded',
          expiryTime: null
        }),
        downloadFile: async (url) => {
          const bytes = bytesByUrl.get(url)
          if (!bytes) throw new Error(`Unknown in-memory URL: ${url}`)
          return bytes
        },
        updateMemes: async (_pageId, files) => {
          updates.push(files)
          currentFiles = files.map((file) => {
            if (file.type !== 'file_upload') return file
            const url = `memory://${file.file_upload.id}`
            bytesByUrl.set(url, uploadedBytes.get(file.file_upload.id)!)
            return { type: 'file', name: file.name, file: { url } }
          })
        }
      }

      const options = {
        manifestPath,
        scenariosPath,
        checkpointPath,
        apply: true,
        replaceExisting: true,
        concurrency: 1,
        retries: 0,
        token: 'unused-by-fake-gateway',
        log: () => {}
      }
      await expect(
        runNotionMemeUpload(options, gateway)
      ).resolves.toMatchObject({
        operation: 'replace',
        uploadedCount: 1,
        replacedCount: 1
      })
      expect(updates).toHaveLength(1)
      expect(updates[0]).toEqual([
        existing,
        {
          type: 'file_upload',
          name: filename,
          file_upload: { id: 'upload-1' }
        }
      ])

      await expect(
        runNotionMemeUpload({ ...options, apply: false }, gateway)
      ).resolves.toMatchObject({
        operation: 'replace',
        alreadyPresentCount: 1,
        uploadedCount: 0,
        replacedCount: 0
      })
      expect(updates).toHaveLength(1)
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
