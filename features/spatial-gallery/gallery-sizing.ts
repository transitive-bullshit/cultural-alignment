export const GALLERY_ITEM_SIZE_MIN = 70
export const GALLERY_ITEM_SIZE_DEFAULT = 100
export const GALLERY_ITEM_SIZE_MAX = 200
export const GALLERY_ITEM_SIZE_STEP = 5

export const GALLERY_FRAME_ASPECT = 1.72
export const GALLERY_SELECTED_SCALE = 1.045
export const GALLERY_BRACKET_INSET_RATIO = 0.045
export const GALLERY_BRACKET_THICKNESS_RATIO = 0.011

type GalleryGeometry = Readonly<{
  columnGap: number
  defaultLanes: number
  frameWidth: number
  maximumLanes: number
  minimumLanes: number
  overscan: number
  rowGap: number
  stagger: number
}>

const DESKTOP_GEOMETRY: GalleryGeometry = {
  columnGap: 1.76,
  defaultLanes: 5,
  frameWidth: 1.4,
  maximumLanes: 7,
  minimumLanes: 1,
  overscan: 0.75,
  rowGap: 1.45,
  stagger: 0.28
}

const MOBILE_GEOMETRY: GalleryGeometry = {
  columnGap: 2.8,
  defaultLanes: 3,
  frameWidth: 2.72,
  maximumLanes: 5,
  minimumLanes: 1,
  overscan: 0.75,
  rowGap: 2.35,
  stagger: 0
}

export function normalizeGalleryItemSize(value: number) {
  if (!Number.isFinite(value)) return GALLERY_ITEM_SIZE_DEFAULT

  const clamped = Math.min(
    GALLERY_ITEM_SIZE_MAX,
    Math.max(GALLERY_ITEM_SIZE_MIN, value)
  )
  const steps = Math.round(
    (clamped - GALLERY_ITEM_SIZE_MIN) / GALLERY_ITEM_SIZE_STEP
  )

  return GALLERY_ITEM_SIZE_MIN + steps * GALLERY_ITEM_SIZE_STEP
}

export function parseStoredGalleryItemSize(value: string | null) {
  if (value === null || value.trim() === '') return GALLERY_ITEM_SIZE_DEFAULT

  const parsed = Number(value)
  if (
    !Number.isFinite(parsed) ||
    parsed < GALLERY_ITEM_SIZE_MIN ||
    parsed > GALLERY_ITEM_SIZE_MAX
  ) {
    return GALLERY_ITEM_SIZE_DEFAULT
  }

  return normalizeGalleryItemSize(parsed)
}

export function getGalleryGeometry(mobile: boolean) {
  return mobile ? MOBILE_GEOMETRY : DESKTOP_GEOMETRY
}

export function getGalleryTargetZoom(
  mobile: boolean,
  width: number,
  height: number,
  itemSize: number
) {
  const baseZoom = mobile
    ? Math.max(76, width / 5.2, height / 10.4)
    : getDesktopBaseZoom(width, height)
  const requestedZoom = baseZoom * (normalizeGalleryItemSize(itemSize) / 100)

  if (!mobile) return requestedZoom

  const geometry = getGalleryGeometry(true)
  const oneLaneFitZoom =
    height / (getGalleryDecoratedFrameHalfHeight(geometry.frameWidth) * 2)

  return Math.min(requestedZoom, oneLaneFitZoom)
}

export function getGalleryLaneCount(
  mobile: boolean,
  width: number,
  height: number,
  itemSize: number
) {
  const zoom = getGalleryTargetZoom(mobile, width, height, itemSize)

  return getGalleryLaneCountForZoom(mobile, height, zoom)
}

export function getGalleryLaneCountForZoom(
  mobile: boolean,
  height: number,
  zoom: number
) {
  const geometry = getGalleryGeometry(mobile)
  const decoratedFrameHalfHeight = getGalleryDecoratedFrameHalfHeight(
    geometry.frameWidth
  )
  const fittingLanes =
    Math.floor(
      Math.max(0, height / zoom - decoratedFrameHalfHeight * 2) /
        geometry.rowGap +
        1e-6
    ) + 1

  return Math.min(
    geometry.maximumLanes,
    Math.max(geometry.minimumLanes, fittingLanes)
  )
}

export function getGalleryLayoutViewportWidth(
  mobile: boolean,
  width: number,
  height: number
) {
  return (
    width / getGalleryTargetZoom(mobile, width, height, GALLERY_ITEM_SIZE_MIN)
  )
}

export function getGalleryViewportMetrics(
  mobile: boolean,
  width: number,
  height: number,
  itemSize: number
) {
  const geometry = getGalleryGeometry(mobile)
  const zoom = getGalleryTargetZoom(mobile, width, height, itemSize)
  const lanes = getGalleryLaneCount(mobile, width, height, itemSize)

  return {
    columnPitchPixels: geometry.columnGap * zoom,
    compositionHeightPixels:
      ((lanes - 1) * geometry.rowGap +
        getGalleryDecoratedFrameHalfHeight(geometry.frameWidth) * 2) *
      zoom,
    frameWidthPixels: geometry.frameWidth * zoom,
    lanes,
    rowPitchPixels: geometry.rowGap * zoom,
    zoom
  } as const
}

function getDesktopBaseZoom(width: number, height: number) {
  const densityZoom = Math.max(90, width / 20.5, height / 7.15)
  const outerLaneCenter = 2 * DESKTOP_GEOMETRY.rowGap
  const requiredHalfHeight =
    outerLaneCenter +
    getGalleryDecoratedFrameHalfHeight(DESKTOP_GEOMETRY.frameWidth)
  const verticalFitZoom = height / (requiredHalfHeight * 2)

  return Math.min(densityZoom, verticalFitZoom)
}

export function getGalleryDecoratedFrameHalfHeight(frameWidth: number) {
  return (
    (frameWidth / GALLERY_FRAME_ASPECT) * (GALLERY_SELECTED_SCALE / 2) +
    frameWidth * GALLERY_SELECTED_SCALE * GALLERY_BRACKET_INSET_RATIO +
    (frameWidth * GALLERY_SELECTED_SCALE * GALLERY_BRACKET_THICKNESS_RATIO) / 2
  )
}
