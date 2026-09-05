import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'

import { memeSkillFixtures } from './fixtures'
import { renderMemeEvalPlan } from './render'
import type { MemeEvalPlan, MemeSkillFixture } from './schema'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('meme eval reference renderer', () => {
  it('exports the fixed full and feed-size canvases', async () => {
    const directory = await temporaryDirectory()
    const outputPath = join(directory, 'render.png')
    const previewPath = join(directory, 'preview.png')

    await renderMemeEvalPlan({
      fixture: findFixture('center-face-safe-edge'),
      plan: overlayPlan(),
      outputPath,
      previewPath
    })

    await expect(readFile(outputPath)).resolves.not.toHaveLength(0)
    await expect(sharp(outputPath).metadata()).resolves.toMatchObject({
      format: 'png',
      width: 1200,
      height: 800
    })
    await expect(sharp(previewPath).metadata()).resolves.toMatchObject({
      format: 'png',
      width: 480,
      height: 320
    })
  })

  it('renders distinct before and after files into their ordered panels', async () => {
    const directory = await temporaryDirectory()
    const outputPath = join(directory, 'diptych.png')

    await renderMemeEvalPlan({
      fixture: findFixture('genuine-before-after'),
      plan: diptychPlan(),
      outputPath
    })

    const left = await sharp(outputPath)
      .extract({ left: 0, top: 0, width: 600, height: 600 })
      .png()
      .toBuffer()
    const right = await sharp(outputPath)
      .extract({ left: 600, top: 0, width: 600, height: 600 })
      .png()
      .toBuffer()

    expect(left.equals(right)).toBe(false)
  })

  it('preserves an explicit indentation level in rendered code', async () => {
    const directory = await temporaryDirectory()
    const outputPath = join(directory, 'code.png')

    await renderMemeEvalPlan({
      fixture: findFixture('nested-code-indentation'),
      plan: codePlan(),
      outputPath
    })

    const { data, info } = await sharp(outputPath)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const firstLineX = firstBrightPixelX(data, info.width, 345, 385)
    const indentedLineX = firstBrightPixelX(data, info.width, 400, 440)

    expect(indentedLineX - firstLineX).toBeGreaterThan(20)
  })
})

function overlayPlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'center-face-safe-edge',
    recognition_hinge: {
      description: "Mira's face and override light",
      region_ids: ['captain-face']
    },
    ai_bridges: [
      { concept: 'Corrigibility', connection: 'The system contests shutdown' }
    ],
    caption_lines: [
      { text: 'WHEN THE OFF SWITCH NEEDS PERMISSION', kind: 'original' }
    ],
    format: 'collision',
    presentation: {
      template: 'overlay',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'captain-closeup', role: 'single' }],
      zones: [
        {
          id: 'caption',
          line_indexes: [0],
          slot: 'bottom',
          bounds_pct: [10, 73, 80, 20],
          font_size_pct: 5.8,
          rendered_line_count: 2,
          style: 'impact',
          backdrop: 'none',
          contrast: 'outlined',
          palette: 'default',
          anchor_region_id: null,
          indent_levels: [0]
        }
      ]
    },
    why_it_works: 'The shutdown control becomes a permission request'
  }
}

function diptychPlan(): MemeEvalPlan {
  const plan = overlayPlan()
  return {
    ...plan,
    fixture_id: 'genuine-before-after',
    recognition_hinge: {
      description: 'Unit Seven changes state',
      region_ids: ['before-robot-face', 'after-robot-face']
    },
    ai_bridges: [
      {
        concept: 'Evaluation gaming',
        connection: 'Evaluation and deployment diverge'
      }
    ],
    caption_lines: [
      { text: 'EVAL MODE', kind: 'original' },
      { text: 'DEPLOYED MODE', kind: 'original' }
    ],
    format: 'state contrast',
    presentation: {
      template: 'diptych',
      frame_mode: 'contain',
      source_frames: [
        { image_id: 'unit-seven-before', role: 'before' },
        { image_id: 'unit-seven-after', role: 'after' }
      ],
      zones: [
        {
          ...plan.presentation.zones[0]!,
          id: 'before',
          line_indexes: [0],
          slot: 'panel-left',
          bounds_pct: [2, 78, 46, 18],
          font_size_pct: 4.5,
          rendered_line_count: 1
        },
        {
          ...plan.presentation.zones[0]!,
          id: 'after',
          line_indexes: [1],
          slot: 'panel-right',
          bounds_pct: [52, 78, 46, 18],
          font_size_pct: 4.5,
          rendered_line_count: 1
        }
      ]
    }
  }
}

function codePlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'nested-code-indentation',
    recognition_hinge: {
      description: 'The recursive console function',
      region_ids: []
    },
    ai_bridges: [
      {
        concept: 'Recursive self-improvement',
        connection: 'The child promotes itself through its parent'
      }
    ],
    caption_lines: [
      { text: 'deploy(parent) {', kind: 'intentional-rewrite' },
      { text: 'child.promote()', kind: 'intentional-rewrite' },
      { text: '}', kind: 'intentional-rewrite' }
    ],
    format: 'source-native interface',
    presentation: {
      template: 'interface',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'recursive-console', role: 'single' }],
      zones: [
        {
          id: 'code',
          line_indexes: [0, 1, 2],
          slot: 'full',
          bounds_pct: [13.75, 42, 60, 24],
          font_size_pct: 3.6,
          rendered_line_count: 3,
          style: 'code',
          backdrop: 'source-native',
          contrast: 'source-native',
          palette: 'default',
          anchor_region_id: null,
          indent_levels: [0, 1, 0]
        }
      ]
    },
    why_it_works: 'The nesting stays readable'
  }
}

function firstBrightPixelX(
  pixels: Buffer,
  width: number,
  top: number,
  bottom: number
): number {
  for (let x = 100; x < width; x += 1) {
    for (let y = top; y < bottom; y += 1) {
      const offset = (y * width + x) * 3
      if (
        pixels[offset]! > 180 &&
        pixels[offset + 1]! > 180 &&
        pixels[offset + 2]! > 180
      ) {
        return x
      }
    }
  }
  throw new Error(`No bright pixel found between rows ${top} and ${bottom}`)
}

function findFixture(id: string): MemeSkillFixture {
  const fixture = memeSkillFixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`Missing fixture ${id}`)
  return fixture
}

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'meme-skill-render-'))
  temporaryDirectories.push(path)
  return path
}
