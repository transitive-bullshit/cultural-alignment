import { join } from 'node:path'

import { memeIdeaCollectionV2Schema } from '../lib/meme-review/schema'
import {
  memeReviewRoundsPath,
  readJson,
  sha256
} from './meme-review-round-utils'

const roundPath = join(memeReviewRoundsPath, 'round-02')
const baseline = await readJson(join(roundPath, 'layout-pass-baseline.json'))
if (!isRecord(baseline) || !isRecord(baseline.part_editorial_sha256)) {
  throw new Error('The layout-pass editorial baseline is malformed')
}
if (
  typeof baseline.expected_scenarios !== 'number' ||
  typeof baseline.expected_ideas !== 'number' ||
  typeof baseline.minimum_ideas_per_scenario !== 'number'
) {
  throw new Error('The layout-pass completeness baseline is malformed')
}
const expectedScenarios = baseline.expected_scenarios
const expectedIdeas = baseline.expected_ideas
const minimumIdeasPerScenario = baseline.minimum_ideas_per_scenario

const summaries = []
for (const [partName, expectedHash] of Object.entries(
  baseline.part_editorial_sha256
).toSorted(([left], [right]) => left.localeCompare(right))) {
  if (typeof expectedHash !== 'string') {
    throw new Error(`Missing editorial hash for ${partName}`)
  }

  const rawScenarios = await readJson(
    join(roundPath, 'parts', `${partName}.json`)
  )
  const scenarios = memeIdeaCollectionV2Schema.parse(rawScenarios)
  const incompleteScenario = scenarios.find(
    ({ ideas }) => ideas.length < minimumIdeasPerScenario
  )
  if (incompleteScenario) {
    throw new Error(
      `${partName}/${incompleteScenario.scenario_slug} has only ${incompleteScenario.ideas.length} ideas; expected at least ${minimumIdeasPerScenario}`
    )
  }
  const editorialPayload = (
    rawScenarios as {
      scenario_slug: string
      ideas: Record<string, unknown>[]
    }[]
  ).map(({ scenario_slug, ideas }) => ({
    scenario_slug,
    ideas: ideas.map(
      ({
        preview: _preview,
        frame_guidance: _frameGuidance,
        critic: _critic,
        ...editorial
      }) => editorial
    )
  }))
  const actualHash = sha256(JSON.stringify(editorialPayload))
  if (actualHash !== expectedHash) {
    throw new Error(
      `${partName} changed concept or copy during the layout-only pass: expected ${expectedHash}, received ${actualHash}`
    )
  }

  const ideas = scenarios.flatMap(({ ideas }) => ideas)
  const externalLayouts = ideas.filter(({ preview }) =>
    ['band-top', 'band-bottom', 'sidecar-left', 'sidecar-right'].includes(
      preview.template
    )
  ).length
  const expandedFrames = ideas.filter(
    ({ preview }) => preview.frame_mode !== 'cover'
  ).length

  summaries.push({
    part: partName,
    scenarios: scenarios.length,
    ideas: ideas.length,
    overlays: ideas.length - externalLayouts,
    external_layouts: externalLayouts,
    cover_frames: ideas.length - expandedFrames,
    expanded_frames: expandedFrames,
    editorial_sha256: actualHash
  })
}

const totals = summaries.reduce(
  (result, summary) => ({
    scenarios: result.scenarios + summary.scenarios,
    ideas: result.ideas + summary.ideas,
    overlays: result.overlays + summary.overlays,
    external_layouts: result.external_layouts + summary.external_layouts,
    cover_frames: result.cover_frames + summary.cover_frames,
    expanded_frames: result.expanded_frames + summary.expanded_frames
  }),
  {
    scenarios: 0,
    ideas: 0,
    overlays: 0,
    external_layouts: 0,
    cover_frames: 0,
    expanded_frames: 0
  }
)

console.log(JSON.stringify({ totals, parts: summaries }, null, 2))

if (totals.scenarios !== expectedScenarios || totals.ideas !== expectedIdeas) {
  throw new Error(
    `The layout pass is incomplete: expected ${expectedScenarios} scenarios/${expectedIdeas} ideas, received ${totals.scenarios}/${totals.ideas}`
  )
}

if (totals.external_layouts >= totals.overlays) {
  throw new Error(
    `External layouts are still acting as the default (${totals.external_layouts} external vs ${totals.overlays} overlaid)`
  )
}

if (totals.expanded_frames >= totals.cover_frames) {
  throw new Error(
    `Expanded frames are still acting as the default (${totals.expanded_frames} expanded vs ${totals.cover_frames} cover)`
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
