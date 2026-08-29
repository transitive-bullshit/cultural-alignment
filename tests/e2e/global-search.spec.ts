import { expect, test } from '@playwright/test'

import searchDocuments from '../../content/snapshot/search-documents.json' with { type: 'json' }
import type { SearchDocument } from '../../lib/content/catalog'
import { searchDocumentGroups } from '../../lib/content/search'

const documents = searchDocuments as readonly SearchDocument[]
const searchTarget = documents.find((document) => document.kind === 'concept')!
const sectionedSearchTarget = documents.find(
  (document) => searchDocumentGroups(documents, document.title).length > 1
)!

test.beforeEach(async ({ page }) => {
  await page.goto(process.env.PLAYWRIGHT_EXISTING_SERVER_URL ?? '/')
  await page.getByRole('button', { name: /Search site/ }).click()
  await expect(page.getByRole('combobox')).toBeFocused()
})

test('typing a new query returns the search results to the top', async ({
  page
}) => {
  const results = page.locator('[data-search-results]')

  await page.getByRole('combobox').fill('a')
  await expect(page.getByRole('option').first()).toBeVisible()
  await expect(results).toBeVisible()
  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect
    .poll(() => results.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)

  await page.getByRole('combobox').fill(searchTarget.title)
  await expect(page.getByRole('option').first()).toBeVisible()
  await expect
    .poll(() => results.evaluate((element) => element.scrollTop))
    .toBe(0)
})

test('the search query can be cleared from the input', async ({ page }) => {
  const input = page.getByRole('combobox')

  await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(
    0
  )
  await input.fill(searchTarget.title)

  const clearButton = page.getByRole('button', { name: 'Clear search' })
  await expect(clearButton).toBeVisible()
  await clearButton.click()

  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(clearButton).toHaveCount(0)
  await expect(page.getByRole('option')).toHaveCount(0)
})

test('result titles use the electric accent on hover', async ({ page }) => {
  await page.getByRole('combobox').fill('a')

  const result = page.getByRole('option').first()
  const title = result.locator('[data-search-result-title]')

  await expect(result).toBeVisible()
  await result.hover()
  await expect(title).toHaveCSS('color', 'rgb(255, 77, 31)')
})

test('result types are separated with the electric accent', async ({
  page
}) => {
  await page.getByRole('combobox').fill(sectionedSearchTarget.title)

  const divider = page.locator('[data-search-result-divider]').first()

  await expect(divider).toBeVisible()
  await expect(divider).toHaveCSS('background-color', 'rgb(255, 77, 31)')
})
