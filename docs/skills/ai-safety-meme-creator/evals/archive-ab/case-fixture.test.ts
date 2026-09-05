import { describe, expect, it } from 'vitest'

import { buildArchiveFixture } from './case-fixture'
import { buildArchiveComparisonManifest } from './selection'

describe('archive fixture translation', () => {
  it('turns explicit copy and palette feedback into testable invariants', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const comparisonCase = manifest.cases.find(({ human_feedback }) =>
      human_feedback?.includes('orange background')
    )!
    const replacement = comparisonCase.human_feedback?.match(
      /replace\s+["“]([^"”]+)["”]\s+with\s+["“]([^"”]+)["”]/i
    )
    const fixture = buildArchiveFixture(
      comparisonCase,
      stagedPaths(comparisonCase)
    )

    expect(replacement?.[1]).toBeTruthy()
    expect(replacement?.[2]).toBeTruthy()
    expect(fixture.expectations.required_caption_terms).toContainEqual([
      replacement?.[2]
    ])
    expect(fixture.expectations.forbidden_caption_terms).toContain(
      replacement?.[1]
    )
    expect(fixture.expectations.required_palette).toBe('orange-white')
  })

  it('does not label a note-free finalist as a terminal dislike', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const comparisonCase = manifest.cases.find(
      ({ cohort, human_feedback }) => cohort === 'finalized' && !human_feedback
    )!
    const fixture = buildArchiveFixture(
      comparisonCase,
      stagedPaths(comparisonCase)
    )

    expect(fixture.tags).toContain('locked-without-note')
    expect(fixture.tags).not.toContain('terminal-dislike')
    expect(fixture.feedback_sources[0]!.note_includes).toMatch(
      /locked and finalized/i
    )
  })

  it('supplies finalized human layout feedback and derives its geometry contract', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const comparisonCase = manifest.cases.find(
      ({ cohort, human_feedback }) =>
        cohort === 'finalized' &&
        /setup[\s\S]*top[\s\S]*payoff[\s\S]*bottom/i.test(human_feedback ?? '')
    )!
    const fixture = buildArchiveFixture(
      comparisonCase,
      stagedPaths(comparisonCase)
    )

    expect(fixture.request.user_direction).toContain(
      comparisonCase.human_feedback
    )
    expect(fixture.expectations.separate_line_zones).toBe(true)
    expect(fixture.expectations.required_line_slots?.[0]).toEqual(
      expect.arrayContaining(['top'])
    )
    expect(
      fixture.expectations.required_line_slots?.[
        comparisonCase.idea.caption_lines.length - 1
      ]
    ).toEqual(expect.arrayContaining(['bottom']))
  })

  it('locks an explicitly praised first line while leaving the payoff mutable', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const comparisonCase = manifest.cases.find(({ human_feedback }) =>
      /first line is (?:perfect|strong)/i.test(human_feedback ?? '')
    )!
    const fixture = buildArchiveFixture(
      comparisonCase,
      stagedPaths(comparisonCase)
    )

    expect(fixture.expectations.exact_caption_lines).toBeUndefined()
    expect(fixture.expectations.exact_caption_lines_by_index).toEqual({
      0: comparisonCase.idea.caption_lines[0]
    })
  })

  it('does not contradict an exact retained line that locks a terminal period', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const comparisonCases = manifest.cases.filter(
      ({ human_feedback, idea }) =>
        /first line is (?:perfect|strong)/i.test(human_feedback ?? '') &&
        idea.caption_lines[0]?.endsWith('.')
    )

    expect(comparisonCases.length).toBeGreaterThan(0)
    for (const comparisonCase of comparisonCases) {
      const fixture = buildArchiveFixture(
        comparisonCase,
        stagedPaths(comparisonCase)
      )
      expect(fixture.expectations.exact_caption_lines_by_index?.[0]).toBe(
        comparisonCase.idea.caption_lines[0]
      )
      expect(fixture.expectations.omit_cosmetic_terminal_periods).toBe(false)
    }
  })

  it('makes explicit finalist layout locks agent-visible without freezing incidental crops', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const fixtures = manifest.cases.map((comparisonCase) => ({
      comparisonCase,
      fixture: buildArchiveFixture(comparisonCase, stagedPaths(comparisonCase))
    }))

    const missingLocks = fixtures.flatMap(({ comparisonCase, fixture }) => {
      const direction = fixture.request.user_direction ?? ''
      const missing: string[] = []
      if (
        comparisonCase.cohort === 'finalized' &&
        /revert|previous version(?:'s)? layout|first version(?:'s)? layout/i.test(
          comparisonCase.human_feedback ?? ''
        ) &&
        comparisonCase.idea.preview.template
      ) {
        const lock = `Locked template: ${fixture.expectations.allowed_templates[0]}`
        if (!direction.includes(lock)) missing.push(`${fixture.id}: ${lock}`)
      }
      if (comparisonCase.cohort === 'finalized') {
        for (const { image_id, role } of fixture.expectations
          .expected_source_frames) {
          const lock = `${image_id} (${role})`
          if (!direction.includes(lock)) missing.push(`${fixture.id}: ${lock}`)
        }
      }
      if (
        fixture.expectations.required_line_slots &&
        !direction.includes('Locked semantic placement:')
      ) {
        missing.push(`${fixture.id}: semantic placement`)
      }
      return missing
    })

    expect(missingLocks).toEqual([])

    const noteFreeFinalist = fixtures.find(
      ({ comparisonCase }) =>
        comparisonCase.cohort === 'finalized' &&
        !comparisonCase.human_feedback &&
        comparisonCase.idea.preview.frame_mode
    )!.fixture
    expect(noteFreeFinalist.expectations.allowed_frame_modes).toEqual([
      'cover',
      'contain',
      'extend'
    ])
  })

  it('requires every disliked caption to change and terminal dislikes to change format', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const cases = manifest.cases.filter(({ cohort }) => cohort === 'disliked')
    const fixtures = cases.map((comparisonCase) => ({
      comparisonCase,
      fixture: buildArchiveFixture(comparisonCase, stagedPaths(comparisonCase))
    }))

    expect(
      fixtures.every(
        ({ fixture }) =>
          fixture.expectations.require_rejected_caption_change === true
      )
    ).toBe(true)
    expect(
      fixtures
        .filter(({ comparisonCase }) => !comparisonCase.human_feedback)
        .every(
          ({ fixture }) =>
            fixture.expectations.require_rejected_format_change === true
        )
    ).toBe(true)
    expect(
      fixtures.every(
        ({ fixture }) =>
          fixture.expectations.maximum_caption_lines === 3 &&
          fixture.expectations.maximum_caption_words === 24 &&
          fixture.expectations.maximum_zones === 3 &&
          fixture.expectations.maximum_rendered_lines_per_zone === 4 &&
          fixture.expectations.minimum_font_size_pct === 3.75
      )
    ).toBe(true)
  })
})

function stagedPaths(
  comparisonCase: Awaited<
    ReturnType<typeof buildArchiveComparisonManifest>
  >['cases'][number]
): ReadonlyMap<string, string> {
  return new Map(
    comparisonCase.source_assets.map(({ content_hash }) => [
      content_hash,
      `/tmp/${content_hash}`
    ])
  )
}
