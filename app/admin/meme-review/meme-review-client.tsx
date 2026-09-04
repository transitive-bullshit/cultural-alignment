'use client'

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import Link from 'next/link'
import {
  AlertCircleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CircleSlash2Icon,
  HistoryIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  LockOpenIcon,
  MinusIcon,
  RefreshCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  MemeReviewScenario,
  MemeReviewSource
} from '@/lib/meme-review/catalog'
import type {
  MemePreviewHistory,
  MemePreviewHistoryEntry
} from '@/lib/meme-review/history'
import { memeRevisionFingerprint } from '@/lib/meme-review/fingerprint'
import type {
  MemeFeedbackDocument,
  MemeFeedbackEntry,
  MemeIdea,
  MemeRating,
  MemeReviewBatchStatus,
  MemeReviewScenarioState
} from '@/lib/meme-review/schema'
import {
  filterMemeIdeasByFinalizationState,
  filterMemeIdeasByReviewState,
  prioritizeFinalizedMemeIdeas,
  type MemeFinalizationFilter,
  type MemeReviewFilter
} from '@/lib/meme-review/review-queue'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'

import { MemePreview } from './meme-preview'
import styles from './meme-review.module.css'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const emptyFeedback: MemeFeedbackEntry = {
  rating: null,
  notes: '',
  locked: false,
  lockRevision: 0
}

type ScenarioStateFilter = 'all' | 'enabled' | 'disabled'
type ReadinessFilter = 'all' | 'ready' | 'wip'
type MemeReviewFilterPreferences = {
  readonly review: MemeReviewFilter
  readonly approval: MemeFinalizationFilter
  readonly scenario: ScenarioStateFilter
  readonly readiness: ReadinessFilter
}

const filterPreferencesStorageKey = 'meme-review:filters:v1'
const defaultFilterPreferences: MemeReviewFilterPreferences = {
  review: 'all',
  approval: 'all',
  scenario: 'enabled',
  readiness: 'all'
}

const reviewFilters: readonly {
  value: MemeReviewFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'reviewed', label: 'Reviewed' }
]

const finalizationFilters: readonly {
  value: MemeFinalizationFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'candidates', label: 'Candidates' }
]

const scenarioStateFilters: readonly {
  value: ScenarioStateFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' }
]

const readinessFilters: readonly {
  value: ReadinessFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready only' },
  { value: 'wip', label: 'WIP' }
]

function parseFilterPreferences(
  value: unknown
): MemeReviewFilterPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const candidate = value as Record<string, unknown>
  if (
    !reviewFilters.some(({ value }) => value === candidate.review) ||
    !finalizationFilters.some(({ value }) => value === candidate.approval) ||
    !scenarioStateFilters.some(({ value }) => value === candidate.scenario) ||
    !readinessFilters.some(({ value }) => value === candidate.readiness)
  ) {
    return null
  }

  return {
    review: candidate.review as MemeReviewFilter,
    approval: candidate.approval as MemeFinalizationFilter,
    scenario: candidate.scenario as ScenarioStateFilter,
    readiness: candidate.readiness as ReadinessFilter
  }
}

