export type Point2D = Readonly<{
  x: number
  y: number
}>

export type FieldMotion = Readonly<{
  offset: Point2D
  velocity: Point2D
}>

export type ProjectedSurfaceLayoutOptions = Readonly<{
  lanes: number
  columnGap: number
  rowGap: number
  viewportWidth: number
  itemWidth: number
  overscan?: number
  stagger?: number
}>

export type ProjectedSurfaceSlot = Readonly<{
  column: number
  itemIndex: number
  lane: number
  x: number
  y: number
}>

export function wrapCentered(value: number, span: number) {
  assertFinite(value, 'value')
  assertPositive(span, 'span')

  return ((((value + span / 2) % span) + span) % span) - span / 2
}

export function toroidalDelta(from: number, to: number, span: number) {
  return wrapCentered(to - from, span)
}

export function createProjectedSurfaceLayout(
  itemCount: number,
  options: ProjectedSurfaceLayoutOptions
) {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    throw new RangeError('itemCount must be a positive integer')
  }

  if (!Number.isInteger(options.lanes) || options.lanes <= 0) {
    throw new RangeError('lanes must be a positive integer')
  }

  assertPositive(options.columnGap, 'columnGap')
  assertPositive(options.rowGap, 'rowGap')
  assertPositive(options.viewportWidth, 'viewportWidth')
  assertPositive(options.itemWidth, 'itemWidth')
  const overscan = options.overscan ?? 0
  const stagger = options.stagger ?? 0
  assertNonNegative(overscan, 'overscan')
  assertFinite(stagger, 'stagger')

  const protectedWidth =
    options.viewportWidth + options.itemWidth * 2 + overscan * 2
  const minimumColumns = Math.max(
    3,
    itemCount,
    Math.ceil(protectedWidth / options.columnGap)
  )
  const centeredColumns =
    minimumColumns % 2 === 0 ? minimumColumns + 1 : minimumColumns
  // A two-item odd ring cannot close without equal neighbors.
  const columns =
    itemCount === 2 ? minimumColumns + (minimumColumns % 2) : centeredColumns
  const centerColumn = (columns - 1) / 2
  const span = columns * options.columnGap
  const columnStride = findCoprimeStep(itemCount, options.lanes + 2)
  const laneStride = findCoprimeStep(itemCount, 3)
  const slots = Array.from(
    { length: columns * options.lanes },
    (_, slotIndex): ProjectedSurfaceSlot => {
      const column = Math.floor(slotIndex / options.lanes)
      const logicalColumn = column - centerColumn
      const lane = slotIndex % options.lanes
      const staggerDirection = lane % 2 === 0 ? -1 : 1
      const laneOffset = lane === Math.floor(options.lanes / 2) ? 0 : stagger
      // Continue the modular sequence past a colliding seam instead of
      // mirroring its first item into the final slot.
      const modularColumn =
        itemCount > 2 &&
        column === columns - 1 &&
        positiveModulo(column * columnStride, itemCount) === 0
          ? column + 1
          : column

      return {
        column: logicalColumn,
        itemIndex: positiveModulo(
          modularColumn * columnStride + lane * laneStride,
          itemCount
        ),
        lane,
        x: logicalColumn * options.columnGap + staggerDirection * laneOffset,
        y: ((options.lanes - 1) / 2 - lane) * options.rowGap
      }
    }
  )

  return { columns, slots, span } as const
}

export function calculateEdgeProgress(
  x: number,
  viewportWidth: number,
  planarWidthRatio = 0.5
) {
  assertFinite(x, 'x')
  assertPositive(viewportWidth, 'viewportWidth')

  if (
    !Number.isFinite(planarWidthRatio) ||
    planarWidthRatio < 0 ||
    planarWidthRatio >= 1
  ) {
    throw new RangeError('planarWidthRatio must be at least zero and below one')
  }

  const viewportHalf = viewportWidth / 2
  const planarHalf = (viewportWidth * planarWidthRatio) / 2
  const linearProgress = Math.min(
    1,
    Math.max(0, (Math.abs(x) - planarHalf) / (viewportHalf - planarHalf))
  )

  return linearProgress * linearProgress * (3 - 2 * linearProgress)
}

