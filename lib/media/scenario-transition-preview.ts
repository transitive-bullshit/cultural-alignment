const TRANSITION_PREVIEW_LIFETIME_MS = 60_000

type PendingScenarioTransitionPreview = Readonly<{
  expiresAt: number
  scenarioId: string
  src: string
  token: number
}>

export type ScenarioTransitionPreview = Readonly<{
  src: string
  token: number
}>

let nextToken = 0
let pendingPreview: PendingScenarioTransitionPreview | null = null

export function stageScenarioTransitionPreview({
  scenarioId,
  src
}: {
  readonly scenarioId: string
  readonly src: string
}) {
  pendingPreview = {
    expiresAt: Date.now() + TRANSITION_PREVIEW_LIFETIME_MS,
    scenarioId,
    src,
    token: ++nextToken
  }
}

export function readScenarioTransitionPreview(
  scenarioId: string
): ScenarioTransitionPreview | null {
  const preview = pendingPreview

  if (
    !preview ||
    preview.scenarioId !== scenarioId ||
    preview.expiresAt < Date.now()
  ) {
    return null
  }

  return { src: preview.src, token: preview.token }
}

export function clearScenarioTransitionPreview(token: number) {
  if (pendingPreview?.token === token) pendingPreview = null
}
