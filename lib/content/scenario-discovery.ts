const SCENARIO_DISCOVERY_LIMIT = 3

type DiscoverableScenario = Readonly<{
  conceptIds: readonly string[]
  id: string
  riskFamilyIds: readonly string[]
  slug: string
  sourceId: string
}>

export type RelatedScenarioMatch<Scenario extends DiscoverableScenario> =
  Readonly<{
    scenario: Scenario
    sharedConceptIds: readonly string[]
    sharedRiskFamilyIds: readonly string[]
  }>

export type ScenarioDiscovery<Scenario extends DiscoverableScenario> =
  Readonly<{
    moreFromSource: readonly Scenario[]
    relatedScenarios: readonly RelatedScenarioMatch<Scenario>[]
  }>

/**
 * Finds nearby records without leaking content-ranking work into the client.
 * Concept matches carry more weight because they are more specific than the
 * five broad risk families. A cross-taxonomy bonus rewards corroboration in
 * both modeled dimensions.
 */
export function discoverScenarios<Scenario extends DiscoverableScenario>(
  current: Scenario,
  scenarios: readonly Scenario[]
): ScenarioDiscovery<Scenario> {
  const moreFromSource: Scenario[] = []
  const relatedCandidates: RankedRelatedScenario<Scenario>[] = []

  for (const candidate of scenarios) {
    if (candidate.id === current.id) continue

    if (candidate.sourceId === current.sourceId) {
      if (moreFromSource.length < SCENARIO_DISCOVERY_LIMIT) {
        moreFromSource.push(candidate)
      }

      continue
    }

    const sharedRiskFamilyIds = intersectIds(
      current.riskFamilyIds,
      candidate.riskFamilyIds
    )
    const sharedConceptIds = intersectIds(
      current.conceptIds,
      candidate.conceptIds
    )

    if (sharedRiskFamilyIds.length === 0 && sharedConceptIds.length === 0) {
      continue
    }

    relatedCandidates.push({
      scenario: candidate,
      sharedRiskFamilyIds,
      sharedConceptIds,
      score:
        sharedRiskFamilyIds.length * 2 +
        sharedConceptIds.length * 4 +
        (sharedRiskFamilyIds.length > 0 && sharedConceptIds.length > 0 ? 3 : 0)
    })
  }

  const relatedScenarios = relatedCandidates
    .toSorted(compareRelatedScenarios)
    .slice(0, SCENARIO_DISCOVERY_LIMIT)
    .map(({ scenario, sharedConceptIds, sharedRiskFamilyIds }) => ({
      scenario,
      sharedConceptIds,
      sharedRiskFamilyIds
    }))

  return { moreFromSource, relatedScenarios }
}

type RankedRelatedScenario<Scenario extends DiscoverableScenario> =
  RelatedScenarioMatch<Scenario> &
    Readonly<{
      score: number
    }>

function compareRelatedScenarios<Scenario extends DiscoverableScenario>(
  left: RankedRelatedScenario<Scenario>,
  right: RankedRelatedScenario<Scenario>
) {
  return (
    right.score - left.score ||
    right.sharedConceptIds.length - left.sharedConceptIds.length ||
    right.sharedRiskFamilyIds.length - left.sharedRiskFamilyIds.length ||
    left.scenario.slug.localeCompare(right.scenario.slug, 'en', {
      sensitivity: 'base'
    }) ||
    left.scenario.id.localeCompare(right.scenario.id, 'en')
  )
}

function intersectIds(
  referenceIds: readonly string[],
  candidateIds: readonly string[]
) {
  const candidateIdSet = new Set(candidateIds)

  return [...new Set(referenceIds)].filter((id) => candidateIdSet.has(id))
}
