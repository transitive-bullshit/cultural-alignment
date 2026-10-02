import Image from 'next/image'
import Link from 'next/link'

import type {
  FranchiseResourceSummary,
  SourceResourceSummary
} from '@/lib/content/catalog'
import { focalPointToObjectPosition } from '@/lib/media/crop'

import styles from './resource-pages.module.css'

type MediaResource = SourceResourceSummary | FranchiseResourceSummary

/**
 * Media sources and franchises are recognized by their art, so their index
 * cards lead with a poster (2:3) or key art (16:9); the title and a meta line
 * start on the image's left edge.
 */
export function MediaResourceCard({
  headingLevel = 2,
  resource
}: {
  readonly headingLevel?: 2 | 3
  readonly resource: MediaResource
}) {
  const ResourceTitle = headingLevel === 2 ? 'h2' : 'h3'
  const image = resource.kind === 'source' ? resource.poster : resource.image

  return (
    <li
      data-resource-id={resource.id}
      data-resource-release-date={
        resource.kind === 'source'
          ? (resource.releaseDate ?? undefined)
          : undefined
      }
    >
      <Link
        className={styles.mediaCard}
        href={resource.href}
        data-media-card={resource.kind}
      >
        <span className={styles.mediaFrame} data-media-card-image>
          {image ? (
            // The title follows in the same link, so the art is decorative.
            <Image
              src={image.gallerySrc}
              alt=''
              fill
              loading='lazy'
              placeholder='blur'
              blurDataURL={image.blurDataURL}
              sizes={
                resource.kind === 'source'
                  ? '(max-width: 680px) 45vw, 200px'
                  : '(max-width: 680px) 45vw, 300px'
              }
              style={{
                objectFit: 'cover',
                objectPosition: focalPointToObjectPosition(image.focalPoint)
              }}
            />
          ) : null}
        </span>
        <ResourceTitle className={styles.mediaTitle}>
          {resource.title}
        </ResourceTitle>
        <p className={styles.mediaMeta} data-media-card-meta>
          {formatMediaMeta(resource)}
        </p>
      </Link>
    </li>
  )
}

export function formatSceneCount(count: number) {
  return `${count} ${count === 1 ? 'scene' : 'scenes'}`
}

export function formatSourceType(sourceType: 'movie' | 'tv-show') {
  return sourceType === 'movie' ? 'Movie' : 'TV show'
}

function formatMediaMeta(resource: MediaResource) {
  if (resource.kind === 'franchise') {
    return [
      `${resource.sourceCount} ${resource.sourceCount === 1 ? 'work' : 'works'}`,
      formatSceneCount(resource.scenarioCount)
    ].join(' · ')
  }

  return [
    formatSourceType(resource.sourceType),
    resource.releaseDate?.slice(0, 4),
    formatSceneCount(resource.scenarioCount)
  ]
    .filter(Boolean)
    .join(' · ')
}
