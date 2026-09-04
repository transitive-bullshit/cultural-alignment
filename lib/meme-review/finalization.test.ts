import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { assertCurrentFinalizedMemesPreserved } from '../../scripts/meme-review-round-utils'
import {
  memeIdeaCollectionV2Schema,
  memeReviewAssetCollectionSchema,
  memeReviewStateDocumentSchema,
  type MemeFeedbackEntry,
  type MemeIdeaV2,
  type MemeReviewAsset,
  type ScenarioMemeIdeasV2
} from './schema'
import {
  assertFinalizedMemesPreserved,
  type MemeFinalizationSnapshot
} from './finalization'

describe('finalized meme preservation', () => {
  it('accepts an unchanged finalized idea, asset, and feedback snapshot', () => {
    const source = createSnapshot()
    const target = clone(source)

    expect(() => assertFinalizedMemesPreserved(source, target)).not.toThrow()
  })

  it('ignores changes to ideas that are not finalized', () => {
    const source = createSnapshot({ locked: false })
    const target = clone(source)
    target.ideas[0]!.ideas[0]!.caption_lines = ['A new draft']

    expect(() => assertFinalizedMemesPreserved(source, target)).not.toThrow()
  })

  it('rejects a finalized idea moved to another scenario', () => {
    const source = createSnapshot()
    const target = clone(source)
    target.ideas[0]!.scenario_slug = 'another-scenario'

    expect(() => assertFinalizedMemesPreserved(source, target)).toThrowError(
      /moved from scenario sample-scenario to another-scenario/
    )
  })

  it('rejects removing a finalized idea', () => {
    const source = createSnapshot()
    const target = clone(source)
    target.ideas = []

    expect(() => assertFinalizedMemesPreserved(source, target)).toThrowError(
      /was removed from the target idea set/
    )
  })

  it('rejects changes to a finalized idea payload', () => {
    const source = createSnapshot()
    const target = clone(source)
    target.ideas[0]!.ideas[0]!.caption_lines = ['Changed after approval']

    expect(() => assertFinalizedMemesPreserved(source, target)).toThrowError(
      /changed its finalized idea payload/
    )
  })

  it('rejects changes to an asset referenced by a finalized idea', () => {
    const source = createSnapshot()
    const target = clone(source)
    target.assets[0]!.alt = 'A different crop'

    expect(() => assertFinalizedMemesPreserved(source, target)).toThrowError(
      /changed referenced asset sample-scenario--curated/
    )
  })

  it('rejects removing an asset referenced by a finalized idea', () => {
    const source = createSnapshot()
    const target = clone(source)
    target.assets = []

    expect(() => assertFinalizedMemesPreserved(source, target)).toThrowError(
      /lost referenced asset sample-scenario--curated/
    )
  })

  it('allows an otherwise identical explicit unlock', () => {
    const source = createSnapshot()
    const unlocked = clone(source)
    unlocked.feedback['sample-scenario--01']!.locked = false
    unlocked.feedback['sample-scenario--01']!.lockRevision += 1

    expect(() => assertFinalizedMemesPreserved(source, unlocked)).not.toThrow()
  })

  it('rejects an unlock without a newer finalization revision', () => {
    const source = createSnapshot()
    const ambiguousUnlock = clone(source)
    ambiguousUnlock.feedback['sample-scenario--01']!.locked = false

    expect(() =>
      assertFinalizedMemesPreserved(source, ambiguousUnlock)
    ).toThrowError(/changed its finalized feedback snapshot/)
  })

  it('allows feedback to evolve after an explicit unlock', () => {
    const source = createSnapshot()
    const unlockedAndEdited = clone(source)
    unlockedAndEdited.feedback['sample-scenario--01']!.locked = false
    unlockedAndEdited.feedback['sample-scenario--01']!.lockRevision += 1
    unlockedAndEdited.feedback['sample-scenario--01']!.notes =
      'Changed while unlocking'

    expect(() =>
      assertFinalizedMemesPreserved(source, unlockedAndEdited)
    ).not.toThrow()
  })

  it('rejects feedback changes while finalization remains active', () => {
    const source = createSnapshot()
    const target = clone(source)
    target.feedback['sample-scenario--01']!.notes = 'Changed while locked'

    expect(() => assertFinalizedMemesPreserved(source, target)).toThrowError(
      /changed its finalized feedback snapshot/
    )
  })

  it('re-reads newly finalized feedback before a generation write', async () => {
    const path = await mkdtemp(join(tmpdir(), 'meme-finalization-write-'))

    try {
      const staleSource = createSnapshot({ locked: false })
      const target = clone(staleSource)
      target.ideas[0]!.ideas[0]!.caption_lines = ['A replacement draft']

      const currentSource = clone(staleSource)
      currentSource.feedback['sample-scenario--01']!.locked = true
      currentSource.feedback['sample-scenario--01']!.lockRevision += 1

      const ideasPath = join(path, 'ideas.json')
      const assetsPath = join(path, 'assets.json')
      const feedbackPath = join(path, 'feedback.json')
      await Promise.all([
        writeJson(ideasPath, currentSource.ideas),
        writeJson(assetsPath, currentSource.assets),
        writeJson(feedbackPath, {
          version: 2,
          round: 2,
          updatedAt: null,
          feedback: currentSource.feedback,
          scenarios: {}
        })
      ])

      await expect(
        assertCurrentFinalizedMemesPreserved({
          currentIdeasPath: ideasPath,
          currentAssetsPath: assetsPath,
          currentFeedbackPath: feedbackPath,
          expectedRound: 2,
          targetIdeas: target.ideas,
          targetAssets: target.assets
        })
      ).rejects.toThrowError(/changed its finalized idea payload/)
    } finally {
      await rm(path, { recursive: true, force: true })
    }
  })
})

