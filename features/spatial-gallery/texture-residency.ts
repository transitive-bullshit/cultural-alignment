import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

const MOBILE_VIEWPORT_MAX_WIDTH = 680
const MOBILE_TEXTURE_BINDING_LIMIT = 128
const DESKTOP_TEXTURE_BINDING_LIMIT = 256

export function isMobileGalleryViewport(viewportWidth: number) {
  return viewportWidth <= MOBILE_VIEWPORT_MAX_WIDTH
}

export function getTextureBindingLimit(viewportWidth: number) {
  return isMobileGalleryViewport(viewportWidth)
    ? MOBILE_TEXTURE_BINDING_LIMIT
    : DESKTOP_TEXTURE_BINDING_LIMIT
}

type RankedTextureItem = Readonly<{
  distance: number
  itemIndex: number
  zone: number
}>

export type TextureItemPriority = Readonly<{
  foregroundItemIndices: readonly number[]
  idleItemIndices: readonly number[]
}>

export function prioritizeTextureItemIndices(
  slots: readonly ProjectedSurfaceSlot[],
  xPositions: ArrayLike<number>,
  visibilityLimit: number,
  velocityX = 0,
  lookaheadSeconds = 0,
  includedLanes?: ArrayLike<number>
): TextureItemPriority {
  const velocityLead = velocityX * lookaheadSeconds
  const minimumX = -visibilityLimit - Math.max(0, velocityLead)
  const maximumX = visibilityLimit + Math.max(0, -velocityLead)
  const bestCandidateByItem = new Map<number, RankedTextureItem>()

  for (const [slotIndex, slot] of slots.entries()) {
    if (includedLanes && includedLanes[slot.lane] !== 1) continue

    const x = xPositions[slotIndex] ?? slot.x
    const insideCurrentRange = Math.abs(x) <= visibilityLimit
    const insideDirectionalLookahead = x >= minimumX && x <= maximumX
    const candidate = {
      distance:
        insideCurrentRange || !insideDirectionalLookahead
          ? Math.abs(x)
          : Math.abs(x + velocityLead),
      itemIndex: slot.itemIndex,
      zone: insideCurrentRange ? 0 : insideDirectionalLookahead ? 1 : 2
    }
    const current = bestCandidateByItem.get(slot.itemIndex)
    if (
      current &&
      (current.zone < candidate.zone ||
        (current.zone === candidate.zone &&
          current.distance <= candidate.distance))
    ) {
      continue
    }

    bestCandidateByItem.set(slot.itemIndex, candidate)
  }

  const ranked = [...bestCandidateByItem.values()].toSorted((left, right) => {
    const zoneOrder = left.zone - right.zone
    if (zoneOrder !== 0) return zoneOrder

    const distanceOrder = left.distance - right.distance
    return distanceOrder !== 0
      ? distanceOrder
      : left.itemIndex - right.itemIndex
  })

  return {
    foregroundItemIndices: ranked
      .filter(({ zone }) => zone < 2)
      .map(({ itemIndex }) => itemIndex),
    idleItemIndices: ranked
      .filter(({ zone }) => zone === 2)
      .map(({ itemIndex }) => itemIndex)
  }
}

type ItemMembership = Readonly<{
  has(itemIndex: number): boolean
}>

type TextureBindingPlanOptions = Readonly<{
  boundItemIndices: Iterable<number> & ItemMembership
  fullItemIndices: ItemMembership
  maximumBoundTextures: number
  prioritizedItemIndices: readonly number[]
  residentItemIndices: ItemMembership
}>

type TextureBindingPlan = Readonly<{
  bindItemIndices: readonly number[]
  evictItemIndices: readonly number[]
}>

export function planTextureBindings({
  boundItemIndices,
  fullItemIndices,
  maximumBoundTextures,
  prioritizedItemIndices,
  residentItemIndices
}: TextureBindingPlanOptions): TextureBindingPlan {
  const desiredItemIndices: number[] = []
  const maximum = Math.max(0, maximumBoundTextures)

  for (const itemIndex of prioritizedItemIndices) {
    if (desiredItemIndices.length >= maximum) break
    if (fullItemIndices.has(itemIndex) && residentItemIndices.has(itemIndex)) {
      desiredItemIndices.push(itemIndex)
    }
  }

  const desired = new Set(desiredItemIndices)
  return {
    bindItemIndices: desiredItemIndices.filter(
      (itemIndex) => !boundItemIndices.has(itemIndex)
    ),
    evictItemIndices: [...boundItemIndices].filter(
      (itemIndex) => !desired.has(itemIndex)
    )
  }
}

type TextureLoadPlanOptions = Readonly<{
  failedFull: ItemMembership
  failedPlaceholder: ItemMembership
  full: ItemMembership
  fullLoadCapacity: number
  pendingFull: ItemMembership
  pendingPlaceholder: ItemMembership
  placeholderLoadCapacity: number
  prioritizedItemIndices: readonly number[]
  resident: ItemMembership
}>

type TextureLoadPlan = Readonly<{
  fullItemIndices: readonly number[]
  placeholderItemIndices: readonly number[]
}>

export function planTextureLoads({
  failedFull,
  failedPlaceholder,
  full,
  fullLoadCapacity,
  pendingFull,
  pendingPlaceholder,
  placeholderLoadCapacity,
  prioritizedItemIndices,
  resident
}: TextureLoadPlanOptions): TextureLoadPlan {
  const fullItemIndices: number[] = []
  const placeholderItemIndices: number[] = []

  for (const itemIndex of prioritizedItemIndices) {
    if (
      fullItemIndices.length < fullLoadCapacity &&
      !full.has(itemIndex) &&
      !pendingFull.has(itemIndex) &&
      !failedFull.has(itemIndex)
    ) {
      fullItemIndices.push(itemIndex)
    }

    if (
      placeholderItemIndices.length < placeholderLoadCapacity &&
      !resident.has(itemIndex) &&
      !pendingPlaceholder.has(itemIndex) &&
      !failedPlaceholder.has(itemIndex)
    ) {
      placeholderItemIndices.push(itemIndex)
    }
  }

  return { fullItemIndices, placeholderItemIndices }
}

export type TextureLoadStage = 'full' | 'placeholder'

type SettleTextureLoadOptions<TextureResource> = Readonly<{
  activeItemIndices: ItemMembership
  current: boolean
  dispose(texture: TextureResource): void
  fullItemIndices: Set<number>
  itemIndex: number
  onBind(texture: TextureResource): void
  residentTextures: Map<number, TextureResource>
  stage: TextureLoadStage
  texture: TextureResource
}>

export function settleTextureLoad<TextureResource>({
  activeItemIndices,
  current,
  dispose,
  fullItemIndices,
  itemIndex,
  onBind,
  residentTextures,
  stage,
  texture
}: SettleTextureLoadOptions<TextureResource>) {
  if (
    !current ||
    (stage === 'placeholder' &&
      (!activeItemIndices.has(itemIndex) || fullItemIndices.has(itemIndex)))
  ) {
    dispose(texture)
    return false
  }

  const previousTexture = residentTextures.get(itemIndex)
  residentTextures.set(itemIndex, texture)
  if (stage === 'full') fullItemIndices.add(itemIndex)
  onBind(texture)
  if (previousTexture && previousTexture !== texture) {
    dispose(previousTexture)
  }

  return true
}
