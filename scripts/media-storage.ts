import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from '@aws-sdk/client-s3'

import { generatedMediaObjectKey, sha256 } from './sync-utils'

const CACHE_CONTROL = 'public,max-age=31536000,immutable'
const DEFAULT_REGION = 'auto'

export type MediaCollection = 'scenarios' | 'sources'
export type MediaVariant = 'gallery' | 'detail'

export type MediaStorageClient = {
  send(command: HeadObjectCommand | PutObjectCommand): Promise<unknown>
}

export type PublishMediaInput = {
  readonly bytes: Uint8Array
  readonly collection: MediaCollection
  readonly notionId: string
  readonly variant: MediaVariant
}

export type PublishedMedia = {
  readonly hash: string
  readonly key: string
  readonly uploaded: boolean
  readonly url: string
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
        new HeadObjectCommand({ Bucket: config.bucketName, Key: key })
      )
      return true
    } catch (err) {
      if (isNotFound(err)) return false
      throw err
    }
  }

  async function publish(input: PublishMediaInput): Promise<PublishedMedia> {
    const bytes = Buffer.from(input.bytes)
    const hash = sha256(bytes)
    const key = generatedMediaObjectKey(
      input.collection,
      input.notionId,
      input.variant,
      hash
    )
    const url = publicUrl(key)

    if (await hasObject(key)) {
      return { hash, key, uploaded: false, url }
    }

    try {
      await client.send(
        new PutObjectCommand({
          Body: bytes,
          Bucket: config.bucketName,
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

  return { hasObject, publicUrl, publish }
}

function mediaStorageConfig(env: Environment) {
  const accessKeyId = requiredEnvironmentValue(env, 'S3_ACCESS_KEY_ID')
  const secretAccessKey = requiredEnvironmentValue(env, 'S3_SECRET_ACCESS_KEY')
  const endpoint = normalizeApiEndpoint(
    requiredEnvironmentValue(env, 'S3_API_ENDPOINT')
  )
  const bucketName = requiredEnvironmentValue(env, 'S3_BUCKET_NAME')
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
    bucketName,
    clientConfig: {
      credentials: { accessKeyId, secretAccessKey },
      endpoint: endpoint.href,
      region
    } satisfies S3ClientConfig,
    publicBaseUrl
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
    throw new Error(`${name} is required to publish generated media`)
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
