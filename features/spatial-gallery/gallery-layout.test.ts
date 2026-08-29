import { expect, test } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'
import { createProjectedSurfaceLayout } from '@/lib/spatial/field'

import { toSpatialGalleryItems } from './gallery-items'

test('the all-scenarios WebGL projection has no adjacent repeated images', () => {
  const items = toSpatialGalleryItems(contentCatalog.listScenarioCards())
  const viewportWidth = 11.44
  const itemWidth = 1.4
  const layout = createProjectedSurfaceLayout(items.length, {
    lanes: 5,
    columnGap: 1.76,
    rowGap: 1.45,
    viewportWidth,
    itemWidth,
    overscan: 0.75,
    stagger: 0.28
  })
  const visibleSlots = layout.slots.filter(
    ({ x }) => Math.abs(x) <= viewportWidth / 2 + itemWidth / 2
  )
  const adjacentRepeats = visibleSlots.flatMap((first, firstIndex) =>
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
          }
        }
      ]
    })
  )

  expect(
    adjacentRepeats.slice(0, 5),
    `found ${adjacentRepeats.length} adjacent projected copies in the initial /scenarios viewport`
  ).toEqual([])
})

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
