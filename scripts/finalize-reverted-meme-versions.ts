import { pathToFileURL } from 'node:url'

import { PATCH as patchMemeFeedback } from '../app/api/meme-feedback/route'
import {
  loadMemeReviewCatalog,
  type MemeReviewCatalog
} from '../lib/meme-review/catalog'
import {
  memeFinalizationFingerprint,
  memeRevisionFingerprint
} from '../lib/meme-review/fingerprint'
import type {
  MemeFeedbackEntry,
  MemeReviewBatchPatch,
  MemeReviewStateDocument
} from '../lib/meme-review/schema'
import {
  getMemeReviewStatePath,
  readMemeReviewState
} from '../lib/meme-review/store'

const previousRevisionKey = 'round-01'
const revertWordPattern = /\brevert\b/i

type MigrationActionKind =
  | 'finalize-reverted-version'
  | 'materialize-legacy-finalization'

export type MemeFinalizationMigrationAction = {
  readonly kind: MigrationActionKind
  readonly ideaId: string
  readonly expectedFeedback: MemeFeedbackEntry
  readonly targetRevisionKey: string
  readonly expectedPayloadFingerprint: string
}

export type MemeFinalizationMigrationSkip = {
  readonly ideaId: string
  readonly reason: string
}

export type MemeFinalizationMigrationPlan = {
  readonly round: number
  readonly scannedFeedbackCount: number
  readonly revertNoteCount: number
  readonly actions: readonly MemeFinalizationMigrationAction[]
  readonly skipped: readonly MemeFinalizationMigrationSkip[]
}

export function planMemeFinalizationMigration(
  catalog: MemeReviewCatalog,
  state: MemeReviewStateDocument
): MemeFinalizationMigrationPlan {
  if (state.round !== catalog.activeBatch) {
    throw new Error(
      `Feedback belongs to batch ${state.round}, but the active batch is ${catalog.activeBatch}`
    )
  }

  const actions: MemeFinalizationMigrationAction[] = []
  const skipped: MemeFinalizationMigrationSkip[] = []
  let revertNoteCount = 0

  for (const [ideaId, feedback] of Object.entries(state.feedback).toSorted(
    ([left], [right]) => left.localeCompare(right)
  )) {
    const asksToRevert = revertWordPattern.test(feedback.notes)
    if (asksToRevert) revertNoteCount += 1

    if (feedback.locked && feedback.finalizedVersion === undefined) {
      const skipReason = getCommonSkipReason(catalog, ideaId)
      if (skipReason) {
        skipped.push({ ideaId, reason: skipReason })
        continue
      }

      const payloadFingerprint = fingerprintActiveRevision(catalog, ideaId)
      if (!payloadFingerprint) {
        skipped.push({ ideaId, reason: 'active revision payload is missing' })
        continue
      }

      actions.push({
        kind: 'materialize-legacy-finalization',
        ideaId,
        expectedFeedback: feedback,
        targetRevisionKey: catalog.activeRevisionKey,
        expectedPayloadFingerprint: payloadFingerprint
      })
      continue
    }

    if (!asksToRevert) continue

    if (feedback.rating !== 'like') {
      skipped.push({
        ideaId,
        reason: `rating is ${feedback.rating ?? 'unreviewed'}, not like`
      })
      continue
    }

    if (feedback.locked) {
      skipped.push({ ideaId, reason: 'already finalized' })
      continue
    }

    const skipReason = getCommonSkipReason(catalog, ideaId)
    if (skipReason) {
      skipped.push({ ideaId, reason: skipReason })
      continue
    }

    const historyEntry = catalog.historyByIdeaId[ideaId]?.find(
      ({ revisionKey }) => revisionKey === previousRevisionKey
    )
    if (!historyEntry) {
      skipped.push({
        ideaId,
        reason: `previous revision ${previousRevisionKey} is missing`
      })
      continue
    }

    const expectedPayloadFingerprint =
      historyEntry.renderer === 1
        ? memeRevisionFingerprint({
            renderer: 1,
            idea: historyEntry.idea,
            image: historyEntry.image
          })
        : memeRevisionFingerprint({
            renderer: 2,
            idea: historyEntry.idea,
            assets: historyEntry.assets
          })

    actions.push({
      kind: 'finalize-reverted-version',
      ideaId,
      expectedFeedback: feedback,
      targetRevisionKey: previousRevisionKey,
      expectedPayloadFingerprint
    })
  }

  return {
    round: catalog.activeBatch,
    scannedFeedbackCount: Object.keys(state.feedback).length,
    revertNoteCount,
    actions,
    skipped
  }
}

export function migrationPatchFor(plan: MemeFinalizationMigrationPlan) {
  return {
    round: plan.round,
    ideaUpdates: plan.actions.map(
      ({
        ideaId,
        expectedFeedback,
        targetRevisionKey,
        expectedPayloadFingerprint
      }) => ({
        ideaId,
        feedback: {
          rating: expectedFeedback.rating,
          notes: expectedFeedback.notes,
          locked: true
        },
        expectedFeedback,
        targetRevisionKey,
        expectedPayloadFingerprint
      })
    ),
    scenarioUpdates: []
  } satisfies MemeReviewBatchPatch
}

