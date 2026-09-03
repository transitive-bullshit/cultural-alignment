import { expect, test } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'

test('meme review queue captures a reaction and autosaves notes', async ({
  page
}) => {
  await mockOptimizedImages(page)

  const savedBatches: unknown[] = []
  await page.route('**/api/meme-feedback', async (route) => {
    savedBatches.push(route.request().postDataJSON())
    await route.fulfill({
      contentType: 'application/json',
      json: {
        ideaIds: [],
        updatedAt: new Date().toISOString()
      }
    })
  })

  await page.goto('/admin/meme-review')

  await expect(page).toHaveURL('/admin/meme-review')
  await expect(page.locator('[data-meme-review]')).toBeVisible()
  await expect(page.locator('[data-meme-source]').first()).toBeVisible()
  await expect(page.locator('[data-meme-scenario]').first()).toBeVisible()

  const idea = page.locator('[data-meme-idea]').first()
  const ideaId = await idea.getAttribute('data-meme-idea')
  if (!ideaId) throw new Error('Expected a stable meme idea id')

  const like = idea.locator('[data-feedback-rating] [data-rating="like"]')
  if ((await like.getAttribute('data-state')) === 'on') {
    await idea.locator('[data-feedback-rating] [data-rating="neutral"]').click()
  }
  await like.click()
  await idea.locator('[data-feedback-notes]').fill('e2e taste signal')

  await expect(idea).toHaveAttribute('data-user-rating', 'like')
  await expect
    .poll(() => savedBatches.some((batch) => batchIncludesIdea(batch, ideaId)))
    .toBe(true)
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible()

  await page.locator('[data-review-filter="like"]').click()
  await expect(idea).toBeVisible()
})

function batchIncludesIdea(batch: unknown, ideaId: string) {
  if (!batch || typeof batch !== 'object' || !('updates' in batch)) return false
  const updates = (batch as { readonly updates?: unknown }).updates
  if (!Array.isArray(updates)) return false

  return updates.some(
    (update) =>
      update &&
      typeof update === 'object' &&
      'ideaId' in update &&
      update.ideaId === ideaId
  )
}
