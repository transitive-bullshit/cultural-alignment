import { expect, test } from '@playwright/test'

test('homepage prototype picker exercises every direction and gallery handoff', async ({
  page
}) => {
  await page.goto('/prototypes/homepage?v=1')

  const picker = page.getByRole('navigation', { name: 'Prototype variants' })
  await expect(picker).toBeVisible()
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.locator('main header')).toHaveCount(0)
  await expect(
    page.locator('[data-prototype-variant="signal-loader"]')
  ).toBeVisible()

  await page.keyboard.press('2')
  await expect(page).toHaveURL(/\/prototypes\/homepage\?v=2$/)
  const splitLens = page.locator('[data-prototype-variant="split-lens"]')
  await expect(splitLens).toBeVisible()

  const splitExamples = splitLens.locator('[data-split-lens-example]')
  const firstSelection = await splitLens.getAttribute(
    'data-split-lens-selected'
  )
  await splitExamples.nth(1).click()
  await expect(splitLens).not.toHaveAttribute(
    'data-split-lens-selected',
    firstSelection ?? ''
  )
  await splitLens.locator('[data-split-lens-gallery]').click()
  await expect(page.locator('[data-spatial-gallery="browse"]')).toBeVisible()

  await page.keyboard.press('3')
  const coldOpen = page.locator('[data-prototype-variant="cold-open"]')
  await expect(coldOpen).toBeVisible()
  const finalPhase = coldOpen.locator('[data-cold-open-phase="3"]')
  await finalPhase.click()
  await expect(finalPhase).toHaveAttribute('aria-current', 'step')
  await coldOpen.locator('[data-cold-open-gallery]').click()
  await expect(page.locator('[data-spatial-gallery="browse"]')).toBeVisible()

  await page.keyboard.press('4')
  const guide = page.locator('[data-field-guide]')
  await expect(guide).toHaveAttribute('data-state', 'open')
  await page.locator('[data-field-guide-dismiss]').click()
  await expect(guide).toHaveAttribute('data-state', 'dismissed')
  await expect(page.locator('[data-gallery-main]')).toBeFocused()
  await page.keyboard.press('r')
  await expect(page.locator('[data-field-guide]')).toHaveAttribute(
    'data-state',
    'open'
  )

  await picker.locator('[data-prototype-index="1"]').click()
  const enterArchive = page.locator('[data-signal-loader-enter]')
  await expect(enterArchive).toBeVisible()
  await expect(
    page.locator('[data-gallery-transition-ready="true"]')
  ).toBeVisible()
  await page.waitForTimeout(2800)
  await expect(enterArchive).toBeVisible()
  await enterArchive.click()
  await expect(enterArchive).toHaveCount(0)
  await expect(page.locator('[data-gallery-main]')).toBeFocused()
  await expect(page.locator('[data-spatial-gallery="browse"]')).toBeVisible()
})
