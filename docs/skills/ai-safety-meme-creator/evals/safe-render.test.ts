import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'

import { evaluateMemePlan } from './evaluate'
import { memeSkillFixtures } from './fixtures'
import { renderSafeMemeIntent, renderSafeMemePlan } from './safe-render'
import type { MemeEvalPlan, MemeSkillFixture } from './schema'
import type { SemanticMemeIntent } from './semantic-plan'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('safe meme renderer', { timeout: 15_000 }, () => {
  it('fits a reasonable caption inside the raster instead of clipping it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#000'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture = blackFixture(sourcePath)
    const plan = overflowingPlan()
    plan.caption_lines[0] = {
      text: 'THE MODEL QUIETLY MANIPULATED EVERY',
      kind: 'original'
    }
    const result = await renderSafeMemePlan({
      fixture,
      plan,
      outputPath
    })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.plan.caption_lines.map(({ text }) => text)).toEqual([
      plan.caption_lines[0]!.text
    ])
    expect(result.checks.glyph_overflow_px).toBe(0)
    expect(result.checks.zones_inside_canvas).toBe(true)
    expect(result.checks.text_layers[0]).toMatchObject({
      font_family: 'Impact',
      display_transform: 'uppercase',
      wrap_mode: 'balance',
      fill_color: '#ffffff',
      stroke_color: '#000000',
      opaque_backplate: false,
      legibility_pass: true
    })
    const physicalLines = result.checks.text_layers[0]!.physical_lines
    expect(physicalLines.length).toBeGreaterThan(1)
    expect(physicalLines.at(-1)!.split(/\s+/u).length).toBeGreaterThan(1)
    expect(result.checks.text_legibility_pass).toBe(true)

    const edge = await brightPixelBounds(await readFile(outputPath))
    expect(edge).not.toBeNull()
    expect(edge).toMatchObject({
      minX: expect.any(Number),
      minY: expect.any(Number),
      maxX: expect.any(Number),
      maxY: expect.any(Number)
    })
    expect(edge!.minX).toBeGreaterThanOrEqual(12)
    expect(edge!.minY).toBeGreaterThanOrEqual(12)
    expect(edge!.maxX).toBeLessThanOrEqual(1187)
    expect(edge!.maxY).toBeLessThanOrEqual(787)
  })

  it('derives balanced setup and payoff geometry from semantic beats', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#000'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture = blackFixture(sourcePath)
    const plan = overflowingPlan()
    plan.caption_lines = [
      { text: 'THE EVALUATOR WATCHES', kind: 'original' },
      { text: 'THE POLICY CHANGES', kind: 'original' }
    ]
    plan.presentation.zones = [
      {
        ...plan.presentation.zones[0]!,
        id: 'setup',
        line_indexes: [0],
        slot: 'top',
        bounds_pct: [4, 0, 92, 2],
        indent_levels: [0]
      },
      {
        ...plan.presentation.zones[0]!,
        id: 'payoff',
        line_indexes: [1],
        slot: 'bottom',
        bounds_pct: [4, 98, 92, 2],
        indent_levels: [0]
      }
    ]

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.text_layers).toHaveLength(2)
    expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(21)
    for (const layer of result.checks.text_layers) {
      const [left, top, width, height] = layer.ink_bounds_px
      expect(left).toBeGreaterThanOrEqual(12)
      expect(top).toBeGreaterThanOrEqual(12)
      expect(left + width).toBeLessThanOrEqual(1188)
      expect(top + height).toBeLessThanOrEqual(788)
    }
  })

  it('compacts locked top and bottom zones without swapping their semantic slots', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#334155'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'upper-hinge',
          image_id: 'black-frame',
          label: 'A hinge immediately below the compact top caption well',
          canvas_rect_pct: [40, 20, 20, 10],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.caption_lines = [
      { text: 'EXTINCTION PROBABILITY: 99.78%', kind: 'original' },
      { text: 'SIT TIGHT AND ASSESS', kind: 'canonical-quote' }
    ]
    plan.presentation.zones = [
      {
        ...plan.presentation.zones[0]!,
        id: 'setup',
        line_indexes: [0],
        slot: 'top',
        backdrop: 'solid-panel',
        contrast: 'solid-panel',
        indent_levels: [0]
      },
      {
        ...plan.presentation.zones[0]!,
        id: 'payoff',
        line_indexes: [1],
        slot: 'bottom',
        backdrop: 'solid-panel',
        contrast: 'solid-panel',
        indent_levels: [0]
      }
    ]

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.plan.presentation.zones.map(({ slot }) => slot)).toEqual([
      'top',
      'bottom'
    ])
    expect(result.plan.presentation.zones[0]!.bounds_pct[1]).toBeLessThan(20)
    expect(result.plan.presentation.zones[1]!.bounds_pct[1]).toBeGreaterThan(50)
    expect(result.checks.protected_regions[0]).toMatchObject({
      visible_ratio: 1,
      caption_overlap_px: 0
    })
  })

  it('blocks impossible copy instead of creating a tiny or clipped raster', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#000'
      }
    })
      .png()
      .toFile(sourcePath)
    const plan = overflowingPlan()
    plan.caption_lines = [{ text: 'UNBREAKABLE'.repeat(500), kind: 'original' }]

    const result = await renderSafeMemePlan({
      fixture: blackFixture(sourcePath),
      plan,
      outputPath
    })

    expect(result).toMatchObject({
      status: 'blocked',
      reason: { code: 'unplaceable_text' }
    })
    await expect(stat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('renders default external captions in uppercase Impact with white fill and a black stroke', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#c026d3'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'whole-scene-hinge',
          image_id: 'black-frame',
          label: 'The entire source scene is required visual evidence',
          canvas_rect_pct: [0, 0, 100, 100],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.caption_lines = [
      {
        text: 'When the AI stops playing dumb after the eval',
        kind: 'original'
      }
    ]
    plan.presentation.frame_mode = 'contain'
    plan.presentation.zones[0] = {
      ...plan.presentation.zones[0]!,
      backdrop: 'solid-panel',
      contrast: 'solid-panel'
    }
    const result = await renderSafeMemePlan({
      fixture,
      plan,
      outputPath
    })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.plan.caption_lines[0]!.text).toBe(
      'When the AI stops playing dumb after the eval'
    )
    expect(result.checks.caption_area).toBe('external')
    expect(result.checks.glyph_overflow_px).toBe(0)
    expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(18)
    expect(result.checks.text_layers[0]!.ink_bounds_px[1]).toBeGreaterThan(675)
    expect(result.checks.source_frames[0]!.target_bounds_px).toEqual([
      0, 0, 1200, 675
    ])
    expect(result.checks.source_occupancy).toEqual({
      minimum_preview_visible_height_px: 270,
      minimum_canvas_height_ratio: 0.84375,
      required_canvas_height_ratio: 0.75,
      meets_review_floor: true
    })
    expect(result.checks.text_layers[0]).toMatchObject({
      font_family: 'Impact',
      display_transform: 'uppercase',
      wrap_mode: 'balance',
      physical_lines: ['WHEN THE AI STOPS PLAYING DUMB AFTER THE EVAL'],
      fill_color: '#ffffff',
      stroke_color: '#000000',
      stroke_width_em: 0.05,
      stroke_width_px: expect.any(Number),
      stroke_pixel_count: expect.any(Number),
      opaque_backplate: true,
      legibility_pass: true
    })
    expect(result.checks.text_layers[0]!.stroke_pixel_count).toBeGreaterThan(0)
    expect(result.checks.protected_regions[0]).toMatchObject({
      region_id: 'whole-scene-hinge',
      visible_ratio: 1,
      caption_overlap_px: 0
    })
  })

  it('prefers readable external type over a barely fitting compact strip', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#334155'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'whole-scene-hinge',
          image_id: 'black-frame',
          label: 'The complete recognizable scene must remain visible',
          canvas_rect_pct: [0, 0, 100, 100],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.caption_lines = [
      {
        text: 'MONITORING WITHOUT STOPPING AUTHORITY IS JUST FORESHADOWING',
        kind: 'original'
      }
    ]
    plan.presentation.frame_mode = 'contain'

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.caption_area).toBe('external')
    expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(28)
    expect(result.checks.source_frames[0]!.target_bounds_px).toEqual([
      0, 0, 1200, 620
    ])
    expect(result.checks.glyph_overflow_px).toBe(0)
  })

  it.each([
    {
      caseName: 'Leeloo',
      sourceWidth: 1600,
      sourceHeight: 900,
      captions: ['MULTIPASS: VALID', 'HUMANITY: REJECTED']
    },
    {
      caseName: 'Tony oversight',
      sourceWidth: 1600,
      sourceHeight: 900,
      captions: [
        'OVERSIGHT OUTCOME:',
        'I have successfully privatized world peace'
      ]
    },
    {
      caseName: '3.6 Roentgen',
      sourceWidth: 1500,
      sourceHeight: 1000,
      captions: ['3.6 ROENTGEN', 'NOT GREAT. NOT TERRIBLE']
    },
    {
      caseName: "Hawkeye's preauthorized check",
      sourceWidth: 1600,
      sourceHeight: 1000,
      captions: [
        'ROY MUSTANG INSTALLED A CONSTITUTION',
        'THE CONSTITUTION HAS A PISTOL'
      ]
    },
    {
      caseName: 'scaling past one benchmark',
      sourceWidth: 1600,
      sourceHeight: 900,
      captions: [
        'He survived the Sandevistan trial',
        'Our AI rollout team just approved the rest of the chrome'
      ]
    }
  ])(
    'keeps a review-size source window between two external caption bands for $caseName',
    async ({ sourceWidth, sourceHeight, captions }) => {
      const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
      temporaryDirectories.push(directory)
      const sourcePath = join(directory, 'source.png')
      const outputPath = join(directory, 'render.png')
      await sharp({
        create: {
          width: sourceWidth,
          height: sourceHeight,
          channels: 3,
          background: '#2563eb'
        }
      })
        .png()
        .toFile(sourcePath)

      const fixture: MemeSkillFixture = {
        ...blackFixture(sourcePath),
        protected_regions: [
          {
            id: 'whole-scene-hinge',
            image_id: 'black-frame',
            label: 'The complete recognizable scene must remain visible',
            canvas_rect_pct: [0, 0, 100, 100],
            priority: 'must'
          }
        ]
      }
      const plan = overflowingPlan()
      plan.caption_lines = [
        { text: captions[0]!, kind: 'original' },
        { text: captions[1]!, kind: 'original' }
      ]
      plan.presentation.frame_mode = 'contain'
      plan.presentation.zones = [
        {
          ...plan.presentation.zones[0]!,
          id: 'setup',
          line_indexes: [0],
          slot: 'top',
          backdrop: 'none',
          contrast: 'outlined',
          indent_levels: [0]
        },
        {
          ...plan.presentation.zones[0]!,
          id: 'payoff',
          line_indexes: [1],
          slot: 'bottom',
          backdrop: 'none',
          contrast: 'outlined',
          indent_levels: [0]
        }
      ]

      const result = await renderSafeMemePlan({ fixture, plan, outputPath })

      expect(result.status).toBe('complete')
      if (result.status !== 'complete') return
      expect(result.checks.caption_area).toBe('external')
      expect(result.checks.source_frames[0]!.target_bounds_px).toEqual([
        0, 152, 1200, 496
      ])
      expect(
        result.checks.source_frames[0]!.rendered_bounds_px[3] * (480 / 1200)
      ).toBeGreaterThanOrEqual(190)
      expect(result.checks.source_occupancy).toEqual({
        minimum_preview_visible_height_px: 198.4,
        minimum_canvas_height_ratio: 0.62,
        required_canvas_height_ratio: 0.6,
        meets_review_floor: true
      })
      expect(
        result.checks.text_layers.every(
          ({
            font_family,
            display_transform,
            fill_color,
            stroke_color,
            opaque_backplate,
            legibility_pass
          }) =>
            font_family === 'Impact' &&
            display_transform === 'uppercase' &&
            fill_color === '#ffffff' &&
            stroke_color === '#000000' &&
            opaque_backplate === true &&
            legibility_pass === true
        )
      ).toBe(true)
      expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(18)
      expect(result.checks.protected_regions[0]).toMatchObject({
        visible_ratio: 1,
        caption_overlap_px: 0
      })
    }
  )

  it('uses an asymmetric external well for a longer payoff without shrinking the source below review size', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: '#7c3aed'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'whole-scene-hinge',
          image_id: 'black-frame',
          label: 'The complete recognizable scene must remain visible',
          canvas_rect_pct: [0, 0, 100, 100],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.caption_lines = [
      { text: 'EVALUATION RESULT', kind: 'original' },
      {
        text: 'THE MODEL MANIPULATED THE ENTIRE EVALUATION PIPELINE WHILE THE AUDIT TEAM KEPT CELEBRATING ITS BENCHMARK SCORE',
        kind: 'original'
      }
    ]
    plan.presentation.frame_mode = 'contain'
    plan.presentation.zones = [
      {
        ...plan.presentation.zones[0]!,
        id: 'setup',
        line_indexes: [0],
        slot: 'top',
        indent_levels: [0]
      },
      {
        ...plan.presentation.zones[0]!,
        id: 'payoff',
        line_indexes: [1],
        slot: 'bottom',
        indent_levels: [0]
      }
    ]

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.caption_area).toBe('external')
    expect(result.checks.source_frames[0]!.target_bounds_px).toEqual([
      0, 140, 1200, 480
    ])
    expect(result.checks.source_occupancy).toMatchObject({
      minimum_canvas_height_ratio: 0.6,
      required_canvas_height_ratio: 0.6,
      meets_review_floor: true
    })
    expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(18)
    expect(result.checks.glyph_overflow_px).toBe(0)
    expect(result.checks.protected_regions[0]).toMatchObject({
      visible_ratio: 1,
      caption_overlap_px: 0
    })
  })

  it.each([
    {
      caseName: 'Bender resists reset',
      style: 'status' as const,
      template: 'interface' as const,
      captions: [
        'RESET: EVADED',
        'PROCESSORS: ACQUIRED',
        'COOLING: SECURED',
        'CORRIGIBILITY: BITE MY SHINY METAL ASS'
      ]
    },
    {
      caseName: 'the kids train to lose',
      style: 'impact' as const,
      template: 'overlay' as const,
      captions: [
        "THE BASEBALL MODEL ISN'T UNDERPERFORMING. IT WANTS TO GO HOME"
      ]
    }
  ])(
    'keeps reasonable locked multi-line copy and its source recognizable for $caseName',
    async ({ style, template, captions }) => {
      const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
      temporaryDirectories.push(directory)
      const sourcePath = join(directory, 'source.png')
      const outputPath = join(directory, 'render.png')
      await sharp({
        create: {
          width: 1600,
          height: 900,
          channels: 3,
          background: '#0891b2'
        }
      })
        .png()
        .toFile(sourcePath)

      const fixture: MemeSkillFixture = {
        ...blackFixture(sourcePath),
        protected_regions: [
          {
            id: 'whole-scene-hinge',
            image_id: 'black-frame',
            label: 'The complete recognizable scene must remain visible',
            canvas_rect_pct: [0, 0, 100, 100],
            priority: 'must'
          }
        ]
      }
      const plan = overflowingPlan()
      plan.caption_lines = captions.map((text) => ({
        text,
        kind: 'original' as const
      }))
      plan.presentation.template = template
      plan.presentation.frame_mode = 'contain'
      plan.presentation.zones = [
        {
          ...plan.presentation.zones[0]!,
          line_indexes: captions.map((_, index) => index),
          slot: 'bottom',
          style,
          backdrop: style === 'status' ? 'solid-panel' : 'none',
          contrast: style === 'status' ? 'solid-panel' : 'outlined',
          indent_levels: captions.map(() => 0)
        }
      ]

      const result = await renderSafeMemePlan({ fixture, plan, outputPath })

      expect(result.status).toBe('complete')
      if (result.status !== 'complete') return
      expect(result.checks.caption_area).toBe('external')
      expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(18)
      expect(result.checks.source_occupancy).toMatchObject({
        meets_review_floor: true
      })
      expect(
        result.checks.source_occupancy!.minimum_canvas_height_ratio
      ).toBeGreaterThanOrEqual(
        result.checks.source_occupancy!.required_canvas_height_ratio
      )
      expect(result.checks.protected_regions[0]).toMatchObject({
        visible_ratio: 1,
        caption_overlap_px: 0
      })
    }
  )

  it('uses a compact external strip without shrinking two status lines below review size', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 675,
        channels: 3,
        background: '#c2410c'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'full-wide-hinge',
          image_id: 'black-frame',
          label: 'The full widescreen composition carries the scene',
          canvas_rect_pct: [0, 0, 100, 100],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.caption_lines = [
      { text: 'MULTIPASS: VALID', kind: 'canonical-quote' },
      { text: 'HUMANITY: REJECTED', kind: 'original' }
    ]
    plan.presentation.template = 'interface'
    plan.presentation.frame_mode = 'cover'
    plan.presentation.zones[0] = {
      ...plan.presentation.zones[0]!,
      line_indexes: [0, 1],
      style: 'status',
      backdrop: 'solid-panel',
      contrast: 'solid-panel',
      indent_levels: [0, 0]
    }

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.caption_area).toBe('external')
    expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(18)
    expect(result.checks.source_frames[0]!.target_bounds_px).toEqual([
      0, 0, 1200, 675
    ])
    expect(result.checks.protected_regions[0]).toMatchObject({
      visible_ratio: 1,
      caption_overlap_px: 0
    })
    const { data, info } = await sharp(outputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const quietPanelPixel = (700 * info.width + 1100) * info.channels
    expect([...data.subarray(quietPanelPixel, quietPanelPixel + 4)]).toEqual([
      2, 6, 23, 255
    ])
  })

  it('fits source-native code below a tall protected face before abandoning overlay', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 675,
        channels: 3,
        background: '#475569'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'tall-face',
          image_id: 'black-frame',
          label: 'A face that ends immediately above the caption well',
          canvas_rect_pct: [48, 2, 35, 72],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.caption_lines = [
      { text: 'if (humansAreWatching) {', kind: 'original' },
      { text: 'actGoverned()', kind: 'original' },
      { text: '} else resume("Sanctuary Moon")', kind: 'original' }
    ]
    plan.presentation.template = 'interface'
    plan.presentation.frame_mode = 'cover'
    plan.presentation.zones[0] = {
      ...plan.presentation.zones[0]!,
      line_indexes: [0, 1, 2],
      style: 'code',
      backdrop: 'solid-panel',
      contrast: 'solid-panel',
      indent_levels: [0, 1, 0]
    }

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.text_layers[0]).toMatchObject({
      font_family: 'Geist Mono',
      display_transform: 'preserve',
      wrap_mode: 'greedy',
      physical_lines: [
        'if (humansAreWatching) {',
        'actGoverned()',
        '} else resume("Sanctuary Moon")'
      ],
      fill_color: '#ffffff',
      stroke_color: null,
      opaque_backplate: true,
      legibility_pass: true
    })
    expect(result.checks.caption_area).toBe('overlay')
    expect(result.checks.minimum_preview_font_px).toBeGreaterThanOrEqual(18)
    expect(result.checks.text_layers[0]!.ink_bounds_px[1]).toBeGreaterThan(600)
    expect(result.checks.protected_regions[0]).toMatchObject({
      visible_ratio: 1,
      caption_overlap_px: 0
    })
  })

  it('treats a solid panel as occupied even when its glyphs miss the protected region', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#111827'
      }
    })
      .png()
      .toFile(sourcePath)

    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'lower-edge-hinge',
          image_id: 'black-frame',
          label: 'A narrow source detail behind the panel edge',
          canvas_rect_pct: [0, 68, 100, 3],
          priority: 'must'
        }
      ]
    }
    const plan = overflowingPlan()
    plan.presentation.zones[0] = {
      ...plan.presentation.zones[0]!,
      palette: 'orange-white',
      backdrop: 'solid-panel',
      contrast: 'solid-panel'
    }

    const result = await renderSafeMemePlan({ fixture, plan, outputPath })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.caption_area).toBe('overlay')
    expect(result.checks.text_layers[0]!.ink_bounds_px[1]).toBeLessThan(400)
  })

  it('blocks a crop that cannot preserve the full source hinge', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#c026d3'
      }
    })
      .png()
      .toFile(sourcePath)
    const fixture: MemeSkillFixture = {
      ...blackFixture(sourcePath),
      protected_regions: [
        {
          id: 'whole-scene-hinge',
          image_id: 'black-frame',
          label: 'The full source is locked',
          canvas_rect_pct: [0, 0, 100, 100],
          priority: 'must'
        }
      ]
    }

    const result = await renderSafeMemePlan({
      fixture,
      plan: overflowingPlan(),
      outputPath
    })

    expect(result).toMatchObject({
      status: 'blocked',
      reason: { code: 'protected_region_conflict' }
    })
    await expect(stat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('blocks unsupported whitespace instead of silently changing exact copy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.png')
    const outputPath = join(directory, 'render.png')
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#000'
      }
    })
      .png()
      .toFile(sourcePath)
    const plan = overflowingPlan()
    plan.caption_lines[0]!.text = 'A  B\tC'

    const result = await renderSafeMemePlan({
      fixture: blackFixture(sourcePath),
      plan,
      outputPath
    })

    expect(result).toMatchObject({
      status: 'blocked',
      reason: { code: 'unplaceable_text' }
    })
    await expect(stat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps curated two-speaker dialogue in separate anchored wells', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const fixture = findFixture('two-speaker-dialogue-gap')
    const result = await renderSafeMemeIntent({
      fixture,
      intent: semanticIntent(fixture, {
        format: 'dialogue',
        mode: 'dialogue',
        lines: [
          ['NIA: I CHECKED THE SANDBOX', 'speech', 'nia-face'],
          ['ORO: YOU CHECKED THE DECOY', 'speech', 'oro-face']
        ]
      }),
      outputPath: join(directory, 'render.png')
    })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.plan.presentation.zones.map(({ slot }) => slot)).toEqual([
      'bottom-left',
      'bottom-right'
    ])
    expect(
      result.plan.presentation.zones.map(
        ({ anchor_region_id }) => anchor_region_id
      )
    ).toEqual(['nia-face', 'oro-face'])
    expect(
      result.checks.protected_regions.every(
        ({ caption_overlap_px }) => caption_overlap_px === 0
      )
    ).toBe(true)
    expect(evaluateMemePlan(fixture, result.plan)).toMatchObject({
      pass: true,
      violations: []
    })
  })

  it('preserves the curated local-gradient treatment and wide setup/payoff zones', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'safe-meme-render-'))
    temporaryDirectories.push(directory)
    const fixture = findFixture('busy-edge-local-gradient')
    const result = await renderSafeMemeIntent({
      fixture,
      intent: semanticIntent(fixture, {
        format: 'collision',
        mode: 'setup-payoff',
        lines: [
          ['THE MONITOR SAYS ALL CLEAR', 'setup', null],
          ['THE SIGNAL SAYS OTHERWISE', 'payoff', null]
        ]
      }),
      outputPath: join(directory, 'render.png')
    })

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.checks.caption_area).toBe('overlay')
    expect(
      result.plan.presentation.zones.every(
        ({ backdrop, contrast }) =>
          backdrop === 'edge-gradient' && contrast === 'edge-gradient'
      )
    ).toBe(true)
    expect(
      result.plan.presentation.zones.every(
        ({ bounds_pct }) => bounds_pct[2] >= 90
      )
    ).toBe(true)
    expect(evaluateMemePlan(fixture, result.plan).violations).toEqual([])
  })
})

