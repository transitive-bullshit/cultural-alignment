import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import sharp from 'sharp'

import { memeReviewAssetCollectionSchema } from '../lib/meme-review/schema'
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
if (!requestedPart || !/^(?:part-)?\d{2}$/.test(requestedPart)) {
  throw new Error('Choose one asset part, for example --part=01')
}

const partName = requestedPart.startsWith('part-')
  ? requestedPart
  : `part-${requestedPart}`
const sourcePath = join(
  memeReviewRoundsPath,
  roundName,
  'asset-parts',
  `${partName}.json`
)
const outputPath =
  parseNamedArgument('output') ??
  join('/private/tmp', 'cultural-alignment-meme-review', roundName, partName)
const assetsPath = join(outputPath, 'assets')
const contactSheetPath = join(outputPath, `${partName}-contact-sheet.jpg`)
const assets = memeReviewAssetCollectionSchema.parse(await readJson(sourcePath))

await mkdir(assetsPath, { recursive: true })

const downloaded = await Promise.all(
  assets.map(async (asset, index) => {
    const response = await fetch(asset.src)
    if (!response.ok) {
      throw new Error(
        `Failed to download ${asset.id}: ${response.status} ${response.statusText}`
      )
    }

    const contents = Buffer.from(await response.arrayBuffer())
    const actualHash = createHash('sha256').update(contents).digest('hex')
    if (actualHash !== asset.content_hash) {
      throw new Error(
        `Content hash mismatch for ${asset.id}: expected ${asset.content_hash}, received ${actualHash}`
      )
    }

    const extension = extname(new URL(asset.src).pathname) || '.img'
    const assetPath = join(assetsPath, `${asset.id}${extension}`)
    await writeBinaryExclusiveOrVerify(assetPath, contents, actualHash)

    return {
      index,
      asset,
      assetPath,
      contents
    }
  })
)

const cellWidth = 440
const cellHeight = 300
const labelHeight = 52
const columns = 3
const rows = Math.ceil(downloaded.length / columns)
const tiles = await Promise.all(
  downloaded.map(async ({ asset, contents, index }) => {
    const image = await sharp(contents)
      .resize({
        width: cellWidth,
        height: cellHeight - labelHeight,
        fit: 'contain',
        background: '#080808'
      })
      .png()
      .toBuffer()
    const label = `${String(index + 1).padStart(2, '0')}  ${asset.scenario_slug}`

    return sharp({
      create: {
        width: cellWidth,
        height: cellHeight,
        channels: 3,
        background: '#080808'
      }
    })
      .composite([
        { input: image, top: labelHeight, left: 0 },
        { input: labelSvg(label, cellWidth, labelHeight), top: 0, left: 0 }
      ])
      .png()
      .toBuffer()
  })
)

await sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 3,
    background: '#080808'
  }
})
  .composite(
    tiles.map((input, index) => ({
      input,
      left: (index % columns) * cellWidth,
      top: Math.floor(index / columns) * cellHeight
    }))
  )
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(contactSheetPath)

await writeJsonAtomic(join(outputPath, 'manifest.json'), {
  version: 1,
  round: roundNumber,
  part: partName,
  contact_sheet: contactSheetPath,
  assets: downloaded.map(({ asset, assetPath }) => ({
    id: asset.id,
    scenario_slug: asset.scenario_slug,
    url: asset.src,
    content_hash: asset.content_hash,
    downloaded_path: assetPath
  }))
})

console.log(
  `Downloaded and verified ${assets.length} curated frames; contact sheet: ${contactSheetPath}`
)

function labelSvg(label: string, width: number, height: number): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#161616"/>
      <text x="16" y="33" fill="#f4f4f5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" font-weight="600">${escapeXml(label)}</text>
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

async function writeBinaryExclusiveOrVerify(
  path: string,
  contents: Buffer,
  expectedHash: string
): Promise<void> {
  try {
    await writeFile(path, contents, { flag: 'wx' })
  } catch (err) {
    if (!isAlreadyExistsError(err)) throw err
    const existing = await readFile(path)
    const existingHash = createHash('sha256').update(existing).digest('hex')
    if (existingHash !== expectedHash) {
      throw new Error(
        `Refusing to replace mismatched downloaded asset: ${path}`
      )
    }
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  )
}
