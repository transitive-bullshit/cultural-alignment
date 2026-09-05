import { describe, expect, it } from 'vitest'

import { buildArchiveComparisonManifest } from './selection'

describe('archive A/B selection', () => {
  it('freezes 25 finalized and 25 disliked ideas from unique scenes', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const finalized = manifest.cases.filter(
      ({ cohort }) => cohort === 'finalized'
    )
    const disliked = manifest.cases.filter(
      ({ cohort }) => cohort === 'disliked'
    )

    expect(manifest.cases).toHaveLength(50)
    expect(finalized).toHaveLength(25)
    expect(disliked).toHaveLength(25)
    expect(
      new Set(manifest.cases.map(({ scenario_slug }) => scenario_slug)).size
    ).toBe(50)
    expect(
      finalized.every(
        ({ human_rating, locked_copy }) =>
          human_rating === 'like' && locked_copy
      )
    ).toBe(true)
    expect(
      disliked.every(
        ({ human_rating, locked_copy }) =>
          human_rating === 'dislike' && !locked_copy
      )
    ).toBe(true)
  })

  it('resolves authentic pixels, protected regions, and high-signal notes', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const assets = manifest.cases.flatMap(({ source_assets }) => source_assets)
    const explicitNotes = manifest.cases.filter(
      ({ human_feedback }) => human_feedback
    )

    expect(assets.every(({ src }) => new URL(src).protocol === 'https:')).toBe(
      true
    )
    expect(
      assets.every(({ content_hash }) => /^[a-f0-9]{64}$/.test(content_hash))
    ).toBe(true)
    expect(
      assets.filter(({ protected_regions }) => protected_regions.length > 0)
        .length
    ).toBeGreaterThan(30)
    expect(explicitNotes.length).toBeGreaterThanOrEqual(15)
  })

  it('covers mutable copy and non-overlay composition branches', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const formats = new Set(manifest.cases.map(({ idea }) => idea.format))
    const templates = new Set(
      manifest.cases.flatMap(({ idea }) =>
        idea.preview.template ? [idea.preview.template] : []
      )
    )

    expect(formats).toEqual(
      new Set([
        'canon',
        'collision',
        'dialogue',
        'relabel',
        'source-native interface',
        'state contrast'
      ])
    )
    expect([...templates]).toEqual(
      expect.arrayContaining([
        'band-bottom',
        'band-top',
        'diptych',
        'interface',
        'overlay'
      ])
    )
    expect(
      [...templates].some((template) => template.startsWith('sidecar-'))
    ).toBe(true)
  })

  it('resolves locked finalists from their fingerprint-verified historical revisions', async () => {
    const manifest = await buildArchiveComparisonManifest()
    const finalists = manifest.cases.filter(
      ({ cohort }) => cohort === 'finalized'
    )
    const historical = finalists.filter(
      ({ finalized_version }) =>
        finalized_version && finalized_version.revisionKey !== 'round-05'
    )

    expect(historical.length).toBeGreaterThan(15)
    expect(
      historical.every(({ finalized_version, idea }) =>
        finalized_version!.revisionKey === 'round-01'
          ? idea.preview.renderer === 1
          : idea.preview.renderer === 2
      )
    ).toBe(true)
    expect(
      finalists.every(({ idea, source_assets }) =>
        idea.preview.renderer === 2 && idea.preview.asset_ids
          ? source_assets.map(({ id }) => id).join('|') ===
            idea.preview.asset_ids.join('|')
          : source_assets.length === 1
      )
    ).toBe(true)
  })
})
