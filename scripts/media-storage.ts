import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type S3ClientConfig
} from '@aws-sdk/client-s3'

import { mediaDescriptorObjectKey } from './media-descriptor'
import { memeMediaDescriptorObjectKey } from './meme-media-descriptor'
import {
  generatedMediaObjectKey,
  generatedMemeMediaObjectKey,
  sha256
} from './sync-utils'

const CACHE_CONTROL = 'public,max-age=31536000,immutable'
const DESCRIPTOR_CACHE_CONTROL = 'private,no-store'
const DEFAULT_REGION = 'auto'

export type MediaCollection = 'franchises' | 'scenarios' | 'sources'
export type MediaVariant = 'gallery' | 'detail'
export type MediaPurpose = 'record-image' | 'scenario-meme'

export type MediaStorageClient = {
  send(
    command: GetObjectCommand | HeadObjectCommand | PutObjectCommand
  ): Promise<unknown>
}

export type PublishMediaInput = {
  readonly bytes: Uint8Array
  readonly collection: MediaCollection
  readonly notionId: string
  readonly purpose?: MediaPurpose
  readonly variant: MediaVariant
}

export type PublishedMedia = {
  readonly hash: string
  readonly key: string
  readonly uploaded: boolean
  readonly url: string
}

export type StoredMediaDescriptor = {
  readonly body: string
  readonly etag: string
}

export type PutMediaDescriptorInput = {
  readonly collection: MediaCollection
  readonly notionId: string
  readonly previousEtag: string | null
  readonly value: unknown
}

export type PutMemeMediaDescriptorInput = {
  readonly notionId: string
  readonly previousEtag: string | null
  readonly value: unknown
}

type Environment = Readonly<Record<string, string | undefined>>

type CreateMediaStorageOptions = {
  readonly client?: MediaStorageClient
  readonly clientFactory?: (config: S3ClientConfig) => MediaStorageClient
  readonly env?: Environment
}

export function createMediaStorage(options: CreateMediaStorageOptions = {}) {
  const config = mediaStorageConfig(options.env ?? process.env)
  const client =
    options.client ??
    (options.clientFactory ?? ((input) => new S3Client(input)))(
      config.clientConfig
    )

  function publicUrl(key: string) {
    return `${config.publicBaseUrl}/${key}`
  }

  async function hasObject(key: string) {
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: config.mediaBucketName, Key: key })
      )
      return true
    } catch (err) {
      if (isNotFound(err)) return false
      throw err
    }
  }

  async function getDescriptor(
    collection: MediaCollection,
    notionId: string
  ): Promise<StoredMediaDescriptor | null> {
    const key = mediaDescriptorObjectKey(collection, notionId)
    return getStoredDescriptor(key)
  }

  async function getMemeDescriptor(
    notionId: string
  ): Promise<StoredMediaDescriptor | null> {
    return getStoredDescriptor(memeMediaDescriptorObjectKey(notionId))
  }

  async function getStoredDescriptor(
    key: string
  ): Promise<StoredMediaDescriptor | null> {
    let response: GetObjectCommandOutput
    try {
      response = (await client.send(
        new GetObjectCommand({ Bucket: config.stateBucketName, Key: key })
      )) as GetObjectCommandOutput
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }

    if (!response.Body) {
      throw new Error(`Media descriptor ${key} has no body`)
    }
    if (!response.ETag) {
      throw new Error(`Media descriptor ${key} has no ETag`)
    }

    const body = await response.Body.transformToString('utf-8')
    return { body, etag: response.ETag }
  }

  async function putDescriptor(input: PutMediaDescriptorInput) {
    const key = mediaDescriptorObjectKey(input.collection, input.notionId)
    await putStoredDescriptor(key, input.previousEtag, input.value)
  }

  async function putMemeDescriptor(input: PutMemeMediaDescriptorInput) {
    const key = memeMediaDescriptorObjectKey(input.notionId)
    await putStoredDescriptor(key, input.previousEtag, input.value)
  }

  async function putStoredDescriptor(
    key: string,
    previousEtag: string | null,
    value: unknown
  ) {
    const body = Buffer.from(`${JSON.stringify(value)}\n`)

    await client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: config.stateBucketName,
        CacheControl: DESCRIPTOR_CACHE_CONTROL,
        ContentType: 'application/json',
        ...(previousEtag ? { IfMatch: previousEtag } : { IfNoneMatch: '*' }),
        Key: key
      })
    )
  }

  async function publish(input: PublishMediaInput): Promise<PublishedMedia> {
    const bytes = Buffer.from(input.bytes)
    const hash = sha256(bytes)
    const key = mediaObjectKey(input, hash)
    const url = publicUrl(key)

    if (await hasObject(key)) {
      return { hash, key, uploaded: false, url }
    }

    try {
      await client.send(
        new PutObjectCommand({
          Body: bytes,
          Bucket: config.mediaBucketName,
          CacheControl: CACHE_CONTROL,
          ContentType: 'image/webp',
          IfNoneMatch: '*',
          Key: key
        })
      )
      return { hash, key, uploaded: true, url }
    } catch (err) {
      if (isPreconditionFailed(err)) {
        return { hash, key, uploaded: false, url }
      }
      throw err
    }
  }

  return {
    getDescriptor,
    getMemeDescriptor,
    hasObject,
    publicUrl,
    publish,
    putDescriptor,
    putMemeDescriptor
  }
}

