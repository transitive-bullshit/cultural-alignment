import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { fixtureImagePath, memeSkillFixtures } from '../fixtures'

import { getSkillPackageFiles } from './runner'
import {
  buildArchiveV3Prompt,
  buildArchiveV3CacheKey,
  correctableAgentOutputMessage,
  getArchiveV3SkillPackageFiles,
  parseArchiveV3Intent
} from './v3-runner'

describe('archive v3 runner', () => {
  it('requests semantic intent without asking Codex for physical geometry', () => {
    const prompt = buildArchiveV3Prompt(memeSkillFixtures[0]!)

    expect(prompt).toMatch(/semantic JSON/i)
    expect(prompt).toMatch(/never invent bounds, font sizes, or wrapping/i)
    expect(prompt).not.toContain('bounds_pct')
    expect(prompt).not.toContain('font_size_pct')
    expect(prompt).not.toContain('rendered_line_count')
  })

  it('keeps the Codex output schema free of unsupported regex lookarounds', () => {
    const schema = readFileSync(
      new URL('../semantic-plan.schema.json', import.meta.url),
      'utf8'
    )

    expect(schema).not.toMatch(/\(\?[=!<]/)
  })

  it('rejects semantic intent that names a source outside the fixture', () => {
    const fixture = memeSkillFixtures[0]!
    const intent = semanticIntentFor(fixture.id, 'unstaged-frame')

    expect(() => parseArchiveV3Intent(fixture, intent)).toThrow(
      /unknown source frame unstaged-frame/
    )
  })

  it('rejects a terminally disliked format before rendering', () => {
    const sourceFixture = memeSkillFixtures[0]!
    const fixture = {
      ...sourceFixture,
      request: {
        ...sourceFixture.request,
        rejected_direction: {
          caption_lines: ['THE OLD IDEA'],
          format: 'collision' as const,
          feedback: 'Reject this entire direction'
        }
      },
      expectations: {
        ...sourceFixture.expectations,
        require_rejected_format_change: true
      }
    }
    const intent = semanticIntentFor(fixture.id, fixture.images[0]!.id)

    expect(() => parseArchiveV3Intent(fixture, intent)).toThrow(
      /retained rejected format collision/
    )
  })

  it('canonicalizes redundant roles and format from the semantic mode', () => {
    const fixture = memeSkillFixtures[0]!
    const base = semanticIntentFor(fixture.id, fixture.images[0]!.id)
    const intent = {
      ...base,
      format: 'source-native interface',
      caption_lines: [
        { ...base.caption_lines[0]!, text: 'SETUP', role: 'status' },
        { ...base.caption_lines[0]!, text: 'PAYOFF', role: 'only' }
      ],
      presentation: { ...base.presentation, mode: 'setup-payoff' }
    }

    const parsed = parseArchiveV3Intent(fixture, intent)

    expect(parsed.format).toBe('collision')
    expect(parsed.caption_lines.map(({ role }) => role)).toEqual([
      'setup',
      'payoff'
    ])
  })

  it('feeds correctable agent-output failures into the next attempt', () => {
    const cause = new Error(
      'Semantic intent retained rejected format source-native interface'
    )
    const wrapped = new Error('failed artifacts were retained', { cause })

    expect(correctableAgentOutputMessage(wrapped)).toContain(cause.message)
    expect(correctableAgentOutputMessage(wrapped)).toMatch(
      /format and semantic mode must agree/i
    )
    expect(correctableAgentOutputMessage(wrapped)).toMatch(
      /single or setup-payoff.*canon or relabel/i
    )
    expect(correctableAgentOutputMessage(new Error('socket closed'))).toBe(
      undefined
    )
  })

  it('warns terminal-dislike runs that incompatible labels normalize back to collision', () => {
    const sourceFixture = memeSkillFixtures[0]!
    const fixture = {
      ...sourceFixture,
      request: {
        ...sourceFixture.request,
        rejected_direction: {
          caption_lines: ['THE OLD IDEA'],
          format: 'collision' as const,
          feedback: 'Reject this entire direction'
        }
      },
      expectations: {
        ...sourceFixture.expectations,
        require_rejected_format_change: true
      }
    }

    expect(buildArchiveV3Prompt(fixture)).toMatch(
      /single or setup-payoff.*canon or relabel/i
    )
    expect(buildArchiveV3Prompt(fixture)).toMatch(
      /merely relabeling an incompatible mode is normalized back to collision/i
    )
  })

  it('normalizes an unambiguous region suffix and restores required hinge regions', () => {
    const fixture = memeSkillFixtures[0]!
    const requiredRegionId = fixture.protected_regions[0]!.id
    const intent = {
      ...semanticIntentFor(fixture.id, fixture.images[0]!.id),
      recognition_hinge: {
        description: 'Visible scene hinge',
        region_ids: [`${requiredRegionId} trivial`]
      },
      caption_lines: [
        {
          ...semanticIntentFor(fixture.id, fixture.images[0]!.id)
            .caption_lines[0]!,
          anchor_region_id: `${requiredRegionId} trivial`
        }
      ]
    }

    const parsed = parseArchiveV3Intent(fixture, intent)

    expect(parsed.recognition_hinge.region_ids).toEqual([requiredRegionId])
    expect(parsed.caption_lines[0]!.anchor_region_id).toBe(requiredRegionId)
  })

  it('stages the current production skill package for every revised run', () => {
    expect(getArchiveV3SkillPackageFiles()).toEqual(
      getSkillPackageFiles('current')
    )
  })

  it('keys revised results by the full request and requested model', async () => {
    const sourceFixture = memeSkillFixtures[0]!
    const fixture = {
      ...sourceFixture,
      images: sourceFixture.images.map((image) => ({
        ...image,
        path: fixtureImagePath(sourceFixture, image.id)
      }))
    }
    const common = {
      fixture,
      requestJson: JSON.stringify(fixture.request),
      prompt: buildArchiveV3Prompt(fixture),
      codexVersion: 'codex-cli test'
    }

    const first = await buildArchiveV3CacheKey({
      ...common,
      model: 'model-a'
    })
    const repeated = await buildArchiveV3CacheKey({
      ...common,
      model: 'model-a'
    })
    const changedModel = await buildArchiveV3CacheKey({
      ...common,
      model: 'model-b'
    })
    const changedRequest = await buildArchiveV3CacheKey({
      ...common,
      requestJson: `${common.requestJson}\n`,
      model: 'model-a'
    })

    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(repeated).toBe(first)
    expect(changedModel).not.toBe(first)
    expect(changedRequest).not.toBe(first)
  })
})

function semanticIntentFor(fixtureId: string, imageId: string) {
  return {
    version: 2,
    fixture_id: fixtureId,
    recognition_hinge: { description: 'Visible scene hinge', region_ids: [] },
    ai_bridge: { concept: 'Evaluation gaming', connection: 'Visible mismatch' },
    caption_lines: [
      {
        text: 'THE METRIC BECAME THE TARGET',
        kind: 'original',
        role: 'only',
        anchor_region_id: null,
        indent_level: 0
      }
    ],
    format: 'collision',
    presentation: {
      mode: 'single',
      source_frames: [{ image_id: imageId, role: 'single' }],
      preferred_edge: 'auto',
      palette: 'default'
    },
    why_it_works: 'One visible collision'
  }
}
