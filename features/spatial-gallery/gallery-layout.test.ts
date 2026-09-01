import { expect, test } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'
import { createProjectedSurfaceLayout } from '@/lib/spatial/field'

import { toSpatialGalleryItems } from './gallery-items'
import {
  GALLERY_ITEM_SIZE_DEFAULT,
  GALLERY_ITEM_SIZE_MAX,
  GALLERY_ITEM_SIZE_MIN,
  getGalleryGeometry,
  getGalleryLaneCount,
  getGalleryLayoutViewportWidth,
  getGalleryTargetZoom
} from './gallery-sizing'
import {
  getGalleryLaneTargetXOffset,
  isGalleryLaneActive
} from './gallery-lane-motion'

test.each([
  GALLERY_ITEM_SIZE_MIN,
  GALLERY_ITEM_SIZE_DEFAULT,
  GALLERY_ITEM_SIZE_MAX
])(
  'the all-scenarios WebGL projection has no adjacent repeated images at %s%%',
  (itemSize) => {
    const items = toSpatialGalleryItems(contentCatalog.listScenarioCards())
    const width = 1_440
    const height = 782
    const geometry = getGalleryGeometry(false)
    const viewportWidth =
      width / getGalleryTargetZoom(false, width, height, itemSize)
    const layout = createGalleryLayout(items.length)
    const visibleLanes = getGalleryLaneCount(false, width, height, itemSize)
    const adjacentRepeats = Array.from(
      { length: geometry.maximumLanes - visibleLanes + 1 },
      (_, windowStart) => windowStart
    ).flatMap((windowStart) => {
      const visibleSlots = layout.slots
        .filter(({ lane }) =>
          isGalleryLaneActive(lane, windowStart, visibleLanes)
        )
        .map((slot) => ({
          ...slot,
          x:
            slot.x +
            getGalleryLaneTargetXOffset(
              slot.lane,
              windowStart,
              visibleLanes,
              geometry.stagger
            )
        }))
        .filter(
          ({ x }) => Math.abs(x) <= viewportWidth / 2 + geometry.frameWidth / 2
        )

      return visibleSlots.flatMap((first, firstIndex) =>
        visibleSlots.slice(firstIndex + 1).flatMap((second) => {
          const firstItem = items[first.itemIndex]!
          const secondItem = items[second.itemIndex]!

          if (
            firstItem.image.src !== secondItem.image.src ||
            Math.abs(first.lane - second.lane) !== 1 ||
            Math.abs(first.column - second.column) !== 1
          ) {
            return []
          }

          return [
            {
              first: {
                column: first.column,
                href: firstItem.href,
                lane: first.lane
              },
              second: {
                column: second.column,
                href: secondItem.href,
                lane: second.lane
              },
              windowStart
            }
          ]
        })
      )
    })

    expect(
      adjacentRepeats.slice(0, 5),
      `found ${adjacentRepeats.length} adjacent projected copies in the initial /scenarios viewport`
    ).toEqual([])
  }
)

test.each([
  { label: 'desktop', mobile: false },
  { label: 'mobile', mobile: true }
])(
  'the $label fixed-capacity field can retain any scenario in every supported lane window',
  ({ mobile }) => {
    const itemCount = contentCatalog.listScenarioCards().length
    const layout = createGalleryLayout(itemCount, mobile)
    const geometry = getGalleryGeometry(mobile)

    for (const itemIndex of [0, 37, Math.floor(itemCount / 2), itemCount - 1]) {
      for (
        let visibleLanes = geometry.minimumLanes;
        visibleLanes <= geometry.maximumLanes;
        visibleLanes += 1
      ) {
        for (
          let windowStart = 0;
          windowStart <= geometry.maximumLanes - visibleLanes;
          windowStart += 1
        ) {
          expect(
            layout.slots.some(
              ({ itemIndex: slotItemIndex, lane }) =>
                slotItemIndex === itemIndex &&
                isGalleryLaneActive(lane, windowStart, visibleLanes)
            )
          ).toBe(true)
        }
      }
    }
  }
)

test('the WebGL projection carries each scenario blur placeholder', () => {
  const scenarios = contentCatalog.listScenarioCards()
  const items = toSpatialGalleryItems(scenarios)

  expect(
    items.every(
      (item, index) =>
        item.image.blurDataURL === scenarios[index]?.image.blurDataURL
    )
  ).toBe(true)
})

function createGalleryLayout(itemCount: number, mobile = false) {
  const width = mobile ? 390 : 1_440
  const height = mobile ? 740 : 782
  const geometry = getGalleryGeometry(mobile)

  return createProjectedSurfaceLayout(itemCount, {
    assignmentLanes: geometry.defaultLanes,
    lanes: geometry.maximumLanes,
    columnGap: geometry.columnGap,
    rowGap: geometry.rowGap,
    viewportWidth: getGalleryLayoutViewportWidth(mobile, width, height),
    itemWidth: geometry.frameWidth,
    overscan: geometry.overscan,
    stagger: 0
  })
}
