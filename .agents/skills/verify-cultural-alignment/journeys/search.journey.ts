import searchDocuments from '../../../../content/snapshot/search-documents.json' with { type: 'json' }

import { expect, test } from './fixtures'

const destinations = {
  scenario: '[data-scenario-dossier]',
  source: '[data-resource-detail="source"]',
  franchise: '[data-resource-detail="franchise"]',
  'risk-family': '[data-resource-detail="risk-family"]',
  concept: '[data-resource-detail="concept"]'
} as const

const targets = Object.keys(destinations).map((kind) => {
  const document = searchDocuments.find((entry) => entry.kind === kind)
  if (!document) throw new Error(`No ${kind} in the search documents`)
  return document as typeof document & { kind: keyof typeof destinations }
})

test('search loads on demand, explains empty states, and opens every resource type', async ({
  page,
  evidence
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  const trigger = page.getByRole('button', { name: /Search site/ })
  const input = page.getByRole('combobox')

  await page.goto('/about')
  await page.locator('[data-search-ready="true"]').first().waitFor()

  const indexResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/content/search-index.json'
  )
  await trigger.click()
  expect((await indexResponse).status()).toBe(200)
  await expect(input).toBeFocused()
  await expect(page.getByText('Type a title, franchise, source')).toBeVisible()
  await evidence.capture('search opened from the header')

  await input.fill('zzqxv volcano')
  await expect(page.getByText('No matching records.')).toBeVisible()
  await evidence.capture('no matching records')
  await page.keyboard.press('Escape')
  await expect(input).toBeHidden()

  // The not-found page offers search as a recovery action.
  evidence.expectProblems(
    /^(http\.404 |console\.error Failed to load resource: .* 404 .* at )\S+\/no-such-archive-page$/,
    'Deliberate 404 for the not-found entry point'
  )
  await page.goto('/no-such-archive-page')
  await expect(page.locator('[data-not-found]')).toBeVisible()
  await page.locator('[data-search-ready="true"]').first().waitFor()
  await page.locator('[data-not-found-search]').click()
  await expect(input).toBeFocused()
  await evidence.capture('search opened from the not-found page')
  await page.keyboard.press('Escape')
  await expect(input).toBeHidden()
  // Closing returns focus to the opener; reopening before that finishes
  // leaves the new input unfocused.
  await expect(page.locator('[data-not-found-search]')).toBeFocused()

  for (const target of targets) {
    // Phones open search from the header; desktop also has the shortcut.
    if (mobile) await trigger.click()
    else await page.keyboard.press('ControlOrMeta+k')
    await expect(input).toBeFocused()
    await input.fill(target.title)

    const result = page.locator(`[data-search-result-href="${target.href}"]`)
    await expect(result).toBeVisible()
    await evidence.capture(`${target.kind} result for ${target.title}`)

    await result.click()
    await page.waitForURL((url) => url.pathname === target.href)
    await expect(page.locator(destinations[target.kind])).toBeVisible()
    await evidence.capture(`${target.kind} destination`)
  }
})
