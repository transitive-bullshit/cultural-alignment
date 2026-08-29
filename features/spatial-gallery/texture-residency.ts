import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

export function rankNearbyItemIndices(
  slots: readonly ProjectedSurfaceSlot[],
  xPositions: ArrayLike<number>,
  visibilityLimit: number,
  velocityX = 0,
  lookaheadSeconds = 0
) {
  const velocityLead = velocityX * lookaheadSeconds
  const minimumX = -visibilityLimit - Math.max(0, velocityLead)
  const maximumX = visibilityLimit + Math.max(0, -velocityLead)
  const bestCandidateByItem = new Map<
    number,
    Readonly<{ distance: number; zone: number }>
  >()

  for (const [slotIndex, slot] of slots.entries()) {
    const x = xPositions[slotIndex] ?? slot.x
    if (x < minimumX || x > maximumX) continue

    const insideCurrentRange = Math.abs(x) <= visibilityLimit
    const candidate = {
      distance: insideCurrentRange ? Math.abs(x) : Math.abs(x + velocityLead),
      zone: insideCurrentRange ? 0 : 1
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

  return [...bestCandidateByItem.entries()]
    .toSorted((left, right) => {
      const zoneOrder = left[1].zone - right[1].zone
      if (zoneOrder !== 0) return zoneOrder

      const distanceOrder = left[1].distance - right[1].distance
      return distanceOrder !== 0 ? distanceOrder : left[0] - right[0]
    })
    .map(([itemIndex]) => itemIndex)
}

type TextureAdmissionPlan = Readonly<{
  admit: boolean
  evictItemIndex: number | null
}>

type ItemMembership = Readonly<{
  has(itemIndex: number): boolean
}>

type TextureLoadPlanOptions = Readonly<{
  failedFull: ItemMembership
  failedPlaceholder: ItemMembership
  full: ItemMembership
  fullLoadCapacity: number
  maximumResidentTextures: number
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
  maximumResidentTextures,
  pendingFull,
  pendingPlaceholder,
  placeholderLoadCapacity,
  prioritizedItemIndices,
  resident
}: TextureLoadPlanOptions): TextureLoadPlan {
  const fullItemIndices: number[] = []
  const placeholderItemIndices: number[] = []
  const candidates = prioritizedItemIndices.slice(0, maximumResidentTextures)

  for (const itemIndex of candidates) {
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

export function planTextureAdmission(
  residentItemIndices: Iterable<number>,
  incomingItemIndex: number,
  maximumResidentTextures: number,
  priorityItemIndices: readonly number[],
  lastSeen: ReadonlyMap<number, number>
): TextureAdmissionPlan {
  const resident = [...residentItemIndices]
  if (resident.includes(incomingItemIndex)) {
    return { admit: true, evictItemIndex: null }
  }
  if (resident.length < maximumResidentTextures) {
    return { admit: true, evictItemIndex: null }
  }

  const priorityByItem = new Map(
    priorityItemIndices.map((itemIndex, priority) => [itemIndex, priority])
  )
  let evictionCandidate: number | null = null
  let evictionPriority = Number.NEGATIVE_INFINITY
  let evictionLastSeen = Number.POSITIVE_INFINITY

  for (const itemIndex of resident) {
    const priority = priorityByItem.get(itemIndex) ?? Number.POSITIVE_INFINITY
    const seenAt = lastSeen.get(itemIndex) ?? Number.NEGATIVE_INFINITY
    if (
      priority > evictionPriority ||
      (priority === evictionPriority && seenAt < evictionLastSeen)
    ) {
      evictionCandidate = itemIndex
      evictionPriority = priority
      evictionLastSeen = seenAt
    }
  }

  const incomingPriority =
    priorityByItem.get(incomingItemIndex) ?? Number.POSITIVE_INFINITY

  return {
    admit: evictionCandidate !== null && incomingPriority < evictionPriority,
    evictItemIndex:
      evictionCandidate !== null && incomingPriority < evictionPriority
        ? evictionCandidate
        : null
  }
}

export type TextureLoadStage = 'full' | 'placeholder'

type SettleTextureLoadOptions<TextureResource> = Readonly<{
  activeItemIndices: ItemMembership
  current: boolean
  dispose(texture: TextureResource): void
  fullItemIndices: Set<number>
  itemIndex: number
  lastSeen: ReadonlyMap<number, number>
  maximumResidentTextures: number
  onBind(texture: TextureResource): void
  onEvict(itemIndex: number): void
  prioritizedItemIndices: readonly number[]
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
  lastSeen,
  maximumResidentTextures,
  onBind,
  onEvict,
  prioritizedItemIndices,
  residentTextures,
  stage,
  texture
}: SettleTextureLoadOptions<TextureResource>) {
  if (
    !current ||
    !activeItemIndices.has(itemIndex) ||
    (stage === 'placeholder' && fullItemIndices.has(itemIndex))
  ) {
    dispose(texture)
    return false
  }

  const admission = planTextureAdmission(
    residentTextures.keys(),
    itemIndex,
    maximumResidentTextures,
    prioritizedItemIndices,
    lastSeen
  )
  if (!admission.admit) {
    dispose(texture)
    return false
  }
  if (admission.evictItemIndex !== null) {
    onEvict(admission.evictItemIndex)
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
