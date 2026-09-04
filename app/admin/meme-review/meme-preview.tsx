'use client'

import { memo } from 'react'
import Image from 'next/image'

import type {
  MemeIdeaV1,
  MemeIdeaV2,
  MemeReviewAsset
} from '@/lib/meme-review/schema'

import styles from './meme-preview.module.css'

export type MemePreviewV1Image = Readonly<{
  src: string
  alt: string
  blurDataURL: string
  objectPosition: string
}>

export type MemePreviewProps =
  | Readonly<{
      mode: 'archived'
      idea: MemeIdeaV1
      image: MemePreviewV1Image
    }>
  | Readonly<{
      mode: 'current'
      idea: MemeIdeaV2
      assets: readonly MemeReviewAsset[]
    }>

type MemePreviewZone = MemeIdeaV2['preview']['zones'][number]

const currentImageSizes = '(min-width: 1200px) 30vw, 50vw'

export const MemePreview = memo(function MemePreview(props: MemePreviewProps) {
  return props.mode === 'archived' ? (
    <MemePreviewV1Renderer idea={props.idea} image={props.image} />
  ) : (
    <MemePreviewV2Renderer idea={props.idea} assets={props.assets} />
  )
})

function MemePreviewV1Renderer({
  idea,
  image
}: Readonly<{
  idea: MemeIdeaV1
  image: MemePreviewV1Image
}>) {
  return (
    <figure
      className={styles.previewV1}
      data-preview-renderer='1'
      data-preview-layout={idea.preview.layout}
      aria-label={`Archived preview of ${idea.id}`}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        unoptimized
        sizes='(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 33vw'
        placeholder='blur'
        blurDataURL={image.blurDataURL}
        loading='lazy'
        style={{ objectPosition: image.objectPosition }}
      />
      <div className={styles.previewV1Shade} aria-hidden='true' />
      <div className={styles.previewV1Caption}>
        {idea.caption_lines.map((line, index) => (
          <span key={`${idea.id}-${index}`} data-caption-line={index + 1}>
            {line}
          </span>
        ))}
      </div>
    </figure>
  )
}

function MemePreviewV2Renderer({
  idea,
  assets
}: Readonly<{
  idea: MemeIdeaV2
  assets: readonly MemeReviewAsset[]
}>) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const previewAssets = idea.preview.asset_ids.flatMap((assetId) => {
    const asset = assetsById.get(assetId)
    return asset ? [asset] : []
  })

  if (previewAssets.length !== idea.preview.asset_ids.length) {
    const missingAssetIds = idea.preview.asset_ids.filter(
      (assetId) => !assetsById.has(assetId)
    )

    return (
      <figure
        className={`${styles.previewV2} ${styles.previewError}`}
        data-preview-renderer='2'
        data-preview-error
        aria-label={`Preview unavailable for ${idea.id}`}
      >
        <figcaption>
          Missing preview {missingAssetIds.length === 1 ? 'asset' : 'assets'}:{' '}
          {missingAssetIds.join(', ')}
        </figcaption>
      </figure>
    )
  }

  return (
    <figure
      className={styles.previewV2}
      data-preview-renderer='2'
      data-preview-template={idea.preview.template}
      data-frame-mode={idea.preview.frame_mode}
      aria-label={`Preview of ${idea.id}`}
    >
      <div className={styles.mediaCanvas}>
        {previewAssets.map((asset) => (
          <PreviewAsset
            key={asset.id}
            asset={asset}
            frameMode={idea.preview.frame_mode}
          />
        ))}
      </div>

      <div className={styles.captionCanvas}>
        {idea.preview.zones.map((zone, zoneIndex) => (
          <CaptionZone
            key={`${idea.id}-zone-${zoneIndex}`}
            ideaId={idea.id}
            zone={zone}
            captionLines={idea.caption_lines}
          />
        ))}
      </div>
    </figure>
  )
}

function PreviewAsset({
  asset,
  frameMode
}: Readonly<{
  asset: MemeReviewAsset
  frameMode: MemeIdeaV2['preview']['frame_mode']
}>) {
  const objectPosition = getProtectedRegionFocus(asset)
  const usesBlurredBackdrop =
    frameMode === 'contain-blur' || frameMode === 'inset-blur'

  return (
    <div
      className={styles.mediaPanel}
      data-frame-mode={frameMode}
      data-preview-asset={asset.id}
    >
      {usesBlurredBackdrop ? (
        <Image
          className={styles.blurImage}
          src={asset.src}
          alt=''
          fill
          sizes={currentImageSizes}
          placeholder='blur'
          blurDataURL={asset.blur_data_url}
          unoptimized
          loading='lazy'
          style={{ objectPosition }}
        />
      ) : null}

      <div className={styles.primaryImageShell}>
        <Image
          className={styles.primaryImage}
          src={asset.src}
          alt={asset.alt}
          fill
          sizes={currentImageSizes}
          placeholder='blur'
          blurDataURL={asset.blur_data_url}
          unoptimized
          loading='lazy'
          style={{ objectPosition }}
        />
      </div>
    </div>
  )
}

function CaptionZone({
  ideaId,
  zone,
  captionLines
}: Readonly<{
  ideaId: string
  zone: MemePreviewZone
  captionLines: readonly string[]
}>) {
  const ZoneElement = zone.style === 'code' ? 'code' : 'div'

  return (
    <ZoneElement
      className={styles.captionZone}
      data-slot={zone.slot}
      data-zone-style={zone.style}
      data-backdrop={zone.backdrop}
      data-align={zone.align}
      data-casing={zone.casing}
      data-size={zone.size}
      data-width={zone.width}
    >
      {zone.lines.map((lineIndex, index) => (
        <span
          className={styles.captionLine}
          data-caption-line={lineIndex + 1}
          data-indent-level={zone.indent_levels[index]}
          key={`${ideaId}-${lineIndex}`}
        >
          {captionLines[lineIndex]}
        </span>
      ))}
    </ZoneElement>
  )
}

function getProtectedRegionFocus(asset: MemeReviewAsset): string {
  const mustKeepRegions = asset.protected_regions.filter(
    ({ priority }) => priority === 'must'
  )
  const focusRegions = mustKeepRegions.length
    ? mustKeepRegions
    : asset.protected_regions

  if (focusRegions.length === 0) return '50% 50%'

  let left = 100
  let top = 100
  let right = 0
  let bottom = 0

  for (const {
    source_rect: [x, y, width, height]
  } of focusRegions) {
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x + width)
    bottom = Math.max(bottom, y + height)
  }

  return `${(left + right) / 2}% ${(top + bottom) / 2}%`
}
