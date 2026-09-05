import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

const reportPath = new URL(
  '../../docs/skills/ai-safety-meme-creator/archive-ab-comparison.html',
  import.meta.url
)

test('comparison readiness control defaults to ready and can isolate WIP rows', async ({
  page
}) => {
  const report = await readFile(reportPath, 'utf8')
  const listStartMarker = '<main data-comparison-list>'
  const listStart = report.indexOf(listStartMarker)
  const listEnd = report.indexOf('</main>', listStart)
  if (listStart < 0 || listEnd < 0) {
    throw new Error('Archive comparison report is missing its list hook')
  }
  const html = `${report.slice(0, listStart)}<main data-comparison-list>
      ${comparisonRow('ready')}
      ${comparisonRow('wip')}
    </main>${report.slice(listEnd + '</main>'.length)}`

  await page.route('**/__archive-ab-readiness-test', async (route) => {
    await route.fulfill({ body: html, contentType: 'text/html' })
  })
  await page.goto('/__archive-ab-readiness-test')

  const list = page.locator('[data-comparison-list]')
  const rows = list.locator('[data-comparison-row]')
  const readyRows = list.locator(
    '[data-comparison-row][data-pair-status="ready"]'
  )
  const wipRows = list.locator('[data-comparison-row][data-pair-status="wip"]')
  const readiness = page.locator('#status')

  await expect(list).toBeVisible()
  await expect(rows).toHaveCount(2)
  await expect(readyRows).toHaveCount(1)
  await expect(wipRows).toHaveCount(1)
  await expect(readiness).toHaveValue('ready')
  await expect(readyRows).toBeVisible()
  await expect(wipRows).toBeHidden()

  await readiness.selectOption('wip')

  await expect(readyRows).toBeHidden()
  await expect(wipRows).toBeVisible()
})

function comparisonRow(status: 'ready' | 'wip'): string {
  return `<article class="case" data-comparison-row data-cohort="finalized" data-pair-status="${status}" data-copy="false" data-template="false" data-fewer="false" data-more="false" data-notes="false" data-legacy-invalid="false" data-revised-invalid="false" data-failure="false" data-search=""><div class="case-head"></div></article>`
}
