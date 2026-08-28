import { describe, expect, it } from 'vitest'

import {
  calculateVelocityDeformation,
  calculateInertialLaunchVelocity,
  classifyWheelAxis,
  classifyGesture,
  calculateEdgeProgress,
  createHorizontalLaneLayout,
  createProjectedSurfaceLayout,
  createRepeatIndices,
  createToroidalGrid,
  damp,
  decayInertia,
  projectWheelToHorizontal,
  shouldCaptureGalleryWheel,
  toroidalDelta,
  wrapCentered
} from './field'

describe('spatial field math', () => {
  it('wraps positive and negative travel around the centered field', () => {
    expect(wrapCentered(51, 100)).toBe(-49)
    expect(wrapCentered(-51, 100)).toBe(49)
    expect(wrapCentered(50, 100)).toBe(-50)
    expect(toroidalDelta(48, -48, 100)).toBe(4)
  })

  it('creates a deterministic staggered toroidal grid', () => {
    const first = createToroidalGrid(6, {
      columns: 3,
      columnGap: 4,
      rowGap: 3,
      stagger: 1
    })
    const second = createToroidalGrid(6, {
      columns: 3,
      columnGap: 4,
      rowGap: 3,
      stagger: 1
    })

    expect(first).toEqual(second)
    expect(first.span).toEqual({ x: 12, y: 6 })
    expect(first.points).toEqual([
      { x: -4, y: -1.5 },
      { x: 0, y: -1.5 },
      { x: 4, y: -1.5 },
      { x: -3, y: 1.5 },
      { x: 1, y: 1.5 },
      { x: 5, y: 1.5 }
    ])
  })

  it('creates deterministic columns across fixed horizontal lanes', () => {
    const layout = createHorizontalLaneLayout(7, {
      lanes: 3,
      columnGap: 4,
      rowGap: 2
    })

    expect(layout.columns).toBe(3)
    expect(layout.span).toBe(12)
    expect(layout.points).toEqual([
      { x: -4, y: 2 },
      { x: -4, y: 0 },
      { x: -4, y: -2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
      { x: 0, y: -2 },
      { x: 4, y: 2 }
    ])
  })

  it('renders repeats beyond a complete offscreen exit on both sides', () => {
    const repeats = createRepeatIndices({
      span: 12,
      viewportWidth: 10,
      itemWidth: 4,
      overscan: 1
    })

    expect(repeats).toEqual([-2, -1, 0, 1, 2])
    const fullExitDistance = 10 / 2 + 4 / 2 + 1
    const discardedCopyDistance =
      (Math.max(...repeats.map(Math.abs)) - 0.5) * 12
    expect(discardedCopyDistance).toBeGreaterThan(fullExitDistance)
  })

  it('keeps the visible repeated set continuous across normalization', () => {
    const span = 12
    const viewportWidth = 10
    const itemWidth = 4
    const repeats = createRepeatIndices({ span, viewportWidth, itemWidth })
    const visibleLimit = viewportWidth / 2 + itemWidth / 2
    const before = repeats
      .map((repeat) => span / 2 - 0.001 + repeat * span)
      .filter((x) => Math.abs(x) <= visibleLimit)
      .toSorted((left, right) => left - right)
    const after = repeats
      .map((repeat) => -span / 2 + 0.001 + repeat * span)
      .filter((x) => Math.abs(x) <= visibleLimit)
      .toSorted((left, right) => left - right)

    expect(after).toHaveLength(before.length)
    for (const [index, x] of after.entries()) {
      expect(x).toBeCloseTo(before[index]! + 0.002, 10)
    }
  })

  it('keeps the center planar and curls symmetrically toward both edges', () => {
    expect(calculateEdgeProgress(0, 10)).toBe(0)
    expect(calculateEdgeProgress(2.49, 10)).toBe(0)
    expect(calculateEdgeProgress(2.51, 10)).toBeGreaterThan(0)
    expect(calculateEdgeProgress(-3.5, 10)).toBe(calculateEdgeProgress(3.5, 10))
    expect(calculateEdgeProgress(5, 10)).toBe(1)
    expect(calculateEdgeProgress(50, 10)).toBe(1)
  })

  it('gates the fixed surface twist entirely behind absolute velocity', () => {
    const restingLeft = calculateVelocityDeformation(-4.5, 10, 0, 30)
    const restingRight = calculateVelocityDeformation(4.5, 10, 0, 30)

    expect(restingLeft.verticalOffset).toBe(0)
    expect(restingLeft.yaw).toBe(0)
    expect(restingLeft.shear).toBe(0)
    expect(restingRight.verticalOffset).toBe(0)
    expect(restingRight.yaw).toBe(0)
    expect(restingRight.shear).toBe(0)

    const movingLeft = calculateVelocityDeformation(-4.5, 10, -30, 30)
    const movingRight = calculateVelocityDeformation(4.5, 10, -30, 30)

    expect(movingLeft.verticalOffset).toBeLessThan(0)
    expect(movingRight.verticalOffset).toBeGreaterThan(0)
    expect(movingLeft.verticalOffset).toBeCloseTo(
      -movingRight.verticalOffset,
      12
    )
    expect(movingLeft.yaw).toBe(0)
    expect(movingRight.yaw).toBe(0)
    expect(movingLeft.shear).toBeCloseTo(movingRight.shear, 12)
    expect(movingLeft.shear).toBeGreaterThan(0)

    const reversedLeft = calculateVelocityDeformation(-4.5, 10, 30, 30)
    expect(reversedLeft.verticalOffset).toBeCloseTo(
      movingLeft.verticalOffset,
      12
    )
    expect(reversedLeft.shear).toBeCloseTo(movingLeft.shear, 12)
  })

  it('keeps the center level while deformation grows toward the edges', () => {
    const center = calculateVelocityDeformation(0, 10, -30, 30)
    const shoulder = calculateVelocityDeformation(3.5, 10, -30, 30)
    const edge = calculateVelocityDeformation(5, 10, -30, 30)

    expect(center.amount).toBe(0)
    expect(shoulder.amount).toBeGreaterThan(0)
    expect(edge.amount).toBeGreaterThan(shoulder.amount)
    expect(edge.amount).toBeLessThanOrEqual(1)
  })

  it.each([
    {
      name: '390 by 844 compact',
      options: {
        lanes: 3,
        columnGap: 2.8,
        rowGap: 2.35,
        viewportWidth: 390 / (844 / 10.4),
        itemWidth: 2.72,
        overscan: 0.75,
        stagger: 0
      }
    },
    {
      name: '1440 by 900 desktop',
      options: {
        lanes: 5,
        columnGap: 1.76,
        rowGap: 1.45,
        viewportWidth: 11.44,
        itemWidth: 1.4,
        overscan: 0.75,
        stagger: 0.28
      }
    }
  ])(
    'includes every scenario in every lane at $name density',
    ({ options }) => {
      const layout = createProjectedSurfaceLayout(10, options)

      expect(layout.columns).toBe(11)
      expect(new Set(layout.slots.map(({ itemIndex }) => itemIndex))).toEqual(
        new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      )

      for (let lane = 0; lane < options.lanes; lane += 1) {
        const laneItems = new Set(
          layout.slots
            .filter((slot) => slot.lane === lane)
            .map(({ itemIndex }) => itemIndex)
        )
        expect(laneItems.size).toBe(10)
      }
    }
  )

  it('builds a bounded dense surface whose recycling seam is fully offscreen', () => {
    const layout = createProjectedSurfaceLayout(10, {
      lanes: 5,
      columnGap: 3,
      rowGap: 1.4,
      viewportWidth: 16,
      itemWidth: 2.2,
      overscan: 1
    })
    const fullExitDistance = 16 / 2 + 2.2 / 2 + 1

    expect(layout.columns).toBe(11)
    expect(layout.slots).toHaveLength(55)
    expect(layout.span / 2).toBeGreaterThan(fullExitDistance)
    expect(new Set(layout.slots.map(({ lane }) => lane)).size).toBe(5)
    expect(new Set(layout.slots.map(({ itemIndex }) => itemIndex)).size).toBe(
      10
    )
  })

  it('allows one scenario to occupy both sides of the same visible surface', () => {
    const layout = createProjectedSurfaceLayout(10, {
      lanes: 5,
      columnGap: 3,
      rowGap: 1.4,
      viewportWidth: 16,
      itemWidth: 2.2,
      overscan: 1
    })
    const visibleByItem = Map.groupBy(
      layout.slots.filter(({ x }) => Math.abs(x) <= 8),
      ({ itemIndex }) => itemIndex
    )
    const occupiesBothSides = [...visibleByItem.values()].some(
      (slots) => slots.some(({ x }) => x < 0) && slots.some(({ x }) => x > 0)
    )

    expect(occupiesBothSides).toBe(true)
  })

  it('cycles each lane through the full scenario set instead of two-item stripes', () => {
    const layout = createProjectedSurfaceLayout(10, {
      lanes: 5,
      columnGap: 2,
      rowGap: 1.4,
      viewportWidth: 24,
      itemWidth: 1.4,
      overscan: 1
    })

    for (let lane = 0; lane < 5; lane += 1) {
      const laneItems = new Set(
        layout.slots
          .filter((slot) => slot.lane === lane)
          .map(({ itemIndex }) => itemIndex)
      )
      expect(laneItems.size).toBe(10)
    }
  })

  it('never places the same scenario in adjacent columns across a lane wrap', () => {
    const layout = createProjectedSurfaceLayout(10, {
      lanes: 5,
      columnGap: 1.76,
      rowGap: 1.45,
      viewportWidth: 11.44,
      itemWidth: 1.4,
      overscan: 0.75,
      stagger: 0.28
    })
    const adjacentDuplicates = Array.from({ length: 5 }, (_, lane) => {
      const laneSlots = layout.slots
        .filter((slot) => slot.lane === lane)
        .toSorted((left, right) => left.column - right.column)

      return laneSlots.flatMap((slot, index) => {
        const nextSlot = laneSlots[(index + 1) % laneSlots.length]!

        return slot.itemIndex === nextSlot.itemIndex
          ? [
              {
                itemIndex: slot.itemIndex,
                lane,
                leftColumn: slot.column,
                rightColumn: nextSlot.column,
                seam: index === laneSlots.length - 1
              }
            ]
          : []
      })
    }).flat()

    expect(adjacentDuplicates).toEqual([])
  })

  it('protects the production 25-scenario topology across every lane and seam', () => {
    const itemCount = 25
    const lanes = 5
    const viewportWidth = 11.44
    const itemWidth = 1.4
    const overscan = 0.75
    const layout = createProjectedSurfaceLayout(itemCount, {
      lanes,
      columnGap: 1.76,
      rowGap: 1.45,
      viewportWidth,
      itemWidth,
      overscan,
      stagger: 0.28
    })
    const fullExitDistance = viewportWidth / 2 + itemWidth / 2 + overscan
    const epsilon = 0.001

    expect(layout.columns).toBe(25)
    expect(layout.slots).toHaveLength(itemCount * lanes)

    for (let lane = 0; lane < lanes; lane += 1) {
      const laneSlots = layout.slots
        .filter((slot) => slot.lane === lane)
        .toSorted((left, right) => left.column - right.column)

      expect(new Set(laneSlots.map(({ itemIndex }) => itemIndex)).size).toBe(
        itemCount
      )
      for (const [index, slot] of laneSlots.entries()) {
        const nextSlot = laneSlots[(index + 1) % laneSlots.length]!
        expect(slot.itemIndex).not.toBe(nextSlot.itemIndex)
      }
    }

    for (const slot of layout.slots) {
      const boundaryOffset = layout.span / 2 - slot.x
      const before = wrapCentered(
        slot.x + boundaryOffset - epsilon,
        layout.span
      )
      const after = wrapCentered(slot.x + boundaryOffset + epsilon, layout.span)

      expect(Math.abs(before)).toBeGreaterThan(fullExitDistance)
      expect(Math.abs(after)).toBeGreaterThan(fullExitDistance)
    }
  })

  it('recycles every stable slot only after its complete visible exit', () => {
    const layout = createProjectedSurfaceLayout(10, {
      lanes: 5,
      columnGap: 3,
      rowGap: 1.4,
      viewportWidth: 16,
      itemWidth: 2.2,
      overscan: 1
    })
    const fullExitDistance = 16 / 2 + 2.2 / 2 + 1
    const epsilon = 0.001

    for (const slot of layout.slots) {
      const boundaryOffset = layout.span / 2 - slot.x
      const before = wrapCentered(
        slot.x + boundaryOffset - epsilon,
        layout.span
      )
      const after = wrapCentered(slot.x + boundaryOffset + epsilon, layout.span)

      expect(Math.abs(before)).toBeGreaterThan(fullExitDistance)
      expect(Math.abs(after)).toBeGreaterThan(fullExitDistance)
    }
  })

  it('projects vertical wheels and horizontal trackpads onto one axis', () => {
    expect(projectWheelToHorizontal(2, 20)).toBe(20)
    expect(projectWheelToHorizontal(-18, 3)).toBe(-18)
    expect(projectWheelToHorizontal(6, -6)).toBe(-6)
  })

  it('classifies wheel axes with a small diagonal dead zone', () => {
    expect(classifyWheelAxis(24, 4)).toBe('horizontal')
    expect(classifyWheelAxis(-24, 4)).toBe('horizontal')
    expect(classifyWheelAxis(4, -24)).toBe('vertical')
    expect(classifyWheelAxis(11, 10)).toBe('vertical')
  })

  it('passes horizontal fine-pointer swipes through for browser navigation', () => {
    expect(shouldCaptureGalleryWheel(24, 4, true)).toBe(false)
    expect(shouldCaptureGalleryWheel(-24, 4, true)).toBe(false)
    expect(shouldCaptureGalleryWheel(4, 24, true)).toBe(true)
    expect(shouldCaptureGalleryWheel(24, 4, false)).toBe(true)
  })

  it('derives a finite intro launch from its intended inertial travel', () => {
    const columnGap = 1.76
    const travelColumns = 3.6
    const damping = 3.4
    const launchVelocity = calculateInertialLaunchVelocity(
      -columnGap * travelColumns,
      damping
    )
    const restFraction = 0.025
    const restTime = Math.log(1 / restFraction) / damping
    const settled = decayInertia(
      {
        offset: { x: 0, y: 0 },
        velocity: { x: launchVelocity, y: 0 }
      },
      restTime,
      damping
    )

    expect(launchVelocity).toBeCloseTo(-21.5424, 10)
    expect(settled.offset.x / columnGap).toBeCloseTo(
      -travelColumns * (1 - restFraction),
      10
    )
    expect(settled.velocity.x / launchVelocity).toBeCloseTo(restFraction, 10)
  })

  it('uses frame-rate-independent exponential damping', () => {
    const oneFrame = damp(0, 100, 7, 1 / 30)
    const twoFrames = damp(damp(0, 100, 7, 1 / 60), 100, 7, 1 / 60)

    expect(oneFrame).toBeCloseTo(twoFrames, 12)
  })

  it('integrates inertial travel exactly across frame rates', () => {
    const initial = {
      offset: { x: 3, y: -4 },
      velocity: { x: 120, y: -60 }
    }
    const oneStep = decayInertia(initial, 1 / 30, 5)
    const halfStep = decayInertia(initial, 1 / 60, 5)
    const twoSteps = decayInertia(halfStep, 1 / 60, 5)

    expect(twoSteps.offset.x).toBeCloseTo(oneStep.offset.x, 12)
    expect(twoSteps.offset.y).toBeCloseTo(oneStep.offset.y, 12)
    expect(twoSteps.velocity.x).toBeCloseTo(oneStep.velocity.x, 12)
    expect(twoSteps.velocity.y).toBeCloseTo(oneStep.velocity.y, 12)
  })

  it('keeps the threshold itself clickable and rejects a true drag', () => {
    expect(classifyGesture({ x: 0, y: 0 }, { x: 6, y: 8 }, 10)).toBe('click')
    expect(classifyGesture({ x: 0, y: 0 }, { x: 6.1, y: 8 }, 10)).toBe('drag')
  })

  it('rejects invalid spans and timing values', () => {
    expect(() => wrapCentered(1, 0)).toThrow(RangeError)
    expect(() => damp(1, 2, -1, 0.016)).toThrow(RangeError)
    expect(() =>
      createHorizontalLaneLayout(1, {
        lanes: 0,
        columnGap: 4,
        rowGap: 2
      })
    ).toThrow(RangeError)
    expect(() =>
      createRepeatIndices({ span: 12, viewportWidth: 0, itemWidth: 4 })
    ).toThrow(RangeError)
    expect(() => calculateEdgeProgress(0, 10, 1)).toThrow(RangeError)
    expect(() =>
      decayInertia(
        {
          offset: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 }
        },
        -0.1,
        5
      )
    ).toThrow(RangeError)
  })
})
