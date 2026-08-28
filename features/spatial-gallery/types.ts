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

export type SpatialGallerySceneState = Readonly<{
  offsetX: number
}>

export type SpatialFrameRect = Readonly<{
  height: number
  left: number
  top: number
  width: number
}>