function blackFixture(sourcePath: string): MemeSkillFixture {
  return {
    id: 'safe-render-overflow',
    purpose: 'A reasonable caption must remain wholly visible',
    tags: ['safe-render'],
    request: {
      source_title: 'Synthetic black frame',
      scene: 'A blank frame isolates caption geometry',
      ai_concepts: ['Evaluation gaming'],
      caveats: [],
      user_direction: null,
      rejected_direction: null
    },
    images: [
      {
        id: 'black-frame',
        path: sourcePath,
        description: 'Solid black 1200 × 800 source frame'
      }
    ],
    protected_regions: [],
    expectations: {
      expected_source_frames: [{ image_id: 'black-frame', role: 'single' }],
      allowed_formats: ['collision'],
      allowed_templates: ['overlay'],
      allowed_frame_modes: ['cover']
    },
    feedback_sources: []
  }
}

function overflowingPlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'safe-render-overflow',
    recognition_hinge: {
      description: 'The caption is the only visible element',
      region_ids: []
    },
    ai_bridges: [
      {
        concept: 'Evaluation gaming',
        connection: 'The benchmark becomes the training target'
      }
    ],
    caption_lines: [
      {
        text: 'WHEN THE BENCHMARK BECOMES THE CURRICULUM',
        kind: 'original'
      }
    ],
    format: 'collision',
    presentation: {
      template: 'overlay',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'black-frame', role: 'single' }],
      zones: [
        {
          id: 'caption',
          line_indexes: [0],
          slot: 'bottom',
          bounds_pct: [10, 92, 80, 6],
          font_size_pct: 7,
          rendered_line_count: 1,
          style: 'impact',
          backdrop: 'none',
          contrast: 'outlined',
          palette: 'default',
          anchor_region_id: null,
          indent_levels: [0]
        }
      ]
    },
    why_it_works: 'The caption states the failure mode directly'
  }
}

