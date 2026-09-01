export function getGalleryLaneWindowStart(
  maximumLanes: number,
  visibleLanes: number,
  selectedLane: number,
  previousStart: number
) {
  assertLaneCount(maximumLanes, 'maximumLanes')
  assertLaneCount(visibleLanes, 'visibleLanes')
  if (visibleLanes > maximumLanes) {
    throw new RangeError('visibleLanes must not exceed maximumLanes')
  }
  if (!Number.isInteger(selectedLane) || selectedLane < 0) {
    throw new RangeError('selectedLane must be a non-negative integer')
  }

  const resolvedSelectedLane = Math.min(maximumLanes - 1, selectedLane)
  const minimumStart = Math.max(0, resolvedSelectedLane - visibleLanes + 1)
  const maximumStart = Math.min(
    resolvedSelectedLane,
    maximumLanes - visibleLanes
  )

  return Math.min(maximumStart, Math.max(minimumStart, previousStart))
}

export function isGalleryLaneActive(
  lane: number,
  windowStart: number,
  visibleLanes: number
) {
  return lane >= windowStart && lane < windowStart + visibleLanes
}

export function stepGalleryLaneCount(current: number, target: number) {
  assertLaneCount(current, 'current')
  assertLaneCount(target, 'target')

  return current === target ? current : current + Math.sign(target - current)
}

export function getGalleryLaneTargetY(
  lane: number,
  windowStart: number,
  visibleLanes: number,
  rowGap: number,
  hiddenLaneCenter: number
) {
  if (isGalleryLaneActive(lane, windowStart, visibleLanes)) {
    const rank = lane - windowStart
    return ((visibleLanes - 1) / 2 - rank) * rowGap
  }

  return lane < windowStart
    ? hiddenLaneCenter + (windowStart - lane - 1) * rowGap
    : -hiddenLaneCenter - (lane - (windowStart + visibleLanes)) * rowGap
}

export function getGalleryLaneTargetXOffset(
  lane: number,
  windowStart: number,
  visibleLanes: number,
  stagger: number
) {
  if (!isGalleryLaneActive(lane, windowStart, visibleLanes)) return 0

  const rank = lane - windowStart
  if (visibleLanes % 2 === 1 && rank === Math.floor(visibleLanes / 2)) {
    return 0
  }

  return (rank % 2 === 0 ? -1 : 1) * stagger
}

export function shouldRenderGalleryLane(
  active: boolean,
  positionSettled: boolean,
  wasRendered: boolean
) {
  return active || (wasRendered && !positionSettled)
}

export function syncGalleryTextureLaneMask(
  target: Uint8Array,
  rendered: ArrayLike<number>,
  targetWindowStart: number,
  targetVisibleLanes: number
) {
  if (target.length !== rendered.length) {
    throw new RangeError('texture lane masks must have matching lengths')
  }

  for (let lane = 0; lane < target.length; lane += 1) {
    target[lane] =
      rendered[lane] === 1 ||
      isGalleryLaneActive(lane, targetWindowStart, targetVisibleLanes)
        ? 1
        : 0
  }

  return target
}

function assertLaneCount(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}
