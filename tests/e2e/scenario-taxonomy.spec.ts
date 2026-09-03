import { expect, test } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

const scenario = scenarios.find(
  ({ conceptIds, riskFamilyIds }) =>
    conceptIds.length > 0 && riskFamilyIds.length > 0
)!

test('scenario taxonomy links reveal their descriptions', async ({ page }) => {
  await page.goto(`/scenarios/${scenario.slug}`)

  for (const kind of ['risk-family', 'concept'] as const) {
    const item = page
      .locator(`[data-scenario-taxonomy-item^="${kind}:"]`)
      .first()
    const trigger = item.locator('[data-cursor-card-trigger]')
    const link = item.locator('a')

    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute(
      'href',
      kind === 'risk-family' ? /^\/risk-families\// : /^\/concepts\//
    )

    await trigger.hover()

    const card = page.locator('[data-cursor-card-content]')

    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('role', 'tooltip')
    await expect(card).toContainText(/\S/)
    const cardId = await card.getAttribute('id')

    expect(cardId).toBeTruthy()
    await expect(link).toHaveAttribute('aria-describedby', cardId!)

    await page.mouse.move(0, 0)
    await expect(card).toBeHidden()

    await link.focus()
    await expect(card).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(card).toBeHidden()
  }

  const conceptLink = page
    .locator('[data-scenario-taxonomy-item^="concept:"] a')
    .first()
  const conceptHref = await conceptLink.getAttribute('href')

  if (!conceptHref) throw new Error('Expected a concept detail link')

  const navigation = page.waitForURL((url) => url.pathname === conceptHref, {
    waitUntil: 'commit'
  })

  await conceptLink.click()
  await navigation
  await expect(page.locator('[data-resource-detail="concept"]')).toBeVisible()
})
