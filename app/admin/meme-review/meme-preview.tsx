'use client'

import { memo } from 'react'
import Image from 'next/image'

import type { MemeReviewScenario } from '@/lib/meme-review/catalog'
import type { MemeIdea } from '@/lib/meme-review/schema'

import styles from './meme-review.module.css'

export const MemePreview = memo(function MemePreview({
  idea,
  image
}: {
  readonly idea: MemeIdea
  readonly image: MemeReviewScenario['image']
}) {
  return (
    <figure
      className={styles.preview}
      data-preview-layout={idea.preview.layout}
      aria-label={`Preview of ${idea.id}`}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes='(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 33vw'
        placeholder='blur'
        blurDataURL={image.blurDataURL}
        loading='lazy'
        style={{ objectPosition: image.objectPosition }}
      />
      <div className={styles.previewShade} aria-hidden='true' />
      <div className={styles.caption}>
        {idea.caption_lines.map((line, index) => (
          <span key={`${idea.id}-${index}`} data-caption-line={index + 1}>
            {line}
          </span>
        ))}
      </div>
      {idea.preview.image === 'alternate-needed' ? (
        <figcaption className={styles.alternateFrameFlag}>
          Alternate frame proposed
        </figcaption>
      ) : null}
    </figure>
  )
})
