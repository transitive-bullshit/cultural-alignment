import type { ProjectedSurfaceSlot } from '@/lib/spatial/field'

export function collectNearbyItemIndices(
  slots: readonly ProjectedSurfaceSlot[],
  xPositions: ArrayLike<number>,
  visibilityLimit: number,
  target: Set<number>,
  velocityX = 0,
  lookaheadSeconds = 0
) {
  target.clear()
  for (const itemIndex of rankNearbyItemIndices(
    slots,
    xPositions,
    visibilityLimit,
    velocityX,
    lookaheadSeconds
  )) {
    target.add(itemIndex)
  }

  return target
}

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

export type TextureAdmissionPlan = Readonly<{
  admit: boolean
  evictItemIndex: number | null
}>

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
