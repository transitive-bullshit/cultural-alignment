import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

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
  xPositions
}: WarpedPointerOptions): ActiveSlot | null {
  const viewportHeight = viewportWidth / viewportAspect
  let activeSlot: ActiveSlot | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const [slotIndex, slot] of slots.entries()) {
    const scale = scales[slotIndex] ?? 1
    const centerX = ((xPositions[slotIndex] ?? slot.x) * 2) / viewportWidth
    const halfWidth = (frameWidth * scale + hitPadding * 2) / viewportWidth
    const localX = (pointerNdc.x - centerX) / halfWidth
    if (Math.abs(localX) > 1) continue

    const warpOffset = calculateGalleryWarpOffset(
      pointerNdc.x,
      slot.y / rowGap,
      warpSpeed,
      viewportAspect
    )
    const unwarpedPointerY = pointerNdc.y - warpOffset
    const centerY = (slot.y * 2) / viewportHeight
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