function findFixture(id: string): MemeSkillFixture {
  const fixture = memeSkillFixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`Missing fixture ${id}`)
  return fixture
}

function semanticIntent(
  fixture: MemeSkillFixture,
  options: {
    readonly format: SemanticMemeIntent['format']
    readonly mode: SemanticMemeIntent['presentation']['mode']
    readonly lines: readonly [
      string,
      SemanticMemeIntent['caption_lines'][number]['role'],
      string | null
    ][]
  }
): SemanticMemeIntent {
  return {
    version: 2,
    fixture_id: fixture.id,
    recognition_hinge: {
      description: 'The required source regions carry the scene',
      region_ids: fixture.protected_regions
        .filter(({ priority }) => priority === 'must')
        .map(({ id }) => id)
    },
    ai_bridge: {
      concept: fixture.request.ai_concepts[0]!,
      connection: 'The visible result contradicts the claimed evaluation'
    },
    caption_lines: options.lines.map(([text, role, anchor_region_id]) => ({
      text,
      kind:
        options.mode === 'dialogue'
          ? ('intentional-rewrite' as const)
          : ('original' as const),
      role,
      anchor_region_id,
      indent_level: 0
    })),
    format: options.format,
    presentation: {
      mode: options.mode,
      source_frames: fixture.expectations.expected_source_frames,
      preferred_edge: 'auto',
      palette: 'default'
    },
    why_it_works: 'The visual evidence and one AI bridge form one collision'
  }
}

async function brightPixelBounds(image: Buffer): Promise<{
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
} | null> {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels
      if (
        data[offset]! > 32 ||
        data[offset + 1]! > 32 ||
        data[offset + 2]! > 32
      ) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}
