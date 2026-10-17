import concepts from '../../../../content/snapshot/concepts.json' with { type: 'json' }
import scenarios from '../../../../content/snapshot/scenarios.json' with { type: 'json' }

import { expect, readLocalStorage, storageKeys, test } from './fixtures'

const scenario = scenarios.find(
  ({ video, memes, conceptIds, riskFamilyIds }) =>
    video && memes?.length && conceptIds.length && riskFamilyIds.length
)
const stillOnly = scenarios.find(({ video }) => !video)

if (!scenario || !stillOnly) {
  throw new Error(
    'The snapshot needs a scenario with video, memes, and taxonomy, plus one without video'
  )
}

const primaryConcept = concepts.find(({ id }) => id === scenario.conceptIds[0])!

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('dossier opening, spoiler, clip, taxonomy, copy, and memes', async ({
  page,
  evidence
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  await page.goto(`/scenarios/${scenario.slug}`)
  // The header search marks hydration; client-only UI is settled after it.
  await page.locator('[data-search-ready="true"]').first().waitFor()

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    scenario.title
  )
  const primary = page.locator('[data-scenario-primary-concept]')
  await expect(primary).toHaveAttribute(
    'data-scenario-primary-concept',
    primaryConcept.slug
  )
  await expect(primary.locator('a')).toHaveAttribute(
    'href',
    `/concepts/${primaryConcept.slug}`
  )
  await evidence.capture('dossier opening')

  const warning = page.locator('[data-spoiler-warning]')
  if (mobile) {
    // Phone widths and coarse pointers hide the warning with CSS.
    await expect(warning).toBeHidden()
  } else {
    await expect(warning).toHaveAttribute('data-state', 'warning')
    await evidence.capture('spoiler warning')
    await warning.click()
    await expect(warning).toHaveAttribute('data-state', /^(noted|leaving)$/)
    await expect(warning).toHaveCount(0)
    const acknowledgement = await readLocalStorage(page, [
      storageKeys.spoilerWarning
    ])
    expect(acknowledgement[storageKeys.spoilerWarning]).toBe('dismissed')
    await evidence.record('spoiler acknowledgement in storage', acknowledgement)
    await page.reload()
    await page.locator('[data-search-ready="true"]').first().waitFor()
    await expect(warning).toHaveCount(0)
  }

  const media = page.locator('[data-scenario-media]')
  await expect(media).toHaveAttribute('data-showing-still', 'true')
  await media.locator('[data-scenario-still]').click()
  await expect(media).not.toHaveAttribute('data-showing-still')
  await expect(media).toHaveAttribute('data-playing', 'true')
  // data-playing flips on click; the YouTube player proves playback only when
  // it reports a duration and the clip time advances.
  const progress = page.locator('[data-scenario-media-progress]')
  await expect(progress).toBeEnabled({ timeout: 30_000 })
  const startedAt = Number(await progress.inputValue())
  await expect
    .poll(async () => Number(await progress.inputValue()), { timeout: 20_000 })
    .toBeGreaterThan(startedAt)
  await evidence.record('clip progress', {
    startedAt,
    now: Number(await progress.inputValue()),
    label: await progress.getAttribute('aria-valuetext')
  })
  await evidence.capture('clip playing', { target: media })
  await media.hover()
  await page.locator('[data-scenario-media-playback-control]').click()
  await expect(media).not.toHaveAttribute('data-playing')
  await evidence.capture('clip paused', { target: media })

  const conceptItem = page
    .locator('[data-scenario-taxonomy-item^="concept:"]')
    .first()
  if (mobile) await conceptItem.locator('a').focus()
  else await conceptItem.locator('[data-cursor-card-trigger]').hover()
  const card = page.locator('[data-cursor-card-content]')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('role', 'tooltip')
  await evidence.capture('concept description card')
  await page.keyboard.press('Escape')

  const copyLink = page.locator('[data-copy-page-link]')
  await copyLink.click()
  await expect(copyLink).toHaveAttribute('data-state', 'success')
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiedUrl).toBe(page.url())
  await evidence.record('copied page link', { copiedUrl })

  const copyMarkdown = page.locator('[data-copy-scenario-markdown]')
  await copyMarkdown.scrollIntoViewIfNeeded()
  await copyMarkdown.click()
  await expect(copyMarkdown).toHaveAttribute('data-state', 'success')
  const markdown = await page.evaluate(() => navigator.clipboard.readText())
  expect(markdown.startsWith(`# ${scenario.title}`)).toBe(true)
  expect(markdown).toMatch(/!\[[^\]]*\]\(https?:\/\//)
  expect(markdown).toContain('youtube.com')
  await evidence.file('copied markdown', 'md', Buffer.from(markdown))
  await evidence.capture('copy as markdown confirmed', { target: copyMarkdown })

  const memeTrigger = page.locator('[data-scenario-meme-trigger]').first()
  await memeTrigger.scrollIntoViewIfNeeded()
  await memeTrigger.click()
  const lightbox = page.locator('[data-scenario-meme-lightbox]')
  await expect(lightbox).toBeVisible()
  await expect(lightbox.locator('[data-scenario-meme-image]')).toHaveAttribute(
    'data-loaded',
    'true'
  )
  await evidence.capture('meme lightbox')
  await page.keyboard.press('Escape')
  await expect(lightbox).toBeHidden()
})

test('a scenario without video shows the composed still state', async ({
  page,
  evidence
}) => {
  await page.goto(`/scenarios/${stillOnly.slug}`)

  const media = page.locator('[data-scenario-media]')
  await expect(media).toBeVisible()
  await expect(media).not.toHaveAttribute('data-interactive')
  await expect(
    media.locator('[data-scenario-media-still-label]')
  ).toContainText('Scene still')
  await evidence.capture('still-only media plate', { target: media })
})
