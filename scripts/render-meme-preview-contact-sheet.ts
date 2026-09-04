import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'

import {
  memeIdeaCollectionV2Schema,
  type ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'
import {
  memeReviewRoundsPath,
  parseNamedArgument,
  readJson,
  writeJsonAtomic
} from './meme-review-round-utils'

const roundName = parseNamedArgument('round')
if (!roundName || !/^round-\d{2,}$/.test(roundName)) {
  throw new Error('Choose an explicit batch, for example --round=round-03')
}
const roundNumber = Number(roundName.slice('round-'.length))
const requestedPart = parseNamedArgument('part')
if (!requestedPart || !/^(?:(?:part-)?\d{2}|all)$/.test(requestedPart)) {
  throw new Error('Choose one preview part or all, for example --part=01')
}

const partsPath = join(memeReviewRoundsPath, roundName, 'parts')
const partNames =
  requestedPart === 'all'
    ? (await readdir(partsPath))
        .filter((name) => /^part-\d{2}\.json$/.test(name))
        .map((name) => name.slice(0, -'.json'.length))
        .toSorted()
    : [
        requestedPart.startsWith('part-')
          ? requestedPart
          : `part-${requestedPart}`
      ]
const outputRoot =
  parseNamedArgument('output') ??
  join('/private/tmp', 'cultural-alignment-meme-review', roundName, 'previews')
const baseUrl =
  parseNamedArgument('url') ?? 'http://127.0.0.1:3100/admin/meme-review'
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1800, height: 1200 },
  deviceScaleFactor: 1
})

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-meme-review]').waitFor()
  const allReadinessFilter = page.locator('[data-readiness-filter="all"]')
  if ((await allReadinessFilter.getAttribute('data-state')) !== 'on') {
    await allReadinessFilter.click()
  }

  for (const partName of partNames) {
    const scenarios = memeIdeaCollectionV2Schema.parse(
      await readJson(join(partsPath, `${partName}.json`))
    )
    const outputPath =
      partNames.length === 1 && parseNamedArgument('output')
        ? outputRoot
        : join(outputRoot, partName)

    await renderPart({ page, partName, scenarios, outputPath, baseUrl })
  }
} finally {
  await browser.close()
}

async function renderPart({
  page,
  partName,
  scenarios,
  outputPath,
  baseUrl
}: {
  readonly page: Page
  readonly partName: string
  readonly scenarios: readonly ScenarioMemeIdeasV2[]
  readonly outputPath: string
  readonly baseUrl: string
}) {
  await mkdir(outputPath, { recursive: true })
  const renderedScenarios = []
  const previewWidth = 480
  const previewHeight = 300
  const previewLabelHeight = 36
  const previewCellHeight = previewHeight + previewLabelHeight
  const scenarioLabelHeight = 40
  const columns = 3
  const scenarioWidth = columns * previewWidth

  for (const scenario of scenarios) {
    const previewBuffers = []

    for (const idea of scenario.ideas) {
      const preview = page
        .locator(`[data-meme-idea="${idea.id}"]`)
        .locator('[data-preview-renderer]')
        .first()
      await preview.scrollIntoViewIfNeeded()
      await preview.waitFor({ state: 'visible' })
      await waitForImages(preview)

      const screenshot = await preview.screenshot({
        type: 'png',
        animations: 'disabled'
      })
      const resized = await sharp(screenshot)
        .resize({ width: previewWidth, height: previewHeight, fit: 'fill' })
        .png()
        .toBuffer()
      const renderer = await preview.getAttribute('data-preview-renderer')
      const label =
        renderer === '2'
          ? `${idea.id} · ${idea.preview.template} · ${idea.preview.frame_mode}`
          : `${idea.id} · finalized history · renderer ${renderer ?? 'unknown'}`

      previewBuffers.push(
        await sharp({
          create: {
            width: previewWidth,
            height: previewCellHeight,
            channels: 3,
            background: '#080808'
          }
        })
          .composite([
            { input: resized, top: 0, left: 0 },
            {
              input: labelSvg(label, previewWidth, previewLabelHeight),
              top: previewHeight,
              left: 0
            }
          ])
          .png()
          .toBuffer()
      )
    }

    const previewRows = Math.ceil(previewBuffers.length / columns)
    const scenarioHeight = scenarioLabelHeight + previewRows * previewCellHeight
    const scenarioSheet = await sharp({
      create: {
        width: scenarioWidth,
        height: scenarioHeight,
        channels: 3,
        background: '#080808'
      }
    })
      .composite([
        {
          input: labelSvg(
            `${scenario.scenario_slug} · ${previewBuffers.length} idea${previewBuffers.length === 1 ? '' : 's'}`,
            scenarioWidth,
            scenarioLabelHeight
          ),
          top: 0,
          left: 0
        },
        ...previewBuffers.map((input, index) => ({
          input,
          top:
            scenarioLabelHeight +
            Math.floor(index / columns) * previewCellHeight,
          left: (index % columns) * previewWidth
        }))
      ])
      .png()
      .toBuffer()
    const scenarioPath = join(
      outputPath,
      `${scenario.scenario_slug}-previews.png`
    )
    await sharp(scenarioSheet).toFile(scenarioPath)
    renderedScenarios.push({
      scenario_slug: scenario.scenario_slug,
      path: scenarioPath,
      sheet: scenarioSheet,
      height: scenarioHeight,
      ideas: previewBuffers.length
    })
  }

  const contactSheetPath = join(outputPath, `${partName}-contact-sheet.jpg`)
  let contactSheetHeight = 0
  const scenarioOffsets = renderedScenarios.map(({ height }) => {
    const top = contactSheetHeight
    contactSheetHeight += height
    return top
  })
  await sharp({
    create: {
      width: scenarioWidth,
      height: contactSheetHeight,
      channels: 3,
      background: '#080808'
    }
  })
    .composite(
      renderedScenarios.map(({ sheet: input }, index) => ({
        input,
        top: scenarioOffsets[index],
        left: 0
      }))
    )
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toFile(contactSheetPath)

  await writeJsonAtomic(join(outputPath, 'manifest.json'), {
    version: 1,
    round: roundNumber,
    part: partName,
    url: baseUrl,
    contact_sheet: contactSheetPath,
    scenarios: renderedScenarios.map(({ scenario_slug, path, ideas }) => ({
      scenario_slug,
      preview_sheet: path,
      ideas
    }))
  })

  console.log(
    `Rendered ${scenarios.length} scenario preview rows; contact sheet: ${contactSheetPath}`
  )
}

async function waitForImages(preview: Locator): Promise<void> {
  await preview.locator('img').evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (element) => {
        const image = element as HTMLImageElement
        if (image.complete && image.naturalWidth > 0) return
        await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener(
            'error',
            () =>
              reject(new Error(`Image failed to load: ${image.currentSrc}`)),
            { once: true }
          )
        })
      })
    )
  })
}

function labelSvg(label: string, width: number, height: number): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#161616"/>
      <text x="12" y="${Math.round(height * 0.67)}" fill="#f4f4f5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="600">${escapeXml(label)}</text>
    </svg>
  `)
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
      })[character] ?? character
  )
}