async function run() {
  const apply = parseArguments(process.argv.slice(2))
  const catalog = await loadMemeReviewCatalog()
  const statePath = getMemeReviewStatePath(catalog.feedbackPath)
  const state = await readMemeReviewState(statePath, catalog.activeBatch)
  const plan = planMemeFinalizationMigration(catalog, state)

  printPlan(plan, apply)

  if (!apply || plan.actions.length === 0) return

  const response = await patchMemeFeedback(
    new Request('http://localhost/api/meme-feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(migrationPatchFor(plan))
    })
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Atomic migration was rejected (${response.status}): ${body}`
    )
  }

  const persisted = await readMemeReviewState(statePath, catalog.activeBatch)
  verifyAppliedPlan(plan, persisted)
  console.log(
    `\nApplied and verified ${plan.actions.length} finalization update${plan.actions.length === 1 ? '' : 's'} in one atomic batch.`
  )
}

function getCommonSkipReason(
  catalog: MemeReviewCatalog,
  ideaId: string
): string | null {
  if (!catalog.ideaIds.has(ideaId)) return 'idea is not in the active batch'
  if (!catalog.reviewableIdeaIds.has(ideaId)) {
    return 'idea is not ready for review'
  }
  return null
}

function fingerprintActiveRevision(
  catalog: MemeReviewCatalog,
  ideaId: string
): string | null {
  for (const source of catalog.sources) {
    for (const scenario of source.scenarios) {
      const idea = scenario.ideas.find(({ id }) => id === ideaId)
      if (idea) return memeFinalizationFingerprint(idea, scenario.assets)
    }
  }

  return null
}

function verifyAppliedPlan(
  plan: MemeFinalizationMigrationPlan,
  state: MemeReviewStateDocument
) {
  for (const action of plan.actions) {
    const persisted = state.feedback[action.ideaId]
    const expectedLockRevision =
      action.expectedFeedback.lockRevision +
      (action.expectedFeedback.locked ? 0 : 1)

    if (
      !persisted ||
      persisted.rating !== action.expectedFeedback.rating ||
      persisted.notes !== action.expectedFeedback.notes ||
      !persisted.locked ||
      persisted.lockRevision !== expectedLockRevision ||
      persisted.finalizedVersion?.revisionKey !== action.targetRevisionKey ||
      persisted.finalizedVersion.payloadFingerprint !==
        action.expectedPayloadFingerprint
    ) {
      throw new Error(`Post-migration verification failed for ${action.ideaId}`)
    }
  }
}

function printPlan(plan: MemeFinalizationMigrationPlan, apply: boolean) {
  const revertActions = plan.actions.filter(
    ({ kind }) => kind === 'finalize-reverted-version'
  )
  const legacyActions = plan.actions.filter(
    ({ kind }) => kind === 'materialize-legacy-finalization'
  )

  console.log(`Meme finalization migration ${apply ? '(APPLY)' : '(DRY RUN)'}`)
  console.log(
    `Batch ${plan.round}: scanned ${plan.scannedFeedbackCount} feedback entries and found ${plan.revertNoteCount} notes containing the word "revert".`
  )
  printActionGroup(
    `Finalize previous ${previousRevisionKey} version`,
    revertActions
  )
  printActionGroup('Materialize legacy active-version locks', legacyActions)

  console.log(`Skipped candidates (${plan.skipped.length})`)
  for (const { ideaId, reason } of plan.skipped) {
    console.log(`  - ${ideaId}: ${reason}`)
  }
  if (plan.skipped.length === 0) console.log('  - none')

  console.log(
    `Summary: ${revertActions.length} previous-version finalizations + ${legacyActions.length} legacy lock materializations = ${plan.actions.length} atomic updates; ${plan.skipped.length} skipped.`
  )

  if (!apply) {
    console.log(
      'Dry run only: no files changed. Re-run with --apply to commit this exact plan with feedback and payload compare-and-set checks.'
    )
  }
}

function printActionGroup(
  label: string,
  actions: readonly MemeFinalizationMigrationAction[]
) {
  console.log(`${label} (${actions.length})`)
  for (const action of actions) {
    console.log(`  - ${action.ideaId} -> ${action.targetRevisionKey}`)
  }
  if (actions.length === 0) console.log('  - none')
}

function parseArguments(arguments_: readonly string[]) {
  const unknown = arguments_.filter(
    (argument) => argument !== '--apply' && argument !== '--help'
  )
  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`
    )
  }

  if (arguments_.includes('--help')) {
    console.log(
      'Usage: pnpm memes:finalize-reverts [--apply]\n\nThe default is a read-only dry run.'
    )
    process.exit(0)
  }

  return arguments_.includes('--apply')
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await run()
}
