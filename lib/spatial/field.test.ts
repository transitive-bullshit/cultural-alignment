import { describe, expect, it } from 'vitest'

import {
  calculateInertialLaunchVelocity,
  calculateVelocityDeformation,
  classifyGesture,
  createProjectedSurfaceLayout,
  damp,
  decayInertia,
  projectWheelToHorizontal,
  shouldCaptureGalleryWheel,
  wrapCentered
} from './field'

describe('spatial field invariants', () => {
  it('wraps travel around a centered span', () => {
    expect(wrapCentered(7, 10)).toBe(-3)
    expect(wrapCentered(-7, 10)).toBe(3)
    expect(wrapCentered(5, 10)).toBe(-5)
  })

  it.each([
    {
      itemCount: 10,
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
      itemCount: 25,
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
    'builds a complete, bounded, seam-safe projected surface',
    ({ itemCount, options }) => {
      const layout = createProjectedSurfaceLayout(itemCount, options)
      const fullExitDistance =
        options.viewportWidth / 2 + options.itemWidth / 2 + options.overscan

      expect(layout.columns % 2).toBe(1)
      expect(layout.slots).toHaveLength(layout.columns * options.lanes)
      expect(layout.span / 2).toBeGreaterThan(fullExitDistance)

      for (let lane = 0; lane < options.lanes; lane += 1) {
        const laneSlots = layout.slots
          .filter((slot) => slot.lane === lane)
          .toSorted((left, right) => left.column - right.column)

        expect(new Set(laneSlots.map(({ itemIndex }) => itemIndex))).toEqual(
          new Set(Array.from({ length: itemCount }, (_, index) => index))
        )

        for (const [index, slot] of laneSlots.entries()) {
          const next = laneSlots[(index + 1) % laneSlots.length]!
          expect(slot.itemIndex).not.toBe(next.itemIndex)
        }
      }

      for (const slot of layout.slots) {
        const boundaryOffset = layout.span / 2 - slot.x
        const before = wrapCentered(
          slot.x + boundaryOffset - 0.001,
          layout.span
        )
        const after = wrapCentered(slot.x + boundaryOffset + 0.001, layout.span)

        expect(Math.abs(before)).toBeGreaterThan(fullExitDistance)
        expect(Math.abs(after)).toBeGreaterThan(fullExitDistance)
      }
    }
  )

  it('keeps a large projected surface locally unique throughout its wrap', () => {
    const viewportWidth = 11.44
    const itemWidth = 1.4
    const layout = createProjectedSurfaceLayout(330, {
      lanes: 5,
      columnGap: 1.76,
      rowGap: 1.45,
      viewportWidth,
      itemWidth,
      overscan: 0.75,
      stagger: 0.28
    })
    const slotsByItem = Map.groupBy(layout.slots, ({ itemIndex }) => itemIndex)
    const nearbyCopies = [...slotsByItem].flatMap(([itemIndex, slots]) =>
      slots.flatMap((first, firstIndex) =>
        slots.slice(firstIndex + 1).flatMap((second) => {
          const distance = Math.abs(
            wrapCentered(second.x - first.x, layout.span)
          )

          return distance <= viewportWidth + itemWidth
            ? [{ distance, first, itemIndex, second }]
            : []
        })
      )
    )

    expect(nearbyCopies.slice(0, 5)).toEqual([])
  })

  it('keeps deformation planar at rest and symmetric under velocity', () => {
    const center = calculateVelocityDeformation(0, 10, 30, 30)
    const restingEdge = calculateVelocityDeformation(5, 10, 0, 30)
    const left = calculateVelocityDeformation(-5, 10, 30, 30)
    const right = calculateVelocityDeformation(5, 10, 30, 30)

    expect(center.amount).toBe(0)
    expect(restingEdge.amount).toBe(0)
    expect(left.amount).toBeCloseTo(right.amount)
    expect(left.verticalOffset).toBeCloseTo(-right.verticalOffset)
    expect(left.shear).toBeCloseTo(right.shear)
  })

  it('keeps browser-owned horizontal wheel gestures separate from gallery travel', () => {
    expect(projectWheelToHorizontal(2, 20)).toBe(20)
    expect(projectWheelToHorizontal(-18, 3)).toBe(-18)
    expect(shouldCaptureGalleryWheel(24, 4, true)).toBe(false)
    expect(shouldCaptureGalleryWheel(4, 24, true)).toBe(true)
    expect(shouldCaptureGalleryWheel(24, 4, false)).toBe(true)
  })

  it('integrates damping and inertia independently of frame rate', () => {
    const initial = {
      offset: { x: 3, y: -4 },
      velocity: { x: 120, y: -60 }
    }
    const oneStep = decayInertia(initial, 1 / 30, 5)
    const halfStep = decayInertia(initial, 1 / 60, 5)
    const twoSteps = decayInertia(halfStep, 1 / 60, 5)

    expect(damp(damp(0, 100, 7, 1 / 60), 100, 7, 1 / 60)).toBeCloseTo(
      damp(0, 100, 7, 1 / 30),
      12
    )
    expect(twoSteps.offset.x).toBeCloseTo(oneStep.offset.x, 12)
    expect(twoSteps.offset.y).toBeCloseTo(oneStep.offset.y, 12)
    expect(twoSteps.velocity.x).toBeCloseTo(oneStep.velocity.x, 12)
    expect(twoSteps.velocity.y).toBeCloseTo(oneStep.velocity.y, 12)
  })

  it('derives an intro launch from the intended finite travel', () => {
    const travel = -6.336
    const damping = 3.4
    const velocity = calculateInertialLaunchVelocity(travel, damping)
    const settled = decayInertia(
      { offset: { x: 0, y: 0 }, velocity: { x: velocity, y: 0 } },
      10,
      damping
    )

    expect(settled.offset.x).toBeCloseTo(travel, 10)
    expect(settled.velocity.x).toBeCloseTo(0, 10)
  })

  it('keeps the drag threshold itself clickable', () => {
    expect(classifyGesture({ x: 0, y: 0 }, { x: 6, y: 8 }, 10)).toBe('click')
    expect(classifyGesture({ x: 0, y: 0 }, { x: 6.1, y: 8 }, 10)).toBe('drag')
  })
})
