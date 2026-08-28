import { createHash } from 'node:crypto'

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'

import { createMediaStorage, type MediaStorageClient } from './media-storage'

const environment = {
  S3_ACCESS_KEY_ID: 'a'.repeat(32),
  S3_SECRET_ACCESS_KEY: 'b'.repeat(64),
  S3_API_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  S3_BUCKET_NAME: 'media-bucket',
  S3_PUBLIC_URL: 'https://media.example.com/assets/'
}

const notionId = '3C6EDB27-F124-80CC-92D5-C8F2F2E3A7FA'

describe('createMediaStorage', () => {
  it('loads required configuration when storage is created', () => {
    const clientFactory = vi.fn<() => MediaStorageClient>(() => fakeClient())

    expect(() => createMediaStorage({ env: {}, clientFactory })).toThrow(
      'S3_ACCESS_KEY_ID is required'
    )
    expect(clientFactory).not.toHaveBeenCalled()

    createMediaStorage({ env: environment, clientFactory })
    expect(clientFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          accessKeyId: 'a'.repeat(32),
          secretAccessKey: 'b'.repeat(64)
        },
        endpoint: 'https://account-id.r2.cloudflarestorage.com/',
        region: 'auto'
      })
    )
  })

  it('rejects the authenticated R2 API host as a public delivery URL', () => {
    expect(() =>
      createMediaStorage({
        env: {
          ...environment,
          S3_PUBLIC_URL:
            'https://account-id.r2.cloudflarestorage.com/media-bucket'
        },
        client: fakeClient()
      })
    ).toThrow('not the authenticated R2 API endpoint')
  })

  it('rejects a Cloudflare API token in place of R2 S3 credentials', () => {
    expect(() =>
      createMediaStorage({
        env: {
          ...environment,
          S3_ACCESS_KEY_ID: 'not-an-r2-access-key',
          S3_SECRET_ACCESS_KEY: 'not-an-r2-secret-key'
        },
        client: fakeClient()
      })
    ).toThrow('generated S3 Access Key ID and Secret Access Key')
  })

  it('returns a content-addressed URL without uploading an existing object', async () => {
    const bytes = Buffer.from('final webp bytes')
    const client = fakeClient(async () => ({}))
    const storage = createMediaStorage({ env: environment, client })

    const result = await storage.publish({
      bytes,
      collection: 'scenarios',
      notionId,
      variant: 'detail'
    })

    const hash = createHash('sha256').update(bytes).digest('hex')
    const key = `media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/detail-${hash}.webp`
    expect(result).toEqual({
      hash,
      key,
      uploaded: false,
      url: `https://media.example.com/assets/${key}`
    })
    expect(client.send).toHaveBeenCalledTimes(1)
    expect(commandInput(client, 0)).toEqual({
      Bucket: 'media-bucket',
      Key: key
    })
  })

  it('uploads a missing object with immutable WebP metadata', async () => {
    const bytes = Buffer.from('new final bytes')
    const client = fakeClient(async (command) => {
      if (command instanceof HeadObjectCommand) {
        throw awsError('NotFound', 404)
      }
      return {}
    })
    const storage = createMediaStorage({ env: environment, client })

    const result = await storage.publish({
      bytes,
      collection: 'sources',
      notionId,
      variant: 'gallery'
    })

    expect(result.uploaded).toBe(true)
    expect(result.key).toMatch(
      /^media\/generated\/sources\/[0-9a-f]{32}\/gallery-[0-9a-f]{64}\.webp$/
    )
    expect(client.send).toHaveBeenCalledTimes(2)
    expect(commandInput(client, 1)).toEqual({
      Body: bytes,
      Bucket: 'media-bucket',
      CacheControl: 'public,max-age=31536000,immutable',
      ContentType: 'image/webp',
      IfNoneMatch: '*',
      Key: result.key
    })
  })

  it('treats a raced conditional upload as success', async () => {
    const client = fakeClient(async (command) => {
      if (command instanceof HeadObjectCommand) {
        throw awsError('NotFound', 404)
      }
      throw awsError('PreconditionFailed', 412)
    })
    const storage = createMediaStorage({ env: environment, client })

    await expect(
      storage.publish({
        bytes: Buffer.from('same bytes'),
        collection: 'sources',
        notionId,
        variant: 'detail'
      })
    ).resolves.toMatchObject({ uploaded: false })
  })

  it('uses strict HEAD semantics for manifest object checks', async () => {
    const unavailable = awsError('ServiceUnavailable', 503)
    const missingClient = fakeClient(async () => {
      throw awsError('NotFound')
    })
    const unavailableClient = fakeClient(async () => {
      throw unavailable
    })

    await expect(
      createMediaStorage({ env: environment, client: fakeClient() }).hasObject(
        'known-key'
      )
    ).resolves.toBe(true)
    await expect(
      createMediaStorage({ env: environment, client: missingClient }).hasObject(
        'missing-key'
      )
    ).resolves.toBe(false)
    await expect(
      createMediaStorage({
        env: environment,
        client: unavailableClient
      }).hasObject('unknown-key')
    ).rejects.toBe(unavailable)
  })

  it('does not mistake an unclassified storage error for a missing object', async () => {
    const error = awsError('NoSuchKey')
    const client = fakeClient(async () => {
      throw error
    })

    await expect(
      createMediaStorage({ env: environment, client }).publish({
        bytes: Buffer.from('bytes'),
        collection: 'scenarios',
        notionId,
        variant: 'gallery'
      })
    ).rejects.toBe(error)
    expect(client.send).toHaveBeenCalledTimes(1)
  })
})

function fakeClient(
  implementation: MediaStorageClient['send'] = async () => ({})
) {
  return {
    send: vi.fn<MediaStorageClient['send']>(implementation)
  } satisfies MediaStorageClient
}

function commandInput(client: ReturnType<typeof fakeClient>, index: number) {
  const command = client.send.mock.calls[index]?.[0]
  if (!command) throw new Error(`Missing command at index ${index}`)
  return command.input
}

function awsError(name: string, httpStatusCode?: number) {
  return Object.assign(new Error(name), {
    $metadata: { httpStatusCode },
    name
  })
}
