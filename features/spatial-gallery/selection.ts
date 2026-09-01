import {
  toroidalDelta,
  wrapCentered,
  type ProjectedSurfaceSlot
} from '@/lib/spatial/field'

export const DIMMED_ACTIVITY = 0.16

export type ActiveSlot = Readonly<{
  itemIndex: number
  slotIndex: number
}>

type NdcPoint = Readonly<{
  x: number
  y: number
}>

type WarpedPointerOptions = Readonly<{
  activeLanes?: ArrayLike<number>
  frameHeight: number
  frameWidth: number
  hitPadding?: number
  pointerNdc: NdcPoint
  rowGap: number
  scales: ArrayLike<number>
  slots: readonly ProjectedSurfaceSlot[]
  viewportAspect: number
  viewportWidth: number
  warpSpeed: number
  xPositions: ArrayLike<number>
  yPositions?: ArrayLike<number>
}>

export function resolveVisualSlotIndex(
  activeSlot: ActiveSlot | null,
  slots: readonly ProjectedSurfaceSlot[]
) {
  if (!activeSlot) return null

  return slots[activeSlot.slotIndex]?.itemIndex === activeSlot.itemIndex
    ? activeSlot.slotIndex
    : null
}

export function getSlotActivityTarget(
  slotIndex: number,
  activeSlotIndex: number | null
) {
  return slotIndex === activeSlotIndex ? 1 : DIMMED_ACTIVITY
}

export function getSlotScaleTarget(
  active: boolean,
  reducedMotion: boolean,
  selectedScale: number
) {
  return active && !reducedMotion ? selectedScale : 1
}

export function getDirectionalDamping(
  current: number,
  target: number,
  enterDamping: number,
  exitDamping: number
) {
  return target > current ? enterDamping : exitDamping
}

export function resolveVisibleRestoredOffset({
  frameWidth,
  offsetX,
  slotX,
  span,
  viewportWidth
}: Readonly<{
  frameWidth: number
  offsetX: number
  slotX: number
  span: number
  viewportWidth: number
}>) {
  const visibleX = wrapCentered(slotX + offsetX, span)
  const visibilityLimit = viewportWidth / 2 + frameWidth / 2

  return Math.abs(visibleX) <= visibilityLimit
    ? offsetX
    : offsetX + toroidalDelta(visibleX, 0, span)
}

export function calculateGalleryWarpOffset(
  ndcX: number,
  rowCoefficient: number,
  warpSpeed: number,
  viewportAspect: number
) {
  const u = Math.min(1, Math.max(0, ndcX * 0.5 + 0.5))
  const edge = 0.15 * warpSpeed * Math.tan(0.9 * Math.PI * (u - 0.5))
  const row = -2 * warpSpeed * rowCoefficient * (0.016667 * viewportAspect)

  return edge + row
}

export function resolveWarpedPointerSlot({
  activeLanes,
  frameHeight,
  frameWidth,
  hitPadding = 0,
  pointerNdc,
  rowGap,
  scales,
  slots,
  viewportAspect,
  viewportWidth,
  warpSpeed,
  xPositions,
  yPositions
}: WarpedPointerOptions): ActiveSlot | null {
  const viewportHeight = viewportWidth / viewportAspect
  let activeSlot: ActiveSlot | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const [slotIndex, slot] of slots.entries()) {
    if (activeLanes && activeLanes[slot.lane] !== 1) continue

    const scale = scales[slotIndex] ?? 1
    const y = yPositions?.[slotIndex] ?? slot.y
    const centerX = ((xPositions[slotIndex] ?? slot.x) * 2) / viewportWidth
    const halfWidth = (frameWidth * scale + hitPadding * 2) / viewportWidth
    const localX = (pointerNdc.x - centerX) / halfWidth
    if (Math.abs(localX) > 1) continue

    const warpOffset = calculateGalleryWarpOffset(
      pointerNdc.x,
      y / rowGap,
      warpSpeed,
      viewportAspect
    )
    const unwarpedPointerY = pointerNdc.y - warpOffset
    const centerY = (y * 2) / viewportHeight
    const halfHeight = (frameHeight * scale + hitPadding * 2) / viewportHeight
    const localY = (unwarpedPointerY - centerY) / halfHeight
    if (Math.abs(localY) > 1) continue

    const distance = localX * localX + localY * localY
    if (distance >= nearestDistance) continue

    activeSlot = { itemIndex: slot.itemIndex, slotIndex }
    nearestDistance = distance
  }

  return activeSlot
}
