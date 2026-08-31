import { createHash } from 'node:crypto'

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'

import { createMediaStorage, type MediaStorageClient } from './media-storage'
import { mediaDescriptorObjectKey } from './media-descriptor'
import { memeMediaDescriptorObjectKey } from './meme-media-descriptor'

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

  it('allows an optional descriptor bucket override', async () => {
    const client = fakeClient(async () => ({
      Body: { transformToString: async () => '{}' },
      ETag: '"etag"'
    }))
    const storage = createMediaStorage({
      env: { ...environment, S3_STATE_BUCKET_NAME: 'media-state-bucket' },
      client
    })

    await storage.getDescriptor('scenarios', notionId)
    expect(commandInput(client, 0)).toMatchObject({
      Bucket: 'media-state-bucket'
    })
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

  it('publishes scenario memes beneath their separate asset path', async () => {
    const bytes = Buffer.from('final meme webp bytes')
    const client = fakeClient(async () => ({}))
    const storage = createMediaStorage({ env: environment, client })

    const result = await storage.publish({
      bytes,
      collection: 'scenarios',
      notionId,
      purpose: 'scenario-meme',
      variant: 'detail'
    })

    const hash = createHash('sha256').update(bytes).digest('hex')
    const key = `media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/memes/detail-${hash}.webp`
    expect(result).toEqual({
      hash,
      key,
      uploaded: false,
      url: `https://media.example.com/assets/${key}`
    })
    expect(commandInput(client, 0)).toEqual({
      Bucket: 'media-bucket',
      Key: key
    })
  })

  it('rejects meme publication outside the scenarios collection', async () => {
    const storage = createMediaStorage({
      env: environment,
      client: fakeClient()
    })

    await expect(
      storage.publish({
        bytes: Buffer.from('meme bytes'),
        collection: 'sources',
        notionId,
        purpose: 'scenario-meme',
        variant: 'gallery'
      })
    ).rejects.toThrow('must belong to the scenarios collection')
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

  it('reads a JSON descriptor from the media bucket by default and preserves its ETag', async () => {
    const transformToString = vi.fn<() => Promise<string>>(async () =>
      JSON.stringify({ schemaVersion: 1 })
    )
    const client = fakeClient(async (command) => {
      expect(command).toBeInstanceOf(GetObjectCommand)
      return { Body: { transformToString }, ETag: '"descriptor-etag"' }
    })
    const storage = createMediaStorage({ env: environment, client })

    await expect(storage.getDescriptor('scenarios', notionId)).resolves.toEqual(
      {
        body: '{"schemaVersion":1}',
        etag: '"descriptor-etag"'
      }
    )
    expect(transformToString).toHaveBeenCalledWith('utf-8')
    expect(commandInput(client, 0)).toEqual({
      Bucket: 'media-bucket',
      Key: mediaDescriptorObjectKey('scenarios', notionId)
    })
  })

  it('reads a separately keyed meme descriptor with the same ETag contract', async () => {
    const client = fakeClient(async () => ({
      Body: { transformToString: async () => '{"state":"bundle"}' },
      ETag: '"meme-etag"'
    }))
    const storage = createMediaStorage({ env: environment, client })

    await expect(storage.getMemeDescriptor(notionId)).resolves.toEqual({
      body: '{"state":"bundle"}',
      etag: '"meme-etag"'
    })
    expect(commandInput(client, 0)).toEqual({
      Bucket: 'media-bucket',
      Key: memeMediaDescriptorObjectKey(notionId)
    })
  })

  it('returns null only when a descriptor is missing', async () => {
    const missing = fakeClient(async () => {
      throw awsError('NoSuchKey', 404)
    })
    const unavailableError = awsError('ServiceUnavailable', 503)
    const unavailable = fakeClient(async () => {
      throw unavailableError
    })

    await expect(
      createMediaStorage({ env: environment, client: missing }).getDescriptor(
        'sources',
        notionId
      )
    ).resolves.toBeNull()
    await expect(
      createMediaStorage({
        env: environment,
        client: unavailable
      }).getDescriptor('sources', notionId)
    ).rejects.toBe(unavailableError)
  })

  it('leaves JSON validation to the descriptor schema', async () => {
    const malformed = fakeClient(async () => ({
      Body: { transformToString: async () => 'not-json' },
      ETag: '"etag"'
    }))

    await expect(
      createMediaStorage({
        env: environment,
        client: malformed
      }).getDescriptor('scenarios', notionId)
    ).resolves.toEqual({ body: 'not-json', etag: '"etag"' })
  })

  it('rejects incomplete descriptor responses', async () => {
    const missingEtag = fakeClient(async () => ({
      Body: { transformToString: async () => '{}' }
    }))

    await expect(
      createMediaStorage({
        env: environment,
        client: missingEtag
      }).getDescriptor('scenarios', notionId)
    ).rejects.toThrow('has no ETag')
  })

  it('creates and conditionally replaces state descriptors', async () => {
    const client = fakeClient()
    const storage = createMediaStorage({ env: environment, client })
    const value = { schemaVersion: 1, notionId }

    await storage.putDescriptor({
      collection: 'scenarios',
      notionId,
      previousEtag: null,
      value
    })
    await storage.putDescriptor({
      collection: 'scenarios',
      notionId,
      previousEtag: '"previous"',
      value
    })

    expect(client.send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand)
    expect(commandInput(client, 0)).toEqual({
      Body: Buffer.from(`${JSON.stringify(value)}\n`),
      Bucket: 'media-bucket',
      CacheControl: 'private,no-store',
      ContentType: 'application/json',
      IfNoneMatch: '*',
      Key: mediaDescriptorObjectKey('scenarios', notionId)
    })
    expect(commandInput(client, 1)).toEqual({
      Body: Buffer.from(`${JSON.stringify(value)}\n`),
      Bucket: 'media-bucket',
      CacheControl: 'private,no-store',
      ContentType: 'application/json',
      IfMatch: '"previous"',
      Key: mediaDescriptorObjectKey('scenarios', notionId)
    })
  })

  it('creates and conditionally replaces separately keyed meme descriptors', async () => {
    const client = fakeClient()
    const storage = createMediaStorage({ env: environment, client })
    const value = {
      schemaVersion: 1,
      collection: 'scenario-memes',
      notionId,
      state: 'bundle'
    }

    await storage.putMemeDescriptor({
      notionId,
      previousEtag: null,
      value
    })
    await storage.putMemeDescriptor({
      notionId,
      previousEtag: '"previous"',
      value
    })

    expect(commandInput(client, 0)).toEqual({
      Body: Buffer.from(`${JSON.stringify(value)}\n`),
      Bucket: 'media-bucket',
      CacheControl: 'private,no-store',
      ContentType: 'application/json',
      IfNoneMatch: '*',
      Key: memeMediaDescriptorObjectKey(notionId)
    })
    expect(commandInput(client, 1)).toEqual({
      Body: Buffer.from(`${JSON.stringify(value)}\n`),
      Bucket: 'media-bucket',
      CacheControl: 'private,no-store',
      ContentType: 'application/json',
      IfMatch: '"previous"',
      Key: memeMediaDescriptorObjectKey(notionId)
    })
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
