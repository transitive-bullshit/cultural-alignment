import type { FocalPoint } from '@/lib/content/schema'

export type SpatialGalleryItem = Readonly<{
  id: string
  href: string
  slug: string
  title: string
  source: string
  releaseYear: string
  lens: string
  image: Readonly<{
    src: string
    alt: string
    blurDataURL: string
    width: number
    height: number
    focalPoint?: FocalPoint
  }>
}>

export type SpatialGalleryController = Readonly<{
  cancelIntro(): void
  clearHover(): void
  dragBy(deltaX: number, deltaY: number, deltaMilliseconds: number): void
  endDrag(): void
  getHistoryState(): SpatialGallerySceneState
  getFrameRect(index: number): SpatialFrameRect | null
  hoverAt(clientX: number, clientY: number): void
  pressAt(clientX: number, clientY: number): void
  recenter(index: number): void
  wheelBy(deltaX: number, deltaY: number): void
}>

export type SpatialGalleryTopology = 'desktop' | 'mobile'

export type SpatialGallerySceneState = Readonly<{
  offsetX: number
  topology: SpatialGalleryTopology
}>

export type SpatialFrameRect = Readonly<{
  height: number
  left: number
  top: number
  width: number
}>
