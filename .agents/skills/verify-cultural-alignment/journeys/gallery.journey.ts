import scenarios from '../../../../content/snapshot/scenarios.json' with { type: 'json' }
import families from '../../../../content/snapshot/risk-families.json' with { type: 'json' }

import type { Page } from '@playwright/test'

import {
  expect,
  exploreFromGalleryIntro,
  openFromHeader,
  readLocalStorage,
  storageKeys,
  test
} from './fixtures'

const scenarioPath = /^\/scenarios\/[^/]+$/

test('homepage gallery selects a frame and round-trips through its dossier', async ({
  page,
  evidence
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  await page.goto('/')

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const canvas = gallery.locator('canvas')
  await expect(page.locator('[data-gallery-intro-dialog]')).toBeVisible()
  await evidence.capture('intro dialog on first visit')

  await exploreFromGalleryIntro(page)
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute(
    'data-gallery-inertia-burst',
    /^(settled|skipped)$/,
    { timeout: 30_000 }
  )
  await evidence.record(
    'intro acknowledgement in storage',
    await readLocalStorage(page, [storageKeys.galleryIntro])
  )

  const point = await selectFrame(page, mobile)
  const selectedId = await gallery.getAttribute('data-selected-scenario-id')
  const selected = scenarios.find(({ id }) => id === selectedId)!
  expect(selected, `selected id ${selectedId} is in the snapshot`).toBeTruthy()

  const card = mobile
    ? page.locator('[data-mobile-selected-scenario]')
    : page.locator('[data-words-context-card]')
  await expect(card).toContainText(selected.title)
  await evidence.capture(mobile ? 'first tap selects' : 'hover selects')

  // A second press on the selected frame opens it. Touch selection recentres
  // the frame horizontally, so wait for that before tapping again.
  const navigation = page.waitForURL(
    (url) => url.pathname === `/scenarios/${selected.slug}`,
    { timeout: 15_000 }
  )
  if (mobile) {
    await page.waitForTimeout(800)
    await page.touchscreen.tap(point.x, point.y)
  } else {
    await page.mouse.click(point.x, point.y)
  }
  await navigation

  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    selected.title
  )
  await evidence.capture('selected scenario dossier')

  // The homepage shows its introduction again on every later entry.
  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-gallery-intro-dialog]')).toBeVisible()
  await evidence.capture('back shows the introduction again')
  await exploreFromGalleryIntro(page)
  await expect(gallery).toHaveAttribute(
    'data-selected-scenario-id',
    selected.id
  )
  await expect(card).toContainText(selected.title)
  await evidence.capture('back restores the selection')
})

test('archive shows every scenario and links each risk family', async ({
  page,
  evidence
}, testInfo) => {
  await page.goto('/about')
  await openFromHeader(page, '/scenarios', testInfo.project.name === 'mobile')

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  await expect(page.locator('[data-gallery-intro-dialog]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-gallery-intro]')).toHaveAttribute(
    'data-state',
    'dismissed'
  )

  await expect(
    page.getByRole('heading', { level: 1, name: 'All scenarios' })
  ).toBeVisible()
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-count',
    String(scenarios.length)
  )
  const chips = page.locator(
    '[data-scenario-family-filters] a[href^="/risk-families/"]'
  )
  await expect(chips).toHaveCount(families.length)
  await evidence.capture('archive toolbar and gallery')

  const href = (await chips.first().getAttribute('href'))!
  await chips.first().click()
  await page.waitForURL((url) => url.pathname === href)
  await expect(
    page.locator('[data-resource-detail="risk-family"]')
  ).toBeVisible()
  await evidence.capture('risk family from archive chip')
})

test('keyboard focus reveals the index and opens a scenario', async ({
  page,
  evidence
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Keyboard access is a desktop path'
  )
  await page.goto('/scenarios')
  // Escape before the dialog opens would be lost, and the late dialog would
  // then trap the Tab presses.
  const intro = page.locator('[data-gallery-intro]')
  await expect(intro).toHaveAttribute('data-state', 'visible')
  await page.keyboard.press('Escape')
  await expect(intro).toHaveAttribute('data-state', 'dismissed')
  await expect(page.locator('[data-spatial-gallery] canvas')).toBeVisible()

  // The canvas is not focusable; its text index is the keyboard path.
  const index = page.locator('[data-scenario-index]')
  const inIndex = () =>
    page.evaluate(
      () => !!document.activeElement?.closest('[data-scenario-index]')
    )
  for (let presses = 0; presses < 80 && !(await inIndex()); presses += 1) {
    await page.keyboard.press('Tab')
  }
  expect(await inIndex(), 'Tab reaches the scenario index').toBe(true)
  await expect
    .poll(() => index.evaluate((element) => element.clientWidth))
    .toBeGreaterThan(200)
  await evidence.capture('index revealed by keyboard focus')

  const href = await page.evaluate(() =>
    document.activeElement?.getAttribute('href')
  )
  expect(href).toMatch(scenarioPath)
  await page.keyboard.press('Enter')
  await page.waitForURL((url) => url.pathname === href)
  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()
  await evidence.capture('dossier opened from the keyboard')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('each gallery is a server-rendered scenario index', async ({
    page,
    evidence
  }) => {
    for (const route of ['/', '/scenarios']) {
      await page.goto(route)
      const gallery = page.locator('[data-spatial-gallery="browse"]')
      const links = page.locator('[data-scenario-index] a[href^="/scenarios/"]')
      const count = Number(
        await gallery.getAttribute('data-gallery-item-count')
      )

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(links).toHaveCount(count)
      for (const href of await links.evaluateAll((anchors) =>
        anchors.slice(0, 5).map((anchor) => anchor.getAttribute('href'))
      )) {
        expect(href).toMatch(scenarioPath)
      }
      await evidence.capture(
        `index without javascript at ${route === '/' ? 'home' : route}`
      )
    }
  })
})

/** Hovers (or taps) down the canvas centre line until a frame is selected. */
async function selectFrame(page: Page, mobile: boolean) {
  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const box = (await gallery.locator('canvas').boundingBox())!

  for (const fraction of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
    const point = { x: box.x + box.width / 2, y: box.y + box.height * fraction }
    if (mobile) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.move(point.x, point.y)

    const selected = await expect(gallery)
      .toHaveAttribute('data-selected-scenario-id', /\S/, { timeout: 1_500 })
      .then(() => true)
      .catch(() => false)
    if (selected) return point
  }
  throw new Error('No gallery frame under the canvas centre line')
}