function mediaObjectKey(input: PublishMediaInput, hash: string) {
  if (input.purpose === 'scenario-meme') {
    if (input.collection !== 'scenarios') {
      throw new Error(
        'Scenario meme media must belong to the scenarios collection'
      )
    }
    return generatedMemeMediaObjectKey(input.notionId, input.variant, hash)
  }

  return generatedMediaObjectKey(
    input.collection,
    input.notionId,
    input.variant,
    hash
  )
}

function mediaStorageConfig(env: Environment) {
  const accessKeyId = requiredEnvironmentValue(env, 'S3_ACCESS_KEY_ID')
  const secretAccessKey = requiredEnvironmentValue(env, 'S3_SECRET_ACCESS_KEY')
  const endpoint = normalizeApiEndpoint(
    requiredEnvironmentValue(env, 'S3_API_ENDPOINT')
  )
  const mediaBucketName = requiredEnvironmentValue(env, 'S3_BUCKET_NAME')
  const stateBucketName = env.S3_STATE_BUCKET_NAME?.trim() || mediaBucketName
  const publicBaseUrl = normalizePublicBaseUrl(
    requiredEnvironmentValue(env, 'S3_PUBLIC_URL')
  )
  const region = env.S3_REGION?.trim() || DEFAULT_REGION

  if (
    endpoint.hostname.endsWith('.r2.cloudflarestorage.com') &&
    (!/^[0-9a-f]{32}$/i.test(accessKeyId) ||
      !/^[0-9a-f]{64}$/i.test(secretAccessKey))
  ) {
    throw new Error(
      'R2 requires its generated S3 Access Key ID and Secret Access Key, not a Cloudflare API token'
    )
  }

  return {
    clientConfig: {
      credentials: { accessKeyId, secretAccessKey },
      endpoint: endpoint.href,
      region
    } satisfies S3ClientConfig,
    mediaBucketName,
    publicBaseUrl,
    stateBucketName
  }
}

function normalizeApiEndpoint(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('S3_API_ENDPOINT must be a valid URL')
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'S3_API_ENDPOINT must use HTTPS without credentials, a query, or a fragment'
    )
  }

  return url
}

function requiredEnvironmentValue(env: Environment, name: string) {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required to sync generated media`)
  }
  return value
}

function normalizePublicBaseUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('S3_PUBLIC_URL must be a valid URL')
  }

  if (url.protocol !== 'https:') {
    throw new Error('S3_PUBLIC_URL must use HTTPS')
  }
  if (url.hostname.toLowerCase().endsWith('.r2.cloudflarestorage.com')) {
    throw new Error(
      'S3_PUBLIC_URL must be a public r2.dev or custom-domain URL, not the authenticated R2 API endpoint'
    )
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'S3_PUBLIC_URL must not contain credentials, a query, or a fragment'
    )
  }

  return url.toString().replace(/\/+$/, '')
}

function isNotFound(error: unknown) {
  return errorStatus(error) === 404 || errorName(error) === 'NotFound'
}

function isPreconditionFailed(error: unknown) {
  return errorStatus(error) === 412
}

function errorStatus(error: unknown) {
  if (!isRecord(error) || !isRecord(error.$metadata)) return undefined
  const status = error.$metadata.httpStatusCode
  return typeof status === 'number' ? status : undefined
}

function errorName(error: unknown) {
  if (!isRecord(error)) return undefined
  return typeof error.name === 'string' ? error.name : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
