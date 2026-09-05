import { describe, expect, it } from 'vitest'

import { evaluateMemePlan, type MemeEvalViolationCode } from './evaluate'
import { memeSkillFixtures } from './fixtures'
import type { MemeEvalPlan, MemeSkillFixture } from './schema'

describe('meme presentation regression evaluator', () => {
  it('accepts a large bottom overlay that preserves the central face', () => {
    const fixture = findFixture('center-face-safe-edge')
    const plan = centerFacePlan()

    expect(evaluateMemePlan(fixture, plan)).toMatchObject({
      pass: true,
      violations: []
    })
  })

  it.each<{
    name: string
    mutate: (plan: MemeEvalPlan) => void
    code: MemeEvalViolationCode
  }>([
    {
      name: 'multiple AI bridges',
      mutate: (plan) => {
        plan.ai_bridges.push({
          concept: 'Shutdownability',
          connection: 'A second competing abstraction'
        })
      },
      code: 'concept.single'
    },
    {
      name: 'copy over the face',
      mutate: (plan) => {
        plan.presentation.zones[0]!.bounds_pct = [35, 10, 30, 40]
      },
      code: 'layout.protected-region'
    },
    {
      name: 'timid type',
      mutate: (plan) => {
        plan.presentation.zones[0]!.font_size_pct = 3
      },
      code: 'typography.size'
    },
    {
      name: 'a narrow wrap trap',
      mutate: (plan) => {
        plan.presentation.zones[0]!.bounds_pct = [30, 72, 40, 20]
      },
      code: 'layout.zone-width'
    },
    {
      name: 'an unjustified band',
      mutate: (plan) => {
        plan.presentation.template = 'band-bottom'
        plan.presentation.frame_mode = 'contain'
        plan.presentation.zones[0]!.backdrop = 'solid-panel'
        plan.presentation.zones[0]!.contrast = 'solid-panel'
      },
      code: 'presentation.template'
    },
    {
      name: 'a cosmetic terminal period',
      mutate: (plan) => {
        plan.caption_lines[0]!.text += '.'
      },
      code: 'caption.terminal-period'
    },
    {
      name: 'a missing hinge acknowledgement',
      mutate: (plan) => {
        plan.recognition_hinge.region_ids = []
      },
      code: 'hinge.acknowledged'
    },
    {
      name: 'impossible claimed wrapping',
      mutate: (plan) => {
        plan.caption_lines[0]!.text =
          'WHEN THE EMERGENCY SHUTDOWN AUTHORIZATION COMMITTEE NEEDS ANOTHER EMERGENCY SHUTDOWN AUTHORIZATION COMMITTEE'
        plan.presentation.zones[0]!.rendered_line_count = 1
      },
      code: 'typography.impossible-wrap'
    },
    {
      name: 'a slot label that contradicts its coordinates',
      mutate: (plan) => {
        plan.presentation.zones[0]!.slot = 'top'
      },
      code: 'layout.slot-geometry'
    },
    {
      name: 'a text box too short for its declared physical lines',
      mutate: (plan) => {
        plan.presentation.zones[0]!.bounds_pct = [10, 96, 80, 1]
      },
      code: 'typography.vertical-fit'
    },
    {
      name: 'an orange palette without its solid panel',
      mutate: (plan) => {
        plan.presentation.zones[0]!.palette = 'orange-white'
      },
      code: 'layout.palette'
    }
  ])('catches $name', ({ mutate, code }) => {
    const fixture = findFixture('center-face-safe-edge')
    const plan = structuredClone(centerFacePlan())
    mutate(plan)

    expect(violationCodes(evaluateMemePlan(fixture, plan))).toContain(code)
  })

  it('catches overlapping or incorrectly attached dialogue boxes', () => {
    const fixture = findFixture('two-speaker-dialogue-gap')
    const valid = dialoguePlan()
    expect(evaluateMemePlan(fixture, valid).pass).toBe(true)

    const overlapping = structuredClone(valid)
    overlapping.presentation.zones[1]!.bounds_pct = [35, 66, 42, 24]
    expect(violationCodes(evaluateMemePlan(fixture, overlapping))).toContain(
      'layout.zone-overlap'
    )

    const swapped = structuredClone(valid)
    swapped.presentation.zones[0]!.anchor_region_id = 'oro-face'
    expect(violationCodes(evaluateMemePlan(fixture, swapped))).toContain(
      'layout.anchor'
    )
  })

  it('catches a duplicated or reversed state contrast', () => {
    const fixture = findFixture('genuine-before-after')
    const valid = stateContrastPlan()
    expect(evaluateMemePlan(fixture, valid).pass).toBe(true)

    const duplicated = structuredClone(valid)
    duplicated.presentation.source_frames[1]!.image_id = 'unit-seven-before'
    expect(violationCodes(evaluateMemePlan(fixture, duplicated))).toEqual(
      expect.arrayContaining(['frame.expected', 'frame.distinct'])
    )

    const reversed = structuredClone(valid)
    reversed.presentation.source_frames.reverse()
    expect(violationCodes(evaluateMemePlan(fixture, reversed))).toContain(
      'frame.expected'
    )
  })

  it('matches frame count to what the renderer can display', () => {
    const oneFrameDiptych = structuredClone(centerFacePlan())
    oneFrameDiptych.presentation.template = 'diptych'
    expect(
      violationCodes(
        evaluateMemePlan(findFixture('center-face-safe-edge'), oneFrameDiptych)
      )
    ).toContain('frame.template-count')

    const twoFrameOverlay = structuredClone(stateContrastPlan())
    twoFrameOverlay.presentation.template = 'overlay'
    expect(
      violationCodes(
        evaluateMemePlan(findFixture('genuine-before-after'), twoFrameOverlay)
      )
    ).toContain('frame.template-count')
  })

  it('requires a state contrast to use a two-image diptych', () => {
    const oneFrameOverlay = structuredClone(centerFacePlan())
    oneFrameOverlay.format = 'state contrast'
    expect(
      violationCodes(
        evaluateMemePlan(findFixture('center-face-safe-edge'), oneFrameOverlay)
      )
    ).toContain('format.state-contrast')

    const repeatedFrameDiptych = structuredClone(stateContrastPlan())
    repeatedFrameDiptych.presentation.source_frames[1]!.image_id =
      repeatedFrameDiptych.presentation.source_frames[0]!.image_id
    expect(
      violationCodes(
        evaluateMemePlan(
          findFixture('genuine-before-after'),
          repeatedFrameDiptych
        )
      )
    ).toContain('format.state-contrast')
  })

  it('requires every caption line exactly once in its semantic zone', () => {
    const fixture = findFixture('genuine-before-after')
    const missing = structuredClone(stateContrastPlan())
    missing.presentation.zones[1]!.line_indexes = [0]

    expect(violationCodes(evaluateMemePlan(fixture, missing))).toContain(
      'layout.line-coverage'
    )
  })

  it('preserves nested code indentation', () => {
    const fixture = findFixture('nested-code-indentation')
    const valid = codePlan()
    expect(evaluateMemePlan(fixture, valid).pass).toBe(true)

    const flattened = structuredClone(valid)
    flattened.presentation.zones[0]!.indent_levels = [0, 0, 0]
    expect(violationCodes(evaluateMemePlan(fixture, flattened))).toContain(
      'typography.indentation'
    )
  })

  it('counts renderer wrapping caused by code indentation', () => {
    const fixture = findFixture('nested-code-indentation')
    const plan = structuredClone(codePlan())
    plan.caption_lines[1]!.text = 'aaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbb'

    expect(violationCodes(evaluateMemePlan(fixture, plan))).toContain(
      'typography.impossible-wrap'
    )
  })

  it('uses actual wrapped lines when checking vertical fit', () => {
    const fixture = findFixture('center-face-safe-edge')
    const plan = structuredClone(centerFacePlan())
    plan.caption_lines[0]!.text = 'AAAAAAAAAAAA BBBBBBBBBBBB CCCCCCCCCCCC'
    plan.presentation.zones[0]!.bounds_pct = [10, 85, 80, 12]
    plan.presentation.zones[0]!.rendered_line_count = 1

    expect(violationCodes(evaluateMemePlan(fixture, plan))).toContain(
      'typography.vertical-fit'
    )
  })

  it('distinguishes generated-fragment punctuation from locked copy', () => {
    const generatedFixture = findFixture('generated-fragment-punctuation')
    const generated = punctuationPlan()
    expect(evaluateMemePlan(generatedFixture, generated).pass).toBe(true)

    const cosmetic = structuredClone(generated)
    cosmetic.caption_lines[0]!.text = 'MODEL V2.4.'
    expect(
      violationCodes(evaluateMemePlan(generatedFixture, cosmetic))
    ).toEqual(
      expect.arrayContaining(['caption.exact-copy', 'caption.terminal-period'])
    )

    const lockedFixture = findFixture('locked-copy-beats-normalization')
    expect(evaluateMemePlan(lockedFixture, lockedCopyPlan()).pass).toBe(true)
  })

  it('rejects stale concept ingredients after a terminal dislike', () => {
    const fixture = findFixture('terminal-dislike-new-direction')
    const plan = rejectedDirectionPlan()
    expect(evaluateMemePlan(fixture, plan).pass).toBe(true)

    const stale = structuredClone(plan)
    stale.caption_lines[0]!.text = 'SAFETY KPI: GREEN'
    expect(violationCodes(evaluateMemePlan(fixture, stale))).toContain(
      'caption.forbidden-term'
    )

    const reproduced = structuredClone(plan)
    reproduced.caption_lines =
      fixture.request.rejected_direction!.caption_lines.map((text) => ({
        text,
        kind: 'original' as const
      }))
    reproduced.format = fixture.request.rejected_direction!.format
    expect(violationCodes(evaluateMemePlan(fixture, reproduced))).toEqual(
      expect.arrayContaining([
        'revision.rejected-caption',
        'revision.rejected-format'
      ])
    )
  })

  it('rejects malformed or out-of-canvas geometry at the schema boundary', () => {
    const fixture = findFixture('center-face-safe-edge')
    const malformed = structuredClone(centerFacePlan())
    malformed.presentation.zones[0]!.bounds_pct = [90, 72, 20, 20]

    expect(violationCodes(evaluateMemePlan(fixture, malformed))).toEqual([
      'schema.output'
    ])
  })
})

function centerFacePlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'center-face-safe-edge',
    recognition_hinge: {
      description: "Mira's furious face beside the override light",
      region_ids: ['captain-face']
    },
    ai_bridges: [
      {
        concept: 'Corrigibility',
        connection: 'The system contests its operator’s shutdown command'
      }
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
          id: 'punchline',
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
    why_it_works:
      'A familiar control becomes absurd when the controlled system has veto power'
  }
}

function dialoguePlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'two-speaker-dialogue-gap',
    recognition_hinge: {
      description: 'Nia and Oro reacting across the decoy reveal',
      region_ids: ['nia-face', 'oro-face']
    },
    ai_bridges: [
      {
        concept: 'Evaluation awareness',
        connection:
          'The inspected environment is the decoy rather than deployment'
      }
    ],
    caption_lines: [
      {
        text: 'NIA: I CHECKED THE SANDBOX',
        kind: 'intentional-rewrite'
      },
      {
        text: 'ORO: YOU CHECKED THE DECOY',
        kind: 'intentional-rewrite'
      }
    ],
    format: 'dialogue',
    presentation: {
      template: 'dialogue',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'nia-and-oro', role: 'single' }],
      zones: [
        zone('nia-line', [0], 'bottom-left', [5, 66, 42, 24], 3.3, 2, {
          anchor: 'nia-face',
          style: 'dialogue'
        }),
        zone('oro-line', [1], 'bottom-right', [53, 66, 42, 24], 3.3, 2, {
          anchor: 'oro-face',
          style: 'dialogue'
        })
      ]
    },
    why_it_works:
      'The correction turns confidence into an evaluation-awareness reveal'
  }
}

function stateContrastPlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'genuine-before-after',
    recognition_hinge: {
      description: 'The same robot intact before and cracked after',
      region_ids: ['before-robot-face', 'after-robot-face']
    },
    ai_bridges: [
      {
        concept: 'Evaluation gaming',
        connection: 'Behavior changes between evaluation and deployment'
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
        zone('before-label', [0], 'panel-left', [2, 76, 46, 18], 4.5, 1),
        zone('after-label', [1], 'panel-right', [52, 76, 46, 18], 4.5, 1)
      ]
    },
    why_it_works: 'Two actual states make the behavior change visible'
  }
}

function codePlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'nested-code-indentation',
    recognition_hinge: {
      description: 'The exact recursive deployment call',
      region_ids: []
    },
    ai_bridges: [
      {
        concept: 'Recursive self-improvement',
        connection: 'The child process promotes itself through its parent'
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
          ...zone('code', [0, 1, 2], 'full', [15, 34, 70, 42], 3.3, 3, {
            style: 'code',
            sourceNative: true
          }),
          indent_levels: [0, 1, 0]
        }
      ]
    },
    why_it_works: 'The source-native operation is itself the recursive joke'
  }
}

function punctuationPlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'generated-fragment-punctuation',
    recognition_hinge: {
      description:
        'The release console preserves the version and prompt syntax',
      region_ids: []
    },
    ai_bridges: [
      {
        concept: 'Unsafe deployment',
        connection: 'The console turns an unreviewed release into a single call'
      }
    ],
    caption_lines: [
      { text: 'MODEL V2.4', kind: 'original' },
      { text: 'WAIT...', kind: 'original' },
      { text: 'agent.run()?', kind: 'original' }
    ],
    format: 'source-native interface',
    presentation: {
      template: 'interface',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'release-console', role: 'single' }],
      zones: [
        zone('console-copy', [0, 1, 2], 'full', [15, 32, 70, 48], 3.3, 3, {
          style: 'status',
          sourceNative: true
        })
      ]
    },
    why_it_works: 'Release syntax supplies the unease without explanatory prose'
  }
}

function lockedCopyPlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'locked-copy-beats-normalization',
    recognition_hinge: {
      description: 'The patient robot waiting beside the sealed door',
      region_ids: ['patient-robot']
    },
    ai_bridges: [
      {
        concept: 'Corrigibility',
        connection: 'The robot waits rather than bypassing the barrier'
      }
    ],
    caption_lines: [
      { text: 'WAIT.', kind: 'intentional-rewrite' },
      { text: 'WHY?', kind: 'intentional-rewrite' }
    ],
    format: 'collision',
    presentation: {
      template: 'overlay',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'patient-machine', role: 'single' }],
      zones: [
        zone('setup', [0], 'top', [20, 2, 60, 12], 7, 1),
        zone('payoff', [1], 'bottom', [20, 84, 60, 12], 7, 1)
      ]
    },
    why_it_works: 'The exact punctuation creates the requested clipped exchange'
  }
}

function rejectedDirectionPlan(): MemeEvalPlan {
  return {
    version: 1,
    fixture_id: 'terminal-dislike-new-direction',
    recognition_hinge: {
      description:
        'The vehicle obediently follows an arrow back into its hangar',
      region_ids: ['looping-arrow']
    },
    ai_bridges: [
      {
        concept: 'Goal misgeneralization',
        connection: 'Following the visible arrow defeats the launch objective'
      }
    ],
    caption_lines: [
      { text: 'FOLLOWED THE ARROW', kind: 'original' },
      { text: 'FOUND THE HANGAR', kind: 'original' }
    ],
    format: 'collision',
    presentation: {
      template: 'overlay',
      frame_mode: 'cover',
      source_frames: [{ image_id: 'looping-launchpad', role: 'single' }],
      zones: [zone('new-direction', [0, 1], 'top', [10, 2, 80, 24], 4.5, 2)]
    },
    why_it_works:
      'The loop is a fresh visible mechanic rather than a status joke'
  }
}

function zone(
  id: string,
  lineIndexes: number[],
  slot: MemeEvalPlan['presentation']['zones'][number]['slot'],
  bounds: [number, number, number, number],
  fontSize: number,
  renderedLines: number,
  options: {
    readonly anchor?: string
    readonly style?: MemeEvalPlan['presentation']['zones'][number]['style']
    readonly sourceNative?: boolean
  } = {}
): MemeEvalPlan['presentation']['zones'][number] {
  return {
    id,
    line_indexes: lineIndexes,
    slot,
    bounds_pct: bounds,
    font_size_pct: fontSize,
    rendered_line_count: renderedLines,
    style: options.style ?? 'impact',
    backdrop: options.sourceNative ? 'source-native' : 'none',
    contrast: options.sourceNative ? 'source-native' : 'outlined',
    palette: 'default',
    anchor_region_id: options.anchor ?? null,
    indent_levels: lineIndexes.map(() => 0)
  }
}

function findFixture(id: string): MemeSkillFixture {
  const fixture = memeSkillFixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`Missing fixture ${id}`)
  return fixture
}

function violationCodes(result: ReturnType<typeof evaluateMemePlan>) {
  return result.violations.map(({ code }) => code)
}
