import { expect, test } from '@playwright/test'

import searchDocuments from '../../content/snapshot/search-documents.json' with { type: 'json' }
import type { SearchDocument } from '../../lib/content/catalog'

const documents = searchDocuments as readonly SearchDocument[]
const searchTarget = documents.find((document) => document.kind === 'concept')!

test('global search shortcut navigates to a concept detail', async ({
  page
}) => {
  await page.goto('/about')

  await page.locator('[data-search-ready="true"]').waitFor()

  const searchIndexResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/content/search-index.json',
    { timeout: 15_000 }
  )

  await page.keyboard.press('ControlOrMeta+k')

  const input = page.getByRole('combobox')
  expect((await searchIndexResponse).ok()).toBe(true)
  await input.fill(searchTarget.title)

  const result = page.locator(
    `[data-search-result-href="${searchTarget.href}"]`
  )

  const navigation = page.waitForURL(
    (url) => url.pathname === searchTarget.href,
    { timeout: 15_000, waitUntil: 'commit' }
  )

  await result.click()
  await navigation
  await expect(page.locator('[data-resource-detail="concept"]')).toBeVisible()
})
