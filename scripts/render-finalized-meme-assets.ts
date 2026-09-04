import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import { chromium, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'

import { loadMemeReviewCatalog } from '../lib/meme-review/catalog'
import { resolveFinalizedMemeRenderTargets } from '../lib/meme-review/finalized-renders'
import {
  getMemeReviewStatePath,
  readMemeReviewState
} from '../lib/meme-review/store'
import { parseNamedArgument, writeJsonAtomic } from './meme-review-round-utils'

const renderCssWidth = 480
// Renderer V1 is intentionally frozen and uses desktop viewport units because
// that is the context in which its previews were reviewed and finalized.
const captureViewportWidth = 1440
const captureViewportHeight = 700
const captureOverlayCss = `
  nextjs-portal {
    display: none !important;
  }
`
const requestedWidth = Number(parseNamedArgument('width') ?? '1440')
if (
  !Number.isInteger(requestedWidth) ||
  requestedWidth < 1200 ||
  requestedWidth > 1600
) {
  throw new Error('--width must be an integer from 1200 through 1600')
}

const baseUrl = parseNamedArgument('url') ?? 'http://127.0.0.1:3100'
const catalog = await loadMemeReviewCatalog()
const state = await readMemeReviewState(
  getMemeReviewStatePath(catalog.feedbackPath),
  catalog.activeBatch
)
const targets = resolveFinalizedMemeRenderTargets({
  sources: catalog.sources,
  historyByIdeaId: catalog.historyByIdeaId,
  feedback: state.feedback,
  activeRevisionKey: catalog.activeRevisionKey,
  activeRevisionLabel: catalog.activeRevisionLabel
})
const roundName = `round-${String(catalog.activeBatch).padStart(2, '0')}`
const outputRoot = resolve(
  parseNamedArgument('output') ??
    join('/private/tmp', 'cultural-alignment-finalized-memes', roundName)
)

await mkdir(outputRoot, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: captureViewportWidth, height: captureViewportHeight },
  deviceScaleFactor: requestedWidth / renderCssWidth
})