export function calculateVelocityDeformation(
  x: number,
  viewportWidth: number,
  velocity: number,
  maximumVelocity: number,
  planarWidthRatio = 0.34
) {
  assertFinite(velocity, 'velocity')
  assertPositive(maximumVelocity, 'maximumVelocity')
  const edge = calculateEdgeProgress(x, viewportWidth, planarWidthRatio)
  const velocityProgress = Math.min(1, Math.abs(velocity) / maximumVelocity)
  const gatedVelocity = Math.max(0, (velocityProgress - 0.04) / 0.96)
  const speed = smoothstep(gatedVelocity)
  const amount = edge * speed
  const side = x === 0 ? 0 : Math.sign(x)
  const signedAmount = amount === 0 ? 0 : side * amount

  return {
    amount,
    edge,
    shear: amount,
    speed,
    verticalOffset: signedAmount,
    yaw: 0
  } as const
}

export function projectWheelToHorizontal(deltaX: number, deltaY: number) {
  assertFinite(deltaX, 'deltaX')
  assertFinite(deltaY, 'deltaY')

  return Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX
}

export function classifyWheelAxis(
  deltaX: number,
  deltaY: number,
  horizontalDominance = 1.1
): 'horizontal' | 'vertical' {
  assertFinite(deltaX, 'deltaX')
  assertFinite(deltaY, 'deltaY')

  if (!Number.isFinite(horizontalDominance) || horizontalDominance < 1) {
    throw new RangeError('horizontalDominance must be at least one')
  }

  return Math.abs(deltaX) > Math.abs(deltaY) * horizontalDominance
    ? 'horizontal'
    : 'vertical'
}

export function shouldCaptureGalleryWheel(
  deltaX: number,
  deltaY: number,
  finePointer: boolean
) {
  return !finePointer || classifyWheelAxis(deltaX, deltaY) === 'vertical'
}

export function calculateInertialLaunchVelocity(
  travelDistance: number,
  damping: number
) {
  assertFinite(travelDistance, 'travelDistance')
  assertPositive(damping, 'damping')

  return travelDistance * damping
}

export function damp(
  current: number,
  target: number,
  damping: number,
  deltaSeconds: number
) {
  assertFinite(current, 'current')
  assertFinite(target, 'target')
  assertNonNegative(damping, 'damping')
  assertNonNegative(deltaSeconds, 'deltaSeconds')

  if (damping === 0 || deltaSeconds === 0) return current

  return target + (current - target) * Math.exp(-damping * deltaSeconds)
}

export function decayInertia(
  motion: FieldMotion,
  deltaSeconds: number,
  damping: number
): FieldMotion {
  assertNonNegative(deltaSeconds, 'deltaSeconds')
  assertNonNegative(damping, 'damping')

  for (const [name, value] of [
    ['offset.x', motion.offset.x],
    ['offset.y', motion.offset.y],
    ['velocity.x', motion.velocity.x],
    ['velocity.y', motion.velocity.y]
  ] as const) {
    assertFinite(value, name)
  }

  if (deltaSeconds === 0) return motion

  if (damping === 0) {
    return {
      offset: {
        x: motion.offset.x + motion.velocity.x * deltaSeconds,
        y: motion.offset.y + motion.velocity.y * deltaSeconds
      },
      velocity: motion.velocity
    }
  }

  const decay = Math.exp(-damping * deltaSeconds)
  const travel = (1 - decay) / damping

  return {
    offset: {
      x: motion.offset.x + motion.velocity.x * travel,
      y: motion.offset.y + motion.velocity.y * travel
    },
    velocity: {
      x: motion.velocity.x * decay,
      y: motion.velocity.y * decay
    }
  }
}

export function classifyGesture(
  start: Point2D,
  end: Point2D,
  dragThreshold = 8
): 'click' | 'drag' {
  assertNonNegative(dragThreshold, 'dragThreshold')
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  assertFinite(distance, 'gesture distance')

  return distance > dragThreshold ? 'drag' : 'click'
}

function assertPositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`)
  }
}

function assertNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`)
  }
}

function assertFinite(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`)
  }
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function findCoprimeStep(divisor: number, preferredStep: number) {
  if (divisor === 1) return 1

  for (let offset = 0; offset < divisor; offset += 1) {
    const candidate = ((preferredStep + offset - 1) % divisor) + 1
    if (greatestCommonDivisor(candidate, divisor) === 1) return candidate
  }

  return 1
}

function greatestCommonDivisor(left: number, right: number) {
  let dividend = Math.abs(left)
  let divisor = Math.abs(right)

  while (divisor !== 0) {
    const remainder = dividend % divisor
    dividend = divisor
    divisor = remainder
  }

  return dividend
}