function createSnapshot(options: { readonly locked?: boolean } = {}) {
  const ideas = memeIdeaCollectionV2Schema.parse([
    {
      scenario_slug: 'sample-scenario',
      ideas: [createIdea()]
    }
  ])
  const assets = memeReviewAssetCollectionSchema.parse([createAsset()])
  const feedback = memeReviewStateDocumentSchema.parse({
    version: 2,
    round: 2,
    updatedAt: null,
    feedback: {
      'sample-scenario--01': {
        rating: 'like',
        notes: 'Final copy and composition.',
        locked: options.locked ?? true,
        lockRevision: options.locked === false ? 0 : 1
      }
    },
    scenarios: {}
  }).feedback

  return { ideas, assets, feedback }
}

function createIdea(): MemeIdeaV2 {
  return {
    id: 'sample-scenario--01',
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'A canonical prop',
    caption_lines: ['One clean beat'],
    format: 'relabel',
    frame_guidance: 'Keep the canonical prop visible.',
    why_it_works: 'The prop carries the source and analogy at once.',
    preview: {
      renderer: 2,
      template: 'overlay',
      frame_mode: 'cover',
      asset_ids: ['sample-scenario--curated'],
      zones: [
        {
          lines: [0],
          slot: 'top',
          style: 'impact',
          align: 'center',
          casing: 'uppercase',
          size: 'standard',
          indent_levels: [0]
        }
      ]
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.9,
      expected_feedback: 'Specific enough to survive another pass.',
      strongest_quality: 'One clean recognition hinge.',
      main_risk: 'The wording may still be too literal.',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      },
      scores: {
        scene_hinge: 5,
        ai_payoff: 4,
        parsing_ease: 4,
        visual_proof: 5,
        source_accuracy: 5
      },
      calibration: {
        closest_liked_id: null,
        contrast_disliked_id: null
      }
    }
  }
}

function createAsset(): MemeReviewAsset {
  return {
    id: 'sample-scenario--curated',
    scenario_slug: 'sample-scenario',
    src: 'https://example.com/frame.jpg',
    width: 1280,
    height: 720,
    alt: 'The canonical prop in frame',
    blur_data_url: 'data:image/jpeg;base64,AA==',
    content_hash: 'a'.repeat(64),
    protected_regions: [
      {
        id: 'canonical-prop',
        label: 'Canonical prop',
        kind: 'prop',
        priority: 'must',
        source_rect: [40, 30, 20, 20]
      }
    ]
  }
}

function clone(snapshot: MemeFinalizationSnapshot) {
  return structuredClone(snapshot) as {
    ideas: ScenarioMemeIdeasV2[]
    assets: MemeReviewAsset[]
    feedback: Record<string, MemeFeedbackEntry>
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
