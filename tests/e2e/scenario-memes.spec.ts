import { expect, test } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

const syncedScenarioWithMemes = scenarios.find(
  (scenario) =>
    scenario.memes.length > 0 &&
    scenarios.some(
      (candidate) =>
        candidate.id !== scenario.id && candidate.sourceId === scenario.sourceId
    )
)

test('synchronized meme media is usable on a scenario dossier', async ({
  page
}) => {
  test.skip(
    !syncedScenarioWithMemes,
    'The current snapshot has no meme-bearing scenario with discovery content'
  )
  const scenario = syncedScenarioWithMemes!

  await page.goto(`/scenarios/${scenario.slug}`)

  const section = page.locator('[data-scenario-memes]')
  const triggers = section.locator('[data-scenario-meme-trigger]')
  const firstTrigger = triggers.first()
  const firstImage = firstTrigger.locator('img')

  await expect(section).toBeVisible()
  await expect(firstTrigger).toBeVisible()
  expect(
    await page
      .locator('[data-scenario-memes], [data-scenario-discovery]')
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.hasAttribute('data-scenario-memes') ? 'memes' : 'discovery'
        )
      )
  ).toEqual(['memes', 'discovery'])
  await expect
    .poll(() =>
      firstImage.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0
      )
    )
    .toBe(true)

  await firstTrigger.click()

  const lightbox = page.locator('[data-scenario-meme-lightbox]')
  await expect(lightbox).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(lightbox).toBeHidden()
  await expect(firstTrigger).toBeFocused()
})
