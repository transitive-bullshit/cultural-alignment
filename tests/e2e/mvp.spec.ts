import { expect, test } from '@playwright/test'

test('featured gallery opens a scenario and browser Back restores its field state', async ({
  page
}) => {
  await page.goto('/')

  const gallery = page.getByRole('region', {
    name: /featured cultural scenarios/i
  })
  const selectedTitle = page.getByRole('heading', { level: 1 })

  await expect(gallery).toBeVisible()
  await expect(page.getByRole('link', { name: 'Gallery' })).toBeVisible()
  await expect(selectedTitle).toBeVisible()
  await expect(gallery.locator('canvas')).toBeVisible({ timeout: 15_000 })

  // Let the explanatory entrance coast settle before testing user-owned state.
  await page.waitForTimeout(1_400)
  const beforeWheel = await selectedTitle.textContent()
  const bounds = await gallery.boundingBox()

  expect(bounds).not.toBeNull()
  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2
  )
  await page.mouse.wheel(0, 1_200)

  await expect
    .poll(() => selectedTitle.textContent(), { timeout: 5_000 })
    .not.toBe(beforeWheel)
  await page.waitForTimeout(1_200)

  const selectedBeforeNavigation = await selectedTitle.textContent()
  await page.getByRole('link', { name: /open this scenario/i }).click()
  await expect(page).toHaveURL(/\/scenarios\/[a-z0-9-]+$/)

  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(selectedTitle).toHaveText(selectedBeforeNavigation ?? '')
})

test('all-scenarios controls reflect the family filter in the URL', async ({
  page
}) => {
  await page.goto('/scenarios')

  await page.getByRole('radio', { name: 'Misalignment', exact: true }).click()
  await expect(page).toHaveURL(/\/scenarios\?family=misalignment$/)
  await expect(page.getByRole('radio', { name: /newest|oldest/i })).toHaveCount(
    0
  )
  await expect(page.getByText(/scenarios$/).first()).toBeVisible()
})

test('scenario, source, family, and concept URLs resolve as relational pivots', async ({
  page
}) => {
  await page.goto('/scenarios/lacie-games-her-rating')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Lacie Games Her Rating' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'More from Black Mirror' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Related scenarios' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /View all \d+ scenarios/i })
  ).toHaveAttribute('href', '/sources/black-mirror')
  await expect(page.locator('footer')).toBeVisible()

  const source = page.getByRole('link', { name: 'Black Mirror', exact: true })
  await expect(source).toHaveAttribute('href', '/sources/black-mirror')
  await source.click()
  await expect(page).toHaveURL('/sources/black-mirror')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Black Mirror'
  )

  await page.goto('/risk-families/misalignment')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Misalignment' })
  ).toBeVisible()

  await page.goto('/concepts/goodharts-law')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'goodhart'
  )
})

test('Command-K search groups the local index and navigates to a working result', async ({
  page
}) => {
  await page.goto('/')

  const searchTrigger = page.getByRole('button', {
    name: /Search site \(Command K or Control K\)/i
  })
  await expect(searchTrigger).toHaveAttribute('data-search-ready', 'true')
  await page.keyboard.press('ControlOrMeta+k')

  const searchInput = page.getByPlaceholder('Search the cultural archive…')
  await expect(searchInput).toBeVisible()
  await searchInput.fill('goodhart')

  const result = page.getByText('goodhart’s law', { exact: true })
  await expect(result).toBeVisible()
  await expect(result.locator('mark')).toHaveText(/goodhart/i)
  await result.click()
  await expect(page).toHaveURL('/concepts/goodharts-law')
})

test('shared footer stays out of galleries and exposes project pages elsewhere', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.locator('footer')).toBeHidden()

  await page.goto('/scenarios')
  await expect(page.locator('footer')).toBeHidden()

  await page.goto('/about')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Start with a story you already know.'
    })
  ).toBeVisible()

  const footer = page.locator('footer')
  await expect(footer).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
    'href',
    '/privacy'
  )
  await expect(
    footer.getByRole('link', { name: /Public source database/i })
  ).toHaveAttribute('href', /notion\.so/)
  await expect(
    footer.getByRole('link', { name: /X \/ @transitive_bs/i })
  ).toHaveAttribute('href', 'https://x.com/transitive_bs')
})

test('Command-K search opens from a production scenario detail page', async ({
  page
}) => {
  await page.goto('/scenarios/lacie-games-her-rating')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Lacie Games Her Rating' })
  ).toBeVisible()

  const searchTrigger = page.getByRole('button', {
    name: /Search site \(Command K or Control K\)/i
  })
  await expect(searchTrigger).toHaveAttribute('data-search-ready', 'true')
  await page.keyboard.press('ControlOrMeta+k')

  const searchInput = page.getByPlaceholder('Search the cultural archive…')
  await expect(searchInput).toBeVisible()
  await expect(searchInput).toBeFocused()
})

test('spoiler dismissal persists across navigation and reload', async ({
  page
}) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.removeItem('cultural-alignment:spoiler-warning:v2')
  })
  await page.reload()

  const spoiler = page.getByRole('button', { name: 'Dismiss spoiler warning' })
  await expect(spoiler).toBeVisible()
  await spoiler.click()
  await expect(spoiler).toBeHidden()

  await page.reload()
  await expect(spoiler).toBeHidden()
})

test('direct missing-video and malformed scenario URLs behave intentionally', async ({
  page
}) => {
  await page.goto('/scenarios/k-2so-is-reprogrammed')
  const longTitle = page.getByRole('heading', {
    level: 1,
    name: 'K-2SO is Reprogrammed'
  })
  await expect(longTitle).toBeVisible()
  expect(
    await longTitle.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)

  await page.goto('/scenarios/pied-pipers-self-sabotage')
  await expect(page.getByText('No clip in the collection')).toBeVisible()

  const response = await page.goto('/scenarios/not-a-real-scenario')
  expect(response?.status()).toBe(404)
})

test.describe('functional phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('gallery and Dossier remain readable without horizontal overflow', async ({
    page
  }) => {
    await page.goto('/scenarios?family=misalignment')
    const activeFamily = page.getByRole('radio', {
      name: 'Misalignment',
      exact: true
    })
    await expect(activeFamily).toBeVisible()
    expect(
      await activeFamily.evaluate((element) => {
        const group = element.closest('[role="radiogroup"]')
        if (!group) return false

        const itemBounds = element.getBoundingClientRect()
        const groupBounds = group.getBoundingClientRect()

        return (
          itemBounds.left >= groupBounds.left &&
          itemBounds.right <= groupBounds.right
        )
      })
    ).toBe(true)

    await page.goto('/')
    await expect(
      page.getByRole('region', { name: /featured cultural scenarios/i })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    ).toBe(true)

    await page.goto('/scenarios/lacie-games-her-rating')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    ).toBe(true)
  })
})
