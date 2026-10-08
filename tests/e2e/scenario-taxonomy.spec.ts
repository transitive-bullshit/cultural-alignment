import { expect, test } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

const scenario = scenarios.find(
  ({ conceptIds, riskFamilyIds }) =>
    conceptIds.length > 0 && riskFamilyIds.length > 0
)!

test('the dossier opening names the primary concept', async ({ page }) => {
  await page.goto(`/scenarios/${scenario.slug}`)

  const firstConcept = await page
    .locator('[data-scenario-taxonomy-item^="concept:"]')
    .first()
    .getAttribute('data-scenario-taxonomy-item')
  const slug = firstConcept?.replace(/^concept:/, '')
  const primary = page.locator('[data-scenario-primary-concept]')

  await expect(primary).toHaveAttribute('data-scenario-primary-concept', slug!)
  await expect(primary.locator('a')).toHaveAttribute(
    'href',
    `/concepts/${slug}`
  )
})

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
  await expect(
    page.locator('[data-scenario-card-summary]').first()
  ).not.toBeEmpty()
})

test('taxonomy heading links keep their full touch target beside Help', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: 'reduce'
  })
  try {
    const page = await context.newPage()
    for (const href of ['/risk-families', '/concepts']) {
      await page.goto(`/scenarios/${scenario.slug}`)
      const link = page.locator(
        `[aria-label="Scenario taxonomy"] h2 a[href="${href}"]`
      )
      await link.scrollIntoViewIfNeeded()
      const box = await link.boundingBox()
      if (!box) throw new Error('Expected a taxonomy heading link')
      const point = { x: box.x + box.width - 1, y: box.y + box.height / 2 }
      const hitHref = await page.evaluate(({ x, y }) => {
        return document
          .elementFromPoint(x, y)
          ?.closest('a')
          ?.getAttribute('href')
      }, point)
      expect(hitHref).toBe(href)
      await page.touchscreen.tap(point.x, point.y)
      await expect(page).toHaveURL(new RegExp(`${href}$`))
    }
  } finally {
    await context.close()
  }
})