export function MemeReviewClient({
  sources,
  activeBatch,
  activeRevisionKey,
  activeRevisionLabel,
  batchStatus,
  initialState,
  historyByIdeaId
}: {
  readonly sources: readonly MemeReviewSource[]
  readonly activeBatch: number
  readonly activeRevisionKey: string
  readonly activeRevisionLabel: string
  readonly batchStatus: MemeReviewBatchStatus
  readonly initialState: MemeFeedbackDocument
  readonly historyByIdeaId: MemePreviewHistory
}) {
  const [feedback, setFeedback] = useState(initialState.feedback)
  const [scenarioStates, setScenarioStates] = useState(initialState.scenarios)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filterPreferences, setFilterPreferences] = useLocalStorageState({
    key: filterPreferencesStorageKey,
    defaultValue: defaultFilterPreferences,
    parse: parseFilterPreferences
  })
  const {
    review: reviewFilter,
    approval: finalizationFilter,
    scenario: scenarioStateFilter,
    readiness: readinessFilter
  } = filterPreferences
  const [saveState, setSaveState] = useState<SaveState>(
    initialState.updatedAt ? 'saved' : 'idle'
  )
  const [savedAt, setSavedAt] = useState(initialState.updatedAt)
  const [retryVersion, setRetryVersion] = useState(0)
  const [finalizationsInFlight, setFinalizationsInFlight] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [reloadRequired, setReloadRequired] = useState(false)
  const feedbackRef = useRef(initialState.feedback)
  const persistedFeedbackRef = useRef(initialState.feedback)
  const scenarioStatesRef = useRef(initialState.scenarios)
  const pendingIdeaIds = useRef(new Set<string>())
  const pendingScenarioSlugs = useRef(new Set<string>())
  const unsettledIdeaIds = useRef(new Set<string>())
  const unsettledScenarioSlugs = useRef(new Set<string>())
  const saveQueue = useRef(Promise.resolve())
  const queuedBatchCount = useRef(0)
  const saveFailed = useRef(false)
  const reloadRequiredRef = useRef(false)
  const reviewableScenarioSlugs = useMemo(() => {
    if (batchStatus.status === 'ready') {
      return new Set(
        sources.flatMap(({ scenarios }) => scenarios.map(({ slug }) => slug))
      )
    }

    return new Set(batchStatus.reviewable_scenarios)
  }, [batchStatus.reviewable_scenarios, batchStatus.status, sources])

  const updateFeedback = useCallback(
    (ideaId: string, update: Partial<MemeFeedbackEntry>) => {
      if (reloadRequiredRef.current) {
        setSaveState('error')
        return
      }

      const current = feedbackRef.current
      const previousEntry = current[ideaId] ?? emptyFeedback
      const nextEntry = { ...previousEntry, ...update }

      if (
        previousEntry.rating === nextEntry.rating &&
        previousEntry.notes === nextEntry.notes &&
        previousEntry.locked === nextEntry.locked
      ) {
        return
      }

      saveFailed.current = false
      const nextFeedback = { ...current, [ideaId]: nextEntry }
      feedbackRef.current = nextFeedback
      pendingIdeaIds.current.add(ideaId)
      unsettledIdeaIds.current.add(ideaId)
      setSaveState('dirty')
      setFeedback(nextFeedback)
    },
    []
  )

  const updateScenario = useCallback(
    (scenarioSlug: string, disabled: boolean) => {
      if (reloadRequiredRef.current) {
        setSaveState('error')
        return
      }

      const current = scenarioStatesRef.current
      const wasDisabled = current[scenarioSlug]?.disabled === true
      if (wasDisabled === disabled) return

      saveFailed.current = false
      const nextStates = { ...current }
      if (disabled) {
        nextStates[scenarioSlug] = { disabled: true }
      } else {
        delete nextStates[scenarioSlug]
      }

      scenarioStatesRef.current = nextStates
      pendingScenarioSlugs.current.add(scenarioSlug)
      unsettledScenarioSlugs.current.add(scenarioSlug)
      setSaveState('dirty')
      setScenarioStates(nextStates)
    },
    []
  )

  const updateFinalization = useCallback(
    (
      ideaId: string,
      locked: boolean,
      targetRevisionKey: string,
      expectedPayloadFingerprint: string
    ) => {
      if (reloadRequiredRef.current) {
        setSaveState('error')
        return
      }

      const current = feedbackRef.current
      const previousEntry = current[ideaId] ?? emptyFeedback

      if (
        previousEntry.locked === locked ||
        (locked && previousEntry.rating !== 'like')
      ) {
        return
      }

      saveFailed.current = false
      const nextEntry = {
        ...previousEntry,
        locked,
        lockRevision: previousEntry.lockRevision + 1,
        ...(locked
          ? {
              finalizedVersion: {
                revisionKey: targetRevisionKey,
                payloadFingerprint: expectedPayloadFingerprint
              }
            }
          : { finalizedVersion: undefined })
      }
      const nextFeedback = { ...current, [ideaId]: nextEntry }
      feedbackRef.current = nextFeedback
      pendingIdeaIds.current.delete(ideaId)
      unsettledIdeaIds.current.delete(ideaId)
      queuedBatchCount.current += 1
      setFeedback(nextFeedback)
      setSaveState('saving')
      setFinalizationsInFlight((inFlight) => new Set(inFlight).add(ideaId))

      const operation = saveQueue.current.then(async () => {
        const expectedFeedback =
          persistedFeedbackRef.current[ideaId] ?? emptyFeedback
        const response = await fetch('/api/meme-feedback', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            round: activeBatch,
            ideaUpdates: [
              {
                ideaId,
                feedback: {
                  rating: nextEntry.rating,
                  notes: nextEntry.notes,
                  locked
                },
                expectedFeedback,
                targetRevisionKey,
                expectedPayloadFingerprint
              }
            ]
          }),
          keepalive: true
        })

        if (!response.ok) {
          throw new Error(`Finalization save failed with ${response.status}`)
        }

        const result = (await response.json()) as MemeReviewPatchResponse
        const savedEntry = result.feedback[ideaId]
        if (!savedEntry) {
          throw new Error(`Finalization response omitted ${ideaId}`)
        }
        persistedFeedbackRef.current = {
          ...persistedFeedbackRef.current,
          [ideaId]: savedEntry
        }
        const latest = feedbackRef.current
        if (
          latest[ideaId]?.rating === nextEntry.rating &&
          latest[ideaId]?.notes === nextEntry.notes &&
          latest[ideaId]?.locked === locked
        ) {
          const reconciled = { ...latest, [ideaId]: savedEntry }
          feedbackRef.current = reconciled
          setFeedback(reconciled)
        }
        pendingIdeaIds.current.delete(ideaId)
        unsettledIdeaIds.current.delete(ideaId)
        setSavedAt(result.updatedAt)
      })

      saveQueue.current = operation.then(
        () => {
          queuedBatchCount.current -= 1
          if (
            pendingIdeaIds.current.size === 0 &&
            pendingScenarioSlugs.current.size === 0
          ) {
            saveFailed.current = false
          }
          if (
            !saveFailed.current &&
            queuedBatchCount.current === 0 &&
            pendingIdeaIds.current.size === 0 &&
            pendingScenarioSlugs.current.size === 0
          ) {
            setSaveState('saved')
          }
        },
        () => {
          saveFailed.current = true
          reloadRequiredRef.current = true
          setReloadRequired(true)
          queuedBatchCount.current -= 1
          const latest = feedbackRef.current
          if (latest[ideaId]?.locked === locked) {
            const restored = { ...latest, [ideaId]: previousEntry }
            feedbackRef.current = restored
            setFeedback(restored)
          }
          pendingIdeaIds.current.add(ideaId)
          unsettledIdeaIds.current.add(ideaId)
          setSaveState('error')
        }
      )

      void saveQueue.current.finally(() => {
        setFinalizationsInFlight((inFlight) => {
          const next = new Set(inFlight)
          next.delete(ideaId)
          return next
        })
      })
    },
    [activeBatch]
  )

  const flushPendingFeedback = useCallback(() => {
    const ideaIds = [...unsettledIdeaIds.current]
    const scenarioSlugs = [...unsettledScenarioSlugs.current]
    if (ideaIds.length === 0 && scenarioSlugs.length === 0) return

    for (const body of createKeepaliveReviewPatches({
      round: activeBatch,
      ideaIds,
      scenarioSlugs,
      feedback: feedbackRef.current,
      scenarioStates: scenarioStatesRef.current
    })) {
      void fetch('/api/meme-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      }).catch(() => undefined)
    }
  }, [activeBatch])

  useEffect(() => {
    window.addEventListener('pagehide', flushPendingFeedback)

    return () => {
      window.removeEventListener('pagehide', flushPendingFeedback)
      flushPendingFeedback()
    }
  }, [flushPendingFeedback])

  useEffect(() => {
    if (saveState === 'error') return

    if (
      pendingIdeaIds.current.size === 0 &&
      pendingScenarioSlugs.current.size === 0
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      const ideaIds = [...pendingIdeaIds.current]
      const scenarioSlugs = [...pendingScenarioSlugs.current]
      const body = createReviewPatch({
        round: activeBatch,
        ideaIds,
        scenarioSlugs,
        feedback: feedbackRef.current,
        scenarioStates: scenarioStatesRef.current
      })

      ideaIds.forEach((ideaId) => pendingIdeaIds.current.delete(ideaId))
      scenarioSlugs.forEach((scenarioSlug) =>
        pendingScenarioSlugs.current.delete(scenarioSlug)
      )
      queuedBatchCount.current += 1
      setSaveState('saving')

      saveQueue.current = saveQueue.current
        .then(async () => {
          const currentBody = currentReviewPatch({
            body,
            feedback: feedbackRef.current,
            scenarioStates: scenarioStatesRef.current,
            unsettledIdeaIds: unsettledIdeaIds.current,
            unsettledScenarioSlugs: unsettledScenarioSlugs.current
          })
          if (!currentBody) return

          const response = await fetch('/api/meme-feedback', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentBody),
            keepalive: true
          })

          if (!response.ok) {
            throw new Error(`Feedback save failed with ${response.status}`)
          }

          const result = (await response.json()) as MemeReviewPatchResponse
          recordPersistedIdeaUpdates(
            persistedFeedbackRef,
            currentBody.ideaUpdates,
            result.feedback
          )
          clearSettledReviewUpdates({
            body: currentBody,
            feedback: feedbackRef.current,
            scenarioStates: scenarioStatesRef.current,
            unsettledIdeaIds: unsettledIdeaIds.current,
            unsettledScenarioSlugs: unsettledScenarioSlugs.current
          })
          setSavedAt(result.updatedAt)
        })
        .then(
          () => {
            queuedBatchCount.current -= 1
            if (
              !saveFailed.current &&
              queuedBatchCount.current === 0 &&
              pendingIdeaIds.current.size === 0 &&
              pendingScenarioSlugs.current.size === 0
            ) {
              setSaveState('saved')
            }
          },
          () => {
            saveFailed.current = true
            queuedBatchCount.current -= 1
            ideaIds.forEach((ideaId) => pendingIdeaIds.current.add(ideaId))
            scenarioSlugs.forEach((scenarioSlug) =>
              pendingScenarioSlugs.current.add(scenarioSlug)
            )
            setSaveState('error')
          }
        )
    }, 650)

    return () => window.clearTimeout(timer)
  }, [activeBatch, feedback, retryVersion, saveState, scenarioStates])

  const retrySave = useCallback(() => {
    if (reloadRequiredRef.current) {
      window.location.reload()
      return
    }

    saveFailed.current = false

    if (
      pendingIdeaIds.current.size === 0 &&
      pendingScenarioSlugs.current.size === 0
    ) {
      setSaveState(queuedBatchCount.current > 0 ? 'saving' : 'saved')
      return
    }

    setSaveState('dirty')
    setRetryVersion((current) => current + 1)
  }, [])

  const totals = useMemo(
    () => getReviewTotals(sources, feedback, scenarioStates),
    [feedback, scenarioStates, sources]
  )
  const wipScenarioCount = Math.max(
    0,
    totals.scenarios - reviewableScenarioSlugs.size
  )
  const visibleSources = useMemo(
    () =>
      filterSources(
        sources,
        feedback,
        deferredQuery,
        reviewFilter,
        finalizationFilter,
        scenarioStateFilter,
        readinessFilter,
        reviewableScenarioSlugs,
        scenarioStates
      ),
    [
      deferredQuery,
      feedback,
      finalizationFilter,
      readinessFilter,
      reviewFilter,
      reviewableScenarioSlugs,
      scenarioStateFilter,
      scenarioStates,
      sources
    ]
  )
  const visibleIdeaCount = useMemo(
    () => countExpandedIdeas(visibleSources, scenarioStates),
    [scenarioStates, visibleSources]
  )
  const orderedSources = useMemo(
    () => prioritizeFinalizedMemeIdeas(visibleSources, feedback),
    [feedback, visibleSources]
  )

  return (
    <div
      className={`experience-scope ${styles.root}`}
      data-site-footer='hidden'
      data-meme-review
      data-review-status={batchStatus.status}
    >
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            Internal taste-capture tool · batch {activeBatch} · unlisted
          </p>
          <h1>Meme review lab</h1>
          <p>
            A growing review queue with deliberate framing and immutable history
            for every surviving direction. Pick a reaction, add what made you
            flinch or grin, and move fast.
          </p>
        </div>

        <div className={styles.progressPanel} aria-label='Review progress'>
          <div>
            <span>Reviewed</span>
            <strong>
              {totals.reviewed} / {totals.total}
            </strong>
          </div>
          <div
            className={styles.progressTrack}
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={totals.total}
            aria-valuenow={totals.reviewed}
          >
            <span
              style={{
                transform: `scaleX(${totals.total ? totals.reviewed / totals.total : 0})`
              }}
            />
          </div>
          <p>
            {sources.length} sources · {totals.scenarios} scenarios ·{' '}
            {totals.finalized} finalized · {totals.liked} likes ·{' '}
            {totals.disabled} disabled
          </p>
        </div>
      </header>

      {batchStatus.status === 'generating' ? (
        <aside className={styles.readinessNotice} role='status'>
          <AlertCircleIcon aria-hidden='true' />
          <div>
            <strong>
              {reviewableScenarioSlugs.size
                ? `PARTIAL BATCH — ${reviewableScenarioSlugs.size} SCENARIOS READY · ${wipScenarioCount} WIP`
                : `GENERATION IN PROGRESS — ${wipScenarioCount} WIP`}
            </strong>
            <p>{batchStatus.message}</p>
          </div>
        </aside>
      ) : (
        <aside className={styles.readyNotice} role='status'>
          <CheckIcon aria-hidden='true' />
          <div>
            <strong>READY FOR REVIEW</strong>
            <p>{batchStatus.message}</p>
          </div>
        </aside>
      )}

      <section className={styles.toolbar} aria-label='Review controls'>
        <FieldGroup className={styles.toolbarFields}>
          <Field className={styles.searchField}>
            <FieldLabel htmlFor='meme-review-search' className='sr-only'>
              Filter meme ideas
            </FieldLabel>
            <Input
              id='meme-review-search'
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Filter by source, scenario, concept, or caption…'
              autoComplete='off'
            />
          </Field>

          <FieldSet className={styles.filterField}>
            <FieldLegend variant='label' className={styles.filterLegend}>
              Review
            </FieldLegend>
            <ToggleGroup
              type='single'
              value={reviewFilter}
              onValueChange={(value) => {
                if (value) {
                  setFilterPreferences((current) => ({
                    ...current,
                    review: value as MemeReviewFilter
                  }))
                }
              }}
              variant='outline'
              size='sm'
              aria-label='Filter by review state'
            >
              {reviewFilters.map(({ value, label }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  data-review-filter={value}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>

          <FieldSet className={styles.filterField}>
            <FieldLegend variant='label' className={styles.filterLegend}>
              Approval
            </FieldLegend>
            <ToggleGroup
              type='single'
              value={finalizationFilter}
              onValueChange={(value) => {
                if (value) {
                  setFilterPreferences((current) => ({
                    ...current,
                    approval: value as MemeFinalizationFilter
                  }))
                }
              }}
              variant='outline'
              size='sm'
              aria-label='Filter by finalization state'
            >
              {finalizationFilters.map(({ value, label }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  data-finalization-filter={value}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>

          <FieldSet className={styles.filterField}>
            <FieldLegend variant='label' className={styles.filterLegend}>
              Scenario
            </FieldLegend>
            <ToggleGroup
              type='single'
              value={scenarioStateFilter}
              onValueChange={(value) => {
                if (value) {
                  setFilterPreferences((current) => ({
                    ...current,
                    scenario: value as ScenarioStateFilter
                  }))
                }
              }}
              variant='outline'
              size='sm'
              aria-label='Filter by enabled or disabled scenario state'
            >
              {scenarioStateFilters.map(({ value, label }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  data-scenario-state-filter={value}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>

          <FieldSet className={styles.filterField}>
            <FieldLegend variant='label' className={styles.filterLegend}>
              Readiness
            </FieldLegend>
            <ToggleGroup
              type='single'
              value={readinessFilter}
              onValueChange={(value) => {
                if (value) {
                  setFilterPreferences((current) => ({
                    ...current,
                    readiness: value as ReadinessFilter
                  }))
                }
              }}
              variant='outline'
              size='sm'
              aria-label='Filter by ready or work-in-progress scenario state'
            >
              {readinessFilters.map(({ value, label }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  data-readiness-filter={value}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
        </FieldGroup>

        <div className={styles.toolbarStatus}>
          <span aria-live='polite'>
            {visibleIdeaCount} {visibleIdeaCount === 1 ? 'idea' : 'ideas'} shown
          </span>
          <SaveStatus
            state={saveState}
            savedAt={savedAt}
            reloadRequired={reloadRequired}
            onRetry={retrySave}
          />
        </div>
      </section>

      <main className={styles.queue} data-review-queue='unified'>
        {orderedSources.map((source, sourceIndex) => (
          <section
            key={source.slug}
            id={`source-${source.slug}`}
            className={styles.sourceSection}
            data-meme-source={source.slug}
          >
            <header className={styles.sourceHeader}>
              <span>{String(sourceIndex + 1).padStart(3, '0')}</span>
              <h2>{source.title}</h2>
              <span>
                {source.scenarios.length}{' '}
                {source.scenarios.length === 1 ? 'scenario' : 'scenarios'}
              </span>
            </header>

            <div className={styles.scenarioStack}>
              {source.scenarios.map((scenario) => (
                <ScenarioReview
                  key={scenario.slug}
                  scenario={scenario}
                  feedback={feedback}
                  scenarioState={scenarioStates[scenario.slug]}
                  historyByIdeaId={historyByIdeaId}
                  activeBatch={activeBatch}
                  activeRevisionKey={activeRevisionKey}
                  activeRevisionLabel={activeRevisionLabel}
                  reviewLocked={
                    batchStatus.status !== 'ready' &&
                    !reviewableScenarioSlugs.has(scenario.slug)
                  }
                  finalizationsInFlight={finalizationsInFlight}
                  onFeedbackChange={updateFeedback}
                  onFinalizationChange={updateFinalization}
                  onScenarioChange={updateScenario}
                />
              ))}
            </div>
          </section>
        ))}

        {orderedSources.length === 0 ? (
          <p className={styles.noResults} role='status'>
            No ideas match this filter.
          </p>
        ) : null}
      </main>
    </div>
  )
}

const ScenarioReview = memo(function ScenarioReview({
  scenario,
  feedback,
  scenarioState,
  historyByIdeaId,
  activeBatch,
  activeRevisionKey,
  activeRevisionLabel,
  reviewLocked,
  finalizationsInFlight,
  onFeedbackChange,
  onFinalizationChange,
  onScenarioChange
}: {
  readonly scenario: MemeReviewScenario
  readonly feedback: MemeFeedbackDocument['feedback']
  readonly scenarioState: MemeReviewScenarioState | undefined
  readonly historyByIdeaId: MemePreviewHistory
  readonly activeBatch: number
  readonly activeRevisionKey: string
  readonly activeRevisionLabel: string
  readonly reviewLocked: boolean
  readonly finalizationsInFlight: ReadonlySet<string>
  readonly onFeedbackChange: (
    ideaId: string,
    update: Partial<MemeFeedbackEntry>
  ) => void
  readonly onFinalizationChange: (
    ideaId: string,
    locked: boolean,
    targetRevisionKey: string,
    expectedPayloadFingerprint: string
  ) => void
  readonly onScenarioChange: (scenarioSlug: string, disabled: boolean) => void
}) {
  const disabled = scenarioState?.disabled === true

  return (
    <article
      id={`scenario-${scenario.slug}`}
      className={styles.scenario}
      data-meme-scenario={scenario.slug}
      data-scenario-disabled={disabled ? 'true' : 'false'}
      data-scenario-review-state={reviewLocked ? 'wip' : 'reviewable'}
    >
      <header className={styles.scenarioHeader}>
        <div>
          <p>{scenario.episodeLabel ?? 'Scenario'}</p>
          <h3>{scenario.title}</h3>
        </div>
        <div className={styles.scenarioActions}>
          <Toggle
            pressed={disabled}
            onPressedChange={(pressed) =>
              onScenarioChange(scenario.slug, pressed)
            }
            variant='outline'
            size='sm'
            aria-label={
              disabled
                ? `Re-enable ${scenario.title} for future meme batches`
                : `Disable ${scenario.title} for future meme batches`
            }
            data-disable-scenario
            disabled={reviewLocked}
          >
            <CircleSlash2Icon data-icon='inline-start' />
            {disabled ? 'Re-enable scenario' : 'Disable scenario'}
          </Toggle>
          <Button asChild variant='ghost' size='sm'>
            <Link href={scenario.href}>
              Open dossier
              <ArrowUpRightIcon data-icon='inline-end' />
            </Link>
          </Button>
        </div>
      </header>

      {disabled ? (
        <p
          className={styles.scenarioDisabledNotice}
          role='status'
          data-scenario-collapsed
        >
          Scenario disabled — meme ideas hidden; saved feedback preserved.
        </p>
      ) : (
        <>
          {reviewLocked ? (
            <div className={styles.scenarioWipNotice} role='status'>
              <AlertCircleIcon aria-hidden='true' />
              <strong>WIP — DON’T REVIEW THIS SCENARIO YET</strong>
              <span>
                Its ideas or visual composition are still being checked.
              </span>
            </div>
          ) : null}

          <div className={styles.ideaGrid} role='list'>
            {scenario.ideas.map((idea) => (
              <MemeIdeaCard
                key={idea.id}
                idea={idea}
                assets={scenario.assets}
                history={historyByIdeaId[idea.id]}
                activeBatch={activeBatch}
                activeRevisionKey={activeRevisionKey}
                activeRevisionLabel={activeRevisionLabel}
                reviewLocked={reviewLocked}
                finalizationInFlight={finalizationsInFlight.has(idea.id)}
                feedback={feedback[idea.id] ?? emptyFeedback}
                onFeedbackChange={onFeedbackChange}
                onFinalizationChange={onFinalizationChange}
              />
            ))}
          </div>
        </>
      )}
    </article>
  )
})

const MemeIdeaCard = memo(function MemeIdeaCard({
  idea,
  assets,
  history,
  activeBatch,
  activeRevisionKey,
  activeRevisionLabel,
  reviewLocked,
  finalizationInFlight,
  feedback,
  onFeedbackChange,
  onFinalizationChange
}: {
  readonly idea: MemeIdea
  readonly assets: MemeReviewScenario['assets']
  readonly history: readonly MemePreviewHistoryEntry[] | undefined
  readonly activeBatch: number
  readonly activeRevisionKey: string
  readonly activeRevisionLabel: string
  readonly reviewLocked: boolean
  readonly finalizationInFlight: boolean
  readonly feedback: MemeFeedbackEntry
  readonly onFeedbackChange: (
    ideaId: string,
    update: Partial<MemeFeedbackEntry>
  ) => void
  readonly onFinalizationChange: (
    ideaId: string,
    locked: boolean,
    targetRevisionKey: string,
    expectedPayloadFingerprint: string
  ) => void
}) {
  const revisionOptions = useMemo(
    () => [
      ...(history ?? []).map(({ revisionKey, label }) => ({
        revisionKey,
        label
      })),
      {
        revisionKey: activeRevisionKey,
        label: activeRevisionLabel
      }
    ],
    [activeRevisionKey, activeRevisionLabel, history]
  )
  const [displayedRevisionKey, setDisplayedRevisionKey] = useState(() => {
    const preferredRevisionKey = feedback.locked
      ? feedback.finalizedVersion?.revisionKey
      : undefined

    return preferredRevisionKey &&
      revisionOptions.some(
        ({ revisionKey }) => revisionKey === preferredRevisionKey
      )
      ? preferredRevisionKey
      : activeRevisionKey
  })
  const archived = history?.find(
    ({ revisionKey }) => revisionKey === displayedRevisionKey
  )
  const displayedIdea = archived?.idea ?? idea
  const displayedRevisionLabel = archived?.label ?? activeRevisionLabel
  const finalized = feedback.locked === true
  const finalizedRevisionKey = finalized
    ? (feedback.finalizedVersion?.revisionKey ?? activeRevisionKey)
    : null
  const finalizedRevisionLabel =
    revisionOptions.find(
      ({ revisionKey }) => revisionKey === finalizedRevisionKey
    )?.label ??
    finalizedRevisionKey ??
    activeRevisionLabel
  const isViewingFinalizedVersion =
    finalized && displayedRevisionKey === finalizedRevisionKey
  const finalizedVersionAvailable =
    finalizedRevisionKey === null ||
    revisionOptions.some(
      ({ revisionKey }) => revisionKey === finalizedRevisionKey
    )
  const activePayloadFingerprint = useMemo(
    () => memeRevisionFingerprint({ renderer: 2, idea, assets }),
    [assets, idea]
  )
  const displayedPayloadFingerprint = useMemo(
    () =>
      archived?.renderer === 1
        ? memeRevisionFingerprint({
            renderer: 1,
            idea: archived.idea,
            image: archived.image
          })
        : archived?.renderer === 2
          ? memeRevisionFingerprint({
              renderer: 2,
              idea: archived.idea,
              assets: archived.assets
            })
          : activePayloadFingerprint,
    [activePayloadFingerprint, archived]
  )
  const finalizationTargetRevisionKey = finalized
    ? (finalizedRevisionKey ?? activeRevisionKey)
    : displayedRevisionKey
  const finalizationTargetFingerprint = finalized
    ? (feedback.finalizedVersion?.payloadFingerprint ??
      activePayloadFingerprint)
    : displayedPayloadFingerprint
  const finalizationTargetLabel = finalized
    ? finalizedRevisionLabel
    : displayedRevisionLabel
  const finalizeDisabled =
    finalizationInFlight ||
    reviewLocked ||
    !finalizedVersionAvailable ||
    (!finalized && feedback.rating !== 'like')
  const noteId = `${idea.id}-notes`
  const criticBadgeVariant =
    idea.critic.predicted_rating === 'dislike'
      ? 'destructive'
      : idea.critic.predicted_rating === 'neutral'
        ? 'secondary'
        : 'default'
  const glanceScore = Object.values(idea.critic.glance_test).filter(
    Boolean
  ).length

  return (
    <article
      className={styles.ideaCard}
      role='listitem'
      data-meme-idea={idea.id}
      data-user-rating={feedback.rating ?? 'unreviewed'}
      data-meme-finalized={finalized ? 'true' : 'false'}
      data-viewing-current={archived ? 'false' : 'true'}
      data-viewing-finalized={isViewingFinalizedVersion ? 'true' : 'false'}
      data-displayed-revision={displayedRevisionKey}
      aria-busy={finalizationInFlight}
    >
      {isViewingFinalizedVersion ? (
        <div className={styles.finalizedBanner} data-finalized-status>
          <LockKeyholeIcon aria-hidden='true' />
          <div>
            <strong>Finalized · featured version</strong>
            <span>{finalizedRevisionLabel} is frozen for future passes</span>
          </div>
        </div>
      ) : null}

      <div
        className={styles.previewFrame}
        data-preview-finalized={isViewingFinalizedVersion ? 'true' : 'false'}
      >
        {archived?.renderer === 1 ? (
          <MemePreview
            mode='archived'
            idea={archived.idea}
            image={archived.image}
          />
        ) : archived?.renderer === 2 ? (
          <MemePreview
            mode='current'
            idea={archived.idea}
            assets={archived.assets}
          />
        ) : (
          <MemePreview mode='current' idea={idea} assets={assets} />
        )}
      </div>

      {history?.length ? (
        <div className={styles.versionBar} data-version-navigation>
          <span>
            <HistoryIcon aria-hidden='true' />
            Preview version
          </span>
          <ToggleGroup
            type='single'
            value={displayedRevisionKey}
            onValueChange={(value) => {
              if (value) setDisplayedRevisionKey(value)
            }}
            variant='outline'
            size='sm'
            aria-label='Choose meme preview version'
          >
            {revisionOptions.map(({ revisionKey, label }) => (
              <ToggleGroupItem
                key={revisionKey}
                value={revisionKey}
                data-finalized-revision={
                  revisionKey === finalizedRevisionKey ? 'true' : undefined
                }
              >
                {revisionKey === finalizedRevisionKey ? (
                  <LockKeyholeIcon
                    data-icon='inline-start'
                    aria-hidden='true'
                  />
                ) : null}
                {label}
                {revisionKey === finalizedRevisionKey ? (
                  <span className='sr-only'> — finalized featured version</span>
                ) : null}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {finalized && !isViewingFinalizedVersion ? (
            <div
              className={styles.finalizedScope}
              data-finalization-scope
              role='status'
            >
              <span>
                <LockKeyholeIcon aria-hidden='true' />
                {finalizedVersionAvailable
                  ? `${finalizedRevisionLabel} remains the finalized featured version.`
                  : `Finalized revision ${finalizedRevisionLabel} is unavailable in this preview.`}
              </span>
              {finalizedVersionAvailable ? (
                <Button
                  type='button'
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    setDisplayedRevisionKey(
                      finalizedRevisionKey ?? activeRevisionKey
                    )
                  }
                  data-view-finalized-version
                >
                  <LockKeyholeIcon
                    data-icon='inline-start'
                    aria-hidden='true'
                  />
                  View finalized
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.ideaBody}>
        <header className={styles.ideaMeta}>
          <Badge className={styles.conceptBadge}>
            {displayedIdea.ai_concept}
          </Badge>
          <Badge variant='outline' className={styles.formatBadge}>
            {displayedIdea.format}
          </Badge>
        </header>

        <div className={styles.ideaRationale}>
          <div>
            <span>Recognition hinge</span>
            <blockquote>{displayedIdea.source_anchor}</blockquote>
          </div>
          <div>
            <span>Why it might hit</span>
            <p>{displayedIdea.why_it_works}</p>
          </div>
          <details>
            <summary>Frame direction</summary>
            <p>{displayedIdea.frame_guidance}</p>
          </details>
        </div>

        {archived ? (
          <section
            className={styles.archivedFeedback}
            aria-label={`${archived.label} feedback`}
          >
            <header>
              <Badge>
                {archived.label} · {archived.feedback.rating ?? 'unreviewed'}
                {archived.feedback.locked ? ' · finalized' : ''}
              </Badge>
              <span>Immutable review</span>
            </header>
            <p>
              {archived.feedback.notes.trim() ||
                (archived.feedback.rating
                  ? 'Rated without an additional note.'
                  : 'No rating or additional note was recorded.')}
            </p>
          </section>
        ) : null}

        <FieldSet className={styles.currentDecision} data-current-decision>
          <FieldLegend>Current batch {activeBatch} decision</FieldLegend>
          <FieldDescription className={styles.currentDecisionDescription}>
            {finalized
              ? `${finalizedRevisionLabel} is read-only while finalized.`
              : archived
                ? `This live decision can finalize the ${displayedRevisionLabel} version; the archived review above stays unchanged.`
                : 'This live rating and note are autosaved for the current review batch.'}
          </FieldDescription>

          <FieldGroup className={styles.feedbackFields}>
            <Field className={styles.ratingField} orientation='horizontal'>
              <FieldTitle id={`${idea.id}-rating-label`}>Rating</FieldTitle>
              <ToggleGroup
                type='single'
                value={feedback.rating ?? ''}
                onValueChange={(value) =>
                  onFeedbackChange(idea.id, {
                    rating: value ? (value as MemeRating) : null
                  })
                }
                variant='outline'
                size='sm'
                aria-labelledby={`${idea.id}-rating-label`}
                className={styles.ratingGroup}
                data-feedback-rating
                disabled={reviewLocked || finalized || finalizationInFlight}
              >
                <ToggleGroupItem value='dislike' data-rating='dislike'>
                  <ThumbsDownIcon data-icon='inline-start' />
                  Dislike
                </ToggleGroupItem>
                <ToggleGroupItem value='neutral' data-rating='neutral'>
                  <MinusIcon data-icon='inline-start' />
                  Neutral
                </ToggleGroupItem>
                <ToggleGroupItem value='like' data-rating='like'>
                  <ThumbsUpIcon data-icon='inline-start' />
                  Like
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor={noteId}>Notes for the next pass</FieldLabel>
              <Textarea
                id={noteId}
                value={feedback.notes}
                onChange={(event) =>
                  onFeedbackChange(idea.id, { notes: event.target.value })
                }
                placeholder='Optional: sharper wording, wrong frame, too obvious, delightfully unhinged…'
                rows={3}
                maxLength={4000}
                data-feedback-notes
                disabled={reviewLocked || finalized || finalizationInFlight}
              />
            </Field>

            <Field
              className={styles.finalizeField}
              orientation='horizontal'
              data-disabled={finalizeDisabled}
            >
              <FieldContent>
                <FieldTitle id={`${idea.id}-finalized-label`}>
                  Final approval · {finalizationTargetLabel}
                </FieldTitle>
                <FieldDescription>
                  {!finalizedVersionAvailable
                    ? 'The finalized preview is unavailable. Reload before changing approval.'
                    : finalized
                      ? isViewingFinalizedVersion
                        ? 'This exact concept, copy, and layout are frozen until you unfinalize it.'
                        : `${finalizedRevisionLabel} stays frozen while you inspect this version.`
                      : feedback.rating === 'like'
                        ? `Freeze the exact ${displayedRevisionLabel} concept, copy, and layout.`
                        : `Like this idea before finalizing the ${displayedRevisionLabel} version.`}
                </FieldDescription>
              </FieldContent>
              <Toggle
                pressed={finalized}
                onPressedChange={(pressed) =>
                  onFinalizationChange(
                    idea.id,
                    pressed,
                    finalizationTargetRevisionKey,
                    finalizationTargetFingerprint
                  )
                }
                variant='outline'
                size='sm'
                aria-label={
                  finalized
                    ? `Finalized: ${finalizedRevisionLabel}. Activate to unfinalize.`
                    : `Finalize ${displayedRevisionLabel}`
                }
                title={
                  finalized
                    ? `Unfinalize ${finalizedRevisionLabel}`
                    : `Finalize ${displayedRevisionLabel}`
                }
                disabled={finalizeDisabled}
                data-finalized-toggle
              >
                {finalized ? (
                  <LockKeyholeIcon data-icon='inline-start' />
                ) : (
                  <LockOpenIcon data-icon='inline-start' />
                )}
                {finalized
                  ? 'Finalized'
                  : finalizationInFlight
                    ? 'Saving…'
                    : `Finalize ${displayedRevisionLabel}`}
              </Toggle>
            </Field>
          </FieldGroup>
        </FieldSet>

        {!archived ? (
          <details
            className={styles.critic}
            data-critic-verdict={idea.critic.verdict}
          >
            <summary>
              <span>Independent critic</span>
              <Badge variant='outline'>Reveal prediction</Badge>
            </summary>
            <div className={styles.criticBody}>
              <Badge variant={criticBadgeVariant}>
                predicts {idea.critic.predicted_rating} ·{' '}
                {Math.round(idea.critic.confidence * 100)}%
              </Badge>
              <p>{idea.critic.expected_feedback}</p>
              <p className={styles.criticScore}>
                Glance test {glanceScore}/4 · critic{' '}
                {idea.critic.verdict === 'revise' ? 'revised' : 'kept'}
              </p>
              <p className={styles.criticScores}>
                Hinge {idea.critic.scores.scene_hinge}/5 · payoff{' '}
                {idea.critic.scores.ai_payoff}/5 · parse{' '}
                {idea.critic.scores.parsing_ease}/5 · visual{' '}
                {idea.critic.scores.visual_proof}/5 · accuracy{' '}
                {idea.critic.scores.source_accuracy}/5
              </p>
              <p>
                <strong>Best:</strong> {idea.critic.strongest_quality}
              </p>
              <p>
                <strong>Risk:</strong> {idea.critic.main_risk}
              </p>
            </div>
          </details>
        ) : null}
      </div>
    </article>
  )
})

function SaveStatus({
  state,
  savedAt,
  reloadRequired,
  onRetry
}: {
  readonly state: SaveState
  readonly savedAt: string | null
  readonly reloadRequired: boolean
  readonly onRetry: () => void
}) {
  if (state === 'error') {
    return (
      <span role='status' aria-live='assertive'>
        <Button
          size='sm'
          variant='destructive'
          onClick={onRetry}
          data-save-state='error'
        >
          <RefreshCcwIcon data-icon='inline-start' />
          {reloadRequired ? 'Reload review state' : 'Retry save'}
        </Button>
      </span>
    )
  }

  return (
    <span
      className={styles.saveStatus}
      data-save-state={state}
      role='status'
      aria-live='polite'
    >
      {state === 'saving' ? (
        <LoaderCircleIcon aria-hidden='true' />
      ) : state === 'dirty' ? (
        <AlertCircleIcon aria-hidden='true' />
      ) : (
        <CheckIcon aria-hidden='true' />
      )}
      {state === 'saving'
        ? 'Saving…'
        : state === 'dirty'
          ? 'Unsaved changes'
          : savedAt
            ? 'Saved locally'
            : 'Ready'}
    </span>
  )
}

function getReviewTotals(
  sources: readonly MemeReviewSource[],
  feedback: MemeFeedbackDocument['feedback'],
  scenarioStates: MemeFeedbackDocument['scenarios']
) {
  let reviewed = 0
  let liked = 0
  let finalized = 0

  for (const source of sources) {
    for (const scenario of source.scenarios) {
      for (const idea of scenario.ideas) {
        const entry = feedback[idea.id]
        const rating = entry?.rating
        const locked = entry?.locked === true
        if (rating || locked) reviewed += 1
        if (rating === 'like') liked += 1
        if (locked) finalized += 1
      }
    }
  }

  return {
    total: countIdeas(sources),
    scenarios: sources.reduce(
      (total, source) => total + source.scenarios.length,
      0
    ),
    reviewed,
    liked,
    finalized,
    disabled: Object.keys(scenarioStates).length
  }
}

function createReviewPatch({
  round,
  ideaIds,
  scenarioSlugs,
  feedback,
  scenarioStates
}: {
  readonly round: number
  readonly ideaIds: readonly string[]
  readonly scenarioSlugs: readonly string[]
  readonly feedback: MemeFeedbackDocument['feedback']
  readonly scenarioStates: MemeFeedbackDocument['scenarios']
}) {
  return {
    round,
    ideaUpdates: ideaIds.map((ideaId) => ({
      ideaId,
      feedback: {
        rating: feedback[ideaId]?.rating ?? null,
        notes: feedback[ideaId]?.notes ?? ''
      }
    })),
    scenarioUpdates: scenarioSlugs.map((scenarioSlug) => ({
      scenarioSlug,
      disabled: scenarioStates[scenarioSlug]?.disabled === true
    }))
  }
}

type ReviewPatchBody = ReturnType<typeof createReviewPatch>
type MemeReviewPatchResponse = {
  readonly updatedAt: string
  readonly feedback: Readonly<Record<string, MemeFeedbackEntry>>
}

function createKeepaliveReviewPatches({
  round,
  ideaIds,
  scenarioSlugs,
  feedback,
  scenarioStates
}: {
  readonly round: number
  readonly ideaIds: readonly string[]
  readonly scenarioSlugs: readonly string[]
  readonly feedback: MemeFeedbackDocument['feedback']
  readonly scenarioStates: MemeFeedbackDocument['scenarios']
}) {
  const patches: ReviewPatchBody[] = []

  for (let index = 0; index < ideaIds.length; index += 2) {
    patches.push(
      createReviewPatch({
        round,
        ideaIds: ideaIds.slice(index, index + 2),
        scenarioSlugs: [],
        feedback,
        scenarioStates
      })
    )
  }

  for (let index = 0; index < scenarioSlugs.length; index += 100) {
    patches.push(
      createReviewPatch({
        round,
        ideaIds: [],
        scenarioSlugs: scenarioSlugs.slice(index, index + 100),
        feedback,
        scenarioStates
      })
    )
  }

  return patches
}

function recordPersistedIdeaUpdates(
  persistedFeedbackRef: {
    current: MemeFeedbackDocument['feedback']
  },
  ideaUpdates: ReviewPatchBody['ideaUpdates'],
  savedFeedback: Readonly<Record<string, MemeFeedbackEntry>>
) {
  const next = { ...persistedFeedbackRef.current }

  for (const { ideaId } of ideaUpdates) {
    const savedEntry = savedFeedback[ideaId]
    if (savedEntry) {
      next[ideaId] = savedEntry
    } else {
      delete next[ideaId]
    }
  }

  persistedFeedbackRef.current = next
}

function clearSettledReviewUpdates({
  body,
  feedback,
  scenarioStates,
  unsettledIdeaIds,
  unsettledScenarioSlugs
}: {
  readonly body: ReviewPatchBody
  readonly feedback: MemeFeedbackDocument['feedback']
  readonly scenarioStates: MemeFeedbackDocument['scenarios']
  readonly unsettledIdeaIds: Set<string>
  readonly unsettledScenarioSlugs: Set<string>
}) {
  for (const update of body.ideaUpdates) {
    const current = feedback[update.ideaId] ?? emptyFeedback
    if (
      current.rating === update.feedback.rating &&
      current.notes === update.feedback.notes
    ) {
      unsettledIdeaIds.delete(update.ideaId)
    }
  }

  for (const update of body.scenarioUpdates) {
    if (
      (scenarioStates[update.scenarioSlug]?.disabled === true) ===
      update.disabled
    ) {
      unsettledScenarioSlugs.delete(update.scenarioSlug)
    }
  }
}

function currentReviewPatch({
  body,
  feedback,
  scenarioStates,
  unsettledIdeaIds,
  unsettledScenarioSlugs
}: {
  readonly body: ReviewPatchBody
  readonly feedback: MemeFeedbackDocument['feedback']
  readonly scenarioStates: MemeFeedbackDocument['scenarios']
  readonly unsettledIdeaIds: ReadonlySet<string>
  readonly unsettledScenarioSlugs: ReadonlySet<string>
}) {
  const ideaUpdates = body.ideaUpdates.filter((update) => {
    const current = feedback[update.ideaId] ?? emptyFeedback
    return (
      unsettledIdeaIds.has(update.ideaId) &&
      current.rating === update.feedback.rating &&
      current.notes === update.feedback.notes
    )
  })
  const scenarioUpdates = body.scenarioUpdates.filter(
    (update) =>
      unsettledScenarioSlugs.has(update.scenarioSlug) &&
      (scenarioStates[update.scenarioSlug]?.disabled === true) ===
        update.disabled
  )

  if (ideaUpdates.length === 0 && scenarioUpdates.length === 0) return null

  return {
    ...body,
    ideaUpdates,
    scenarioUpdates
  }
}

function countIdeas(sources: readonly MemeReviewSource[]) {
  return sources.reduce(
    (sourceTotal, source) =>
      sourceTotal +
      source.scenarios.reduce(
        (scenarioTotal, scenario) => scenarioTotal + scenario.ideas.length,
        0
      ),
    0
  )
}

function countExpandedIdeas(
  sources: readonly MemeReviewSource[],
  scenarioStates: MemeFeedbackDocument['scenarios']
) {
  return sources.reduce(
    (sourceTotal, source) =>
      sourceTotal +
      source.scenarios.reduce(
        (scenarioTotal, scenario) =>
          scenarioTotal +
          (scenarioStates[scenario.slug]?.disabled === true
            ? 0
            : scenario.ideas.length),
        0
      ),
    0
  )
}

function filterSources(
  sources: readonly MemeReviewSource[],
  feedback: MemeFeedbackDocument['feedback'],
  rawQuery: string,
  reviewFilter: MemeReviewFilter,
  finalizationFilter: MemeFinalizationFilter,
  scenarioStateFilter: ScenarioStateFilter,
  readinessFilter: ReadinessFilter,
  reviewableScenarioSlugs: ReadonlySet<string>,
  scenarioStates: MemeFeedbackDocument['scenarios']
): readonly MemeReviewSource[] {
  const query = rawQuery.trim().toLocaleLowerCase()

  return sources.flatMap((source) => {
    const sourceMatches = source.title.toLocaleLowerCase().includes(query)
    const scenarios = source.scenarios.flatMap((scenario) => {
      const disabled = scenarioStates[scenario.slug]?.disabled === true
      if (
        (scenarioStateFilter === 'enabled' && disabled) ||
        (scenarioStateFilter === 'disabled' && !disabled)
      ) {
        return []
      }

      const ready = reviewableScenarioSlugs.has(scenario.slug)
      if (
        (readinessFilter === 'ready' && !ready) ||
        (readinessFilter === 'wip' && ready)
      ) {
        return []
      }

      const scenarioMatches =
        sourceMatches || scenario.title.toLocaleLowerCase().includes(query)
      const reviewStateIdeas = filterMemeIdeasByReviewState(
        scenario.ideas,
        feedback,
        reviewFilter
      )
      const finalizationStateIdeas = filterMemeIdeasByFinalizationState(
        reviewStateIdeas,
        feedback,
        finalizationFilter
      )
      const ideas = finalizationStateIdeas.filter((idea) => {
        const ideaMatches =
          !query ||
          scenarioMatches ||
          idea.ai_concept.toLocaleLowerCase().includes(query) ||
          idea.caption_lines.some((line) =>
            line.toLocaleLowerCase().includes(query)
          )

        return ideaMatches
      })

      return ideas.length ? [{ ...scenario, ideas }] : []
    })

    return scenarios.length ? [{ ...source, scenarios }] : []
  })
}
