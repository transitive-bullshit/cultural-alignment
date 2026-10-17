import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { test as base, expect, type Locator, type Page } from '@playwright/test'

/**
 * Evidence for one journey test, written to
 * `<drive evidence>/<project>/<test title>/`: numbered screenshots and ARIA
 * snapshots per capture, JSON records, and `steps.json` with the outcome,
 * console errors, failed requests, and HTTP errors seen during the test.
 * Problems a journey causes on purpose are listed apart as `expectedProblems`.
 */
export type Evidence = {
  readonly dir: string
  /** Screenshot plus ARIA snapshot of the page, or of `target` when given. */
  capture(
    label: string,
    options?: { target?: Locator; fullPage?: boolean }
  ): Promise<void>
  /** Saves data observed through the app, such as clipboard text or headers. */
  record(label: string, data: unknown): Promise<void>
  /** Saves a binary artifact the app produced, such as a social image. */
  file(label: string, extension: string, body: Buffer): Promise<void>
  /**
   * Declares problems the journey causes on purpose, such as a deliberate
   * 404. The pattern is matched against `<kind> <text>`, where text names the
   * failing URL; other problems on the same page stay findings.
   */
  expectProblems(pattern: RegExp, reason: string): void
}

type Step = { step: number; label: string; url: string; files: string[] }
type Problem = { kind: string; text: string; url: string; reason?: string }

export const test = base.extend<{ evidence: Evidence }>({
  evidence: async ({ page }, use, testInfo) => {
    const root = process.env.VERIFY_EVIDENCE_DIR
    if (!root) throw new Error('Run journeys through verify.ts drive')

    const dir = join(root, testInfo.project.name, slug(testInfo.title))
    await mkdir(dir, { recursive: true })

    const steps: Step[] = []
    const problems: Problem[] = []
    const expected: { pattern: RegExp; reason: string }[] = []
    let counter = 0
    const next = (label: string) =>
      `${String(++counter).padStart(2, '0')}-${slug(label)}`

    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        // The location names the failing resource for "Failed to load" errors.
        const { url } = message.location()
        problems.push({
          kind: `console.${message.type()}`,
          text: url ? `${message.text()} at ${url}` : message.text(),
          url: page.url()
        })
      }
    })
    page.on('pageerror', (error) =>
      problems.push({ kind: 'pageerror', text: error.message, url: page.url() })
    )
    page.on('requestfailed', (request) =>
      problems.push({
        kind: 'requestfailed',
        text: `${request.failure()?.errorText ?? 'failed'} ${request.url()}`,
        url: page.url()
      })
    )
    page.on('response', (response) => {
      if (response.status() >= 400) {
        problems.push({
          kind: `http.${response.status()}`,
          text: response.url(),
          url: page.url()
        })
      }
    })

    await use({
      dir,
      async capture(label, { target, fullPage = false } = {}) {
        const name = next(label)
        const screenshot = `${name}.png`
        const aria = `${name}.aria.yml`
        if (target) await target.screenshot({ path: join(dir, screenshot) })
        else await page.screenshot({ path: join(dir, screenshot), fullPage })
        await writeFile(
          join(dir, aria),
          await (target ?? page.locator('body')).ariaSnapshot()
        )
        steps.push({
          step: counter,
          label,
          url: page.url(),
          files: [screenshot, aria]
        })
      },
      async record(label, data) {
        const name = `${next(label)}.json`
        await writeFile(join(dir, name), `${JSON.stringify(data, null, 2)}\n`)
        steps.push({ step: counter, label, url: page.url(), files: [name] })
      },
      async file(label, extension, body) {
        const name = `${next(label)}.${extension}`
        await writeFile(join(dir, name), body)
        steps.push({ step: counter, label, url: page.url(), files: [name] })
      },
      expectProblems(pattern, reason) {
        expected.push({ pattern, reason })
      }
    })

    const classified = problems.map((problem) => ({
      ...problem,
      reason: expected.find(({ pattern }) =>
        pattern.test(`${problem.kind} ${problem.text}`)
      )?.reason
    }))

    await writeFile(
      join(dir, 'steps.json'),
      `${JSON.stringify(
        {
          title: testInfo.titlePath.slice(1).join(' › '),
          project: testInfo.project.name,
          status: testInfo.status,
          error: testInfo.error?.message,
          baseURL: testInfo.project.use.baseURL,
          steps,
          problems: classified.filter(({ reason }) => !reason),
          expectedProblems: classified.filter(({ reason }) => reason)
        },
        null,
        2
      )}\n`
    )
  }
})

export { expect }

/** Dismisses the gallery introduction with Explore, as a first-time visitor does. */
export async function exploreFromGalleryIntro(page: Page) {
  const intro = page.locator('[data-gallery-intro]')
  await expect(intro).toHaveAttribute('data-state', 'visible')
  await page.locator('[data-gallery-intro-dismiss]').click()
  await expect(intro).toHaveAttribute('data-state', 'dismissed')
}

/**
 * Opens a primary destination from the site header: the desktop navigation,
 * or the Menu sheet at phone widths.
 */
export async function openFromHeader(
  page: Page,
  href: string,
  mobile: boolean
) {
  const navigation = page.waitForURL((url) => url.pathname === href)
  if (mobile) {
    await page.locator('[data-site-navigation-toggle]').click()
    await page
      .locator(
        `[data-site-navigation="mobile"] [data-site-navigation-link="${href}"]`
      )
      .click()
  } else {
    await page
      .locator(
        `[data-site-navigation="desktop"] [data-site-navigation-link="${href}"]`
      )
      .click()
  }
  await navigation
}

export async function readLocalStorage(page: Page, keys: readonly string[]) {
  return page.evaluate(
    (storageKeys) =>
      Object.fromEntries(
        storageKeys.map((key) => [key, window.localStorage.getItem(key)])
      ),
    keys
  )
}

export const storageKeys = {
  galleryIntro: 'cultural-alignment:gallery-intro:v1',
  spoilerWarning: 'cultural-alignment:spoiler-warning:v2',
  sourceSort: 'cultural-alignment:media-source-collection-sort:v1',
  scenarioSort: 'cultural-alignment:scenario-collection-sort:v1'
} as const

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
