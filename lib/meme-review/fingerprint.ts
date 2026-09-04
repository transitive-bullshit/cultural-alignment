import type { MemeIdeaV1, MemeIdeaV2, MemeReviewAsset } from './schema'

export type MemeFinalizationImage = {
  readonly src: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly blurDataURL: string
  readonly objectPosition: string
  readonly contentHash: string
}

export type MemeFinalizationPayload =
  | {
      readonly renderer: 1
      readonly idea: MemeIdeaV1
      readonly image: MemeFinalizationImage
    }
  | {
      readonly renderer: 2
      readonly idea: MemeIdeaV2
      readonly assets: readonly MemeReviewAsset[]
    }

/**
 * Binds a finalization click to the exact idea and referenced asset records
 * shown to the reviewer. This is a stale-write token, not a security digest.
 */
export function memeFinalizationFingerprint(
  idea: MemeIdeaV2,
  assets: readonly MemeReviewAsset[]
) {
  return memeRevisionFingerprint({ renderer: 2, idea, assets })
}

export function memeRevisionFingerprint(payload: MemeFinalizationPayload) {
  const value =
    payload.renderer === 1
      ? JSON.stringify({ idea: payload.idea, image: payload.image })
      : v2FingerprintValue(payload.idea, payload.assets)

  return hashFingerprintValue(value)
}

function v2FingerprintValue(
  idea: MemeIdeaV2,
  assets: readonly MemeReviewAsset[]
) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const referencedAssets = idea.preview.asset_ids.map((assetId) => {
    const asset = assetsById.get(assetId)
    if (!asset) {
      throw new Error(`${idea.id} references missing asset ${assetId}`)
    }
    return asset
  })
  return JSON.stringify({ idea, assets: referencedAssets })
}

function hashFingerprintValue(value: string) {
  let left = 0x811c9dc5
  let right = 0x9e3779b9

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    left = Math.imul(left ^ code, 0x01000193)
    right = Math.imul(right ^ code, 0x85ebca6b)
  }

  return `v1-${hex(left)}${hex(right)}-${value.length}`
}

function hex(value: number) {
  return (value >>> 0).toString(16).padStart(8, '0')
}