try {
  const exportUrl = new URL('/admin/meme-review/export', baseUrl).toString()
  const response = await page.goto(exportUrl, { waitUntil: 'domcontentloaded' })
  if (!response?.ok()) {
    throw new Error(
      `Finalized meme export surface returned ${response?.status() ?? 'no response'} at ${exportUrl}`
    )
  }

  // Fixed development UI is painted over locator screenshots when it crosses
  // the target's viewport rectangle. Keep capture-only browser chrome out of
  // exported assets without disabling Next's indicator for normal development.
  await page.addStyleTag({ content: captureOverlayCss })

  const surface = page.locator('[data-finalized-meme-export-surface]')
  await surface.waitFor({ state: 'attached' })
  await page.evaluate(() => document.fonts.ready)

  const renderedCount = Number(
    await surface.getAttribute('data-finalized-meme-count')
  )
  if (renderedCount !== targets.length) {
    throw new Error(
      `Export surface rendered ${renderedCount} finalized memes, expected ${targets.length}`
    )
  }

  const manifestItems = []

  for (const [index, target] of targets.entries()) {
    const item = page.locator(`[data-finalized-meme-export="${target.ideaId}"]`)
    if ((await item.count()) !== 1) {
      throw new Error(`Expected one export surface for ${target.ideaId}`)
    }

    await assertRenderedTargetMatches(item, target)
    await item.scrollIntoViewIfNeeded()
    await item.waitFor({ state: 'visible' })
    await waitForImages(item)
    await assertCaptureOverlaysHidden(page)

    const preview = item.locator('[data-preview-renderer]')
    if ((await preview.getAttribute('data-preview-error')) !== null) {
      throw new Error(`Preview renderer reported an error for ${target.ideaId}`)
    }

    const screenshot = await preview.screenshot({
      type: 'png',
      animations: 'disabled',
      scale: 'device',
      style: captureOverlayCss
    })
    const relativePath = join(
      target.scenarioSlug,
      `${target.ideaId}--${target.renderedPayloadFingerprint}.jpg`
    )
    const outputPath = join(outputRoot, relativePath)
    await mkdir(join(outputRoot, target.scenarioSlug), { recursive: true })

    const image = await sharp(screenshot)
      .flatten({ background: '#050504' })
      .resize({ width: requestedWidth })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    await writeFile(outputPath, image.data)

    const sha256 = createHash('sha256').update(image.data).digest('hex')
    manifestItems.push({
      scenarioSlug: target.scenarioSlug,
      scenarioTitle: target.scenarioTitle,
      sourceSlug: target.sourceSlug,
      sourceTitle: target.sourceTitle,
      ideaId: target.ideaId,
      revisionKey: target.revisionKey,
      versionId: target.renderedPayloadFingerprint,
      revisionLabel: target.revisionLabel,
      renderer: target.renderer,
      payloadFingerprint: target.payloadFingerprint,
      renderedPayloadFingerprint: target.renderedPayloadFingerprint,
      terminalPeriodsRemoved:
        target.terminalPeriodNormalization.changedLineIndexes.length,
      terminalPeriodNormalization: {
        applied: target.terminalPeriodNormalization.applied,
        changedCaptionLines:
          target.terminalPeriodNormalization.changedLineIndexes.map(
            (lineIndex) => lineIndex + 1
          )
      },
      path: outputPath,
      filename: basename(outputPath),
      mediaType: 'image/jpeg',
      width: image.info.width,
      height: image.info.height,
      sha256,
      bytes: image.info.size
    })

    if ((index + 1) % 10 === 0 || index + 1 === targets.length) {
      console.log(`Rendered ${index + 1}/${targets.length} finalized memes`)
    }
  }

  const manifestPath = join(outputRoot, 'manifest.json')
  await writeJsonAtomic(manifestPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    activeBatch: catalog.activeBatch,
    exportUrl,
    mediaType: 'image/jpeg',
    requestedWidth,
    renderCssWidth,
    captureViewport: {
      width: captureViewportWidth,
      height: captureViewportHeight
    },
    terminalPeriodNormalization: {
      strategy: 'stripTerminalMemePeriod',
      normalizedImages: manifestItems.filter(
        ({ terminalPeriodNormalization }) => terminalPeriodNormalization.applied
      ).length
    },
    files: manifestItems
  })

  console.log(
    `Rendered ${manifestItems.length} finalized JPEGs at ${requestedWidth}px wide\nManifest: ${manifestPath}`
  )
} finally {
  await browser.close()
}

async function assertRenderedTargetMatches(
  item: Locator,
  target: (typeof targets)[number]
) {
  const attributes = {
    scenario: await item.getAttribute('data-scenario-slug'),
    source: await item.getAttribute('data-source-slug'),
    revision: await item.getAttribute('data-revision-key'),
    payload: await item.getAttribute('data-payload-fingerprint'),
    renderedPayload: await item.getAttribute(
      'data-rendered-payload-fingerprint'
    ),
    normalized: await item.getAttribute('data-terminal-periods-normalized')
  }
  const expected = {
    scenario: target.scenarioSlug,
    source: target.sourceSlug,
    revision: target.revisionKey,
    payload: target.payloadFingerprint,
    renderedPayload: target.renderedPayloadFingerprint,
    normalized: target.terminalPeriodNormalization.applied ? 'true' : 'false'
  }

  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    if (attributes[key] !== expected[key]) {
      throw new Error(
        `${target.ideaId} export ${key} mismatch: expected ${expected[key]}, received ${attributes[key]}`
      )
    }
  }
}

async function waitForImages(container: Locator): Promise<void> {
  await container.locator('img').evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (element) => {
        const image = element as HTMLImageElement
        if (image.complete && image.naturalWidth > 0) {
          await image.decode()
          return
        }

        await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener(
            'error',
            () =>
              reject(new Error(`Image failed to load: ${image.currentSrc}`)),
            { once: true }
          )
        })
        await image.decode()
      })
    )
  })
}

async function assertCaptureOverlaysHidden(page: Page): Promise<void> {
  const visibleNextPortals = await page
    .locator('nextjs-portal')
    .evaluateAll(
      (portals) =>
        portals.filter((portal) => getComputedStyle(portal).display !== 'none')
          .length
    )

  if (visibleNextPortals > 0) {
    throw new Error(
      `Refusing to capture with ${visibleNextPortals} visible Next.js development overlay${visibleNextPortals === 1 ? '' : 's'}`
    )
  }
}
