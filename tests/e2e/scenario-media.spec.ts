import { expect, test } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

import { mockOptimizedImages } from './image-fixtures'

const scenario = scenarios.find(({ video }) => video)

if (!scenario) {
  throw new Error('Expected a scenario with a video')
}

test('the scenario still keeps the native image context menu', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto(`/scenarios/${scenario.slug}`)

  const media = page.locator('[data-scenario-media]')
  const still = media.locator('[data-scenario-still]')

  await expect(media).toHaveAttribute('data-showing-still', 'true')
  await expect(still).toBeVisible()

  await page.evaluate(() => {
    window.addEventListener(
      'contextmenu',
      (event) => {
        const target = event.target

        if (!(target instanceof HTMLElement)) {
          return
        }

        queueMicrotask(() => {
          document.documentElement.dataset.scenarioContextMenuTarget =
            target.dataset.scenarioStill === 'true' ? 'still' : target.tagName
          document.documentElement.dataset.scenarioContextMenuPrevented =
            String(event.defaultPrevented)
        })
      },
      { once: true }
    )
  })

  const box = await still.boundingBox()

  if (!box) {
    throw new Error('Expected the scenario still to have layout bounds')
  }

  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1, {
    button: 'right'
  })

  await expect(page.locator('html')).toHaveAttribute(
    'data-scenario-context-menu-target',
    'still'
  )
  await expect(page.locator('html')).toHaveAttribute(
    'data-scenario-context-menu-prevented',
    'false'
  )
  await expect(media).toHaveAttribute('data-showing-still', 'true')

  await still.click()
  await expect(media).not.toHaveAttribute('data-showing-still')
})
