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
  LoaderCircleIcon,
  MinusIcon,
  RefreshCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  MemeReviewScenario,
  MemeReviewSource
} from '@/lib/meme-review/catalog'
import type {
  MemeFeedbackDocument,
  MemeFeedbackEntry,
  MemeIdea,
  MemeRating
} from '@/lib/meme-review/schema'

import { MemePreview } from './meme-preview'
import styles from './meme-review.module.css'

type ReviewFilter = 'all' | 'unreviewed' | MemeRating
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const emptyFeedback: MemeFeedbackEntry = {
  rating: null,
  notes: ''
}

const reviewFilters: readonly {
  value: ReviewFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'like', label: 'Liked' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'dislike', label: 'Disliked' }
]

export function MemeReviewClient({
  sources,
  initialFeedback,
  initialSavedAt
}: {
  readonly sources: readonly MemeReviewSource[]
  readonly initialFeedback: MemeFeedbackDocument['feedback']
  readonly initialSavedAt: string | null
}) {
  const [feedback, setFeedback] = useState(initialFeedback)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [saveState, setSaveState] = useState<SaveState>(
    initialSavedAt ? 'saved' : 'idle'
  )
  const [savedAt, setSavedAt] = useState(initialSavedAt)
  const [retryVersion, setRetryVersion] = useState(0)
  const feedbackRef = useRef(initialFeedback)
  const pendingIdeaIds = useRef(new Set<string>())
  const saveQueue = useRef(Promise.resolve())
  const queuedBatchCount = useRef(0)

  const updateFeedback = useCallback(
    (ideaId: string, update: Partial<MemeFeedbackEntry>) => {
      const current = feedbackRef.current
      const previousEntry = current[ideaId] ?? emptyFeedback
      const nextEntry = { ...previousEntry, ...update }

      if (
        previousEntry.rating === nextEntry.rating &&
        previousEntry.notes === nextEntry.notes
      ) {
        return
      }

      const nextFeedback = { ...current, [ideaId]: nextEntry }
      feedbackRef.current = nextFeedback
      pendingIdeaIds.current.add(ideaId)
      setSaveState('dirty')
      setFeedback(nextFeedback)
    },
    []
  )

  useEffect(() => {
    if (pendingIdeaIds.current.size === 0) return

    const timer = window.setTimeout(() => {
      const ideaIds = [...pendingIdeaIds.current]
      const updates = ideaIds.map((ideaId) => ({
        ideaId,
        feedback: feedback[ideaId] ?? emptyFeedback
      }))

      ideaIds.forEach((ideaId) => pendingIdeaIds.current.delete(ideaId))
      queuedBatchCount.current += 1
      setSaveState('saving')

      saveQueue.current = saveQueue.current
        .then(async () => {
          const response = await fetch('/api/meme-feedback', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
            keepalive: true
          })

          if (!response.ok) {
            throw new Error(`Feedback save failed with ${response.status}`)
          }

          const result = (await response.json()) as {
            readonly updatedAt: string
          }
          setSavedAt(result.updatedAt)
        })
        .then(
          () => {
            queuedBatchCount.current -= 1
            if (
              queuedBatchCount.current === 0 &&
              pendingIdeaIds.current.size === 0
            ) {
              setSaveState('saved')
            }
          },
          () => {
            queuedBatchCount.current -= 1
            ideaIds.forEach((ideaId) => pendingIdeaIds.current.add(ideaId))
            setSaveState('error')
          }
        )
    }, 650)

    return () => window.clearTimeout(timer)
  }, [feedback, retryVersion])

  const totals = useMemo(
    () => getReviewTotals(sources, feedback),
    [feedback, sources]
  )
  const visibleSources = useMemo(
    () => filterSources(sources, feedback, deferredQuery, reviewFilter),
    [deferredQuery, feedback, reviewFilter, sources]
  )
  const visibleIdeaCount = useMemo(
    () => countIdeas(visibleSources),
    [visibleSources]
  )

  return (
    <div
      className={`experience-scope ${styles.root}`}
      data-site-footer='hidden'
      data-meme-review
    >
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            Internal taste-capture tool · unlisted
          </p>
          <h1>Meme review lab</h1>
          <p>
            HTML sketches for the featured scenario set. Pick a reaction, add
            whatever made you flinch or grin, and move fast—the rough edges are
            useful signal.
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
            {totals.liked} likes
          </p>
        </div>
      </header>

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
            <FieldLegend className='sr-only'>
              Filter by review state
            </FieldLegend>
            <ToggleGroup
              type='single'
              value={reviewFilter}
              onValueChange={(value) => {
                if (value) setReviewFilter(value as ReviewFilter)
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
        </FieldGroup>

        <div className={styles.toolbarStatus}>
          <span aria-live='polite'>
            {visibleIdeaCount} {visibleIdeaCount === 1 ? 'idea' : 'ideas'} shown
          </span>
          <SaveStatus
            state={saveState}
            savedAt={savedAt}
            onRetry={() => setRetryVersion((current) => current + 1)}
          />
        </div>
      </section>

      <main className={styles.queue}>
        {visibleSources.map((source, sourceIndex) => (
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
                  onFeedbackChange={updateFeedback}
                />
              ))}
            </div>
          </section>
        ))}

        {visibleIdeaCount === 0 ? (
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
  onFeedbackChange
}: {
  readonly scenario: MemeReviewScenario
  readonly feedback: MemeFeedbackDocument['feedback']
  readonly onFeedbackChange: (
    ideaId: string,
    update: Partial<MemeFeedbackEntry>
  ) => void
}) {
  return (
    <article
      id={`scenario-${scenario.slug}`}
      className={styles.scenario}
      data-meme-scenario={scenario.slug}
    >
      <header className={styles.scenarioHeader}>
        <div>
          <p>{scenario.episodeLabel ?? 'Featured scene'}</p>
          <h3>{scenario.title}</h3>
        </div>
        <Button asChild variant='ghost' size='sm'>
          <Link href={scenario.href}>
            Open dossier
            <ArrowUpRightIcon data-icon='inline-end' />
          </Link>
        </Button>
      </header>

      <div className={styles.ideaGrid} role='list'>
        {scenario.ideas.map((idea) => (
          <MemeIdeaCard
            key={idea.id}
            idea={idea}
            image={scenario.image}
            feedback={feedback[idea.id] ?? emptyFeedback}
            onFeedbackChange={onFeedbackChange}
          />
        ))}
      </div>
    </article>
  )
})

const MemeIdeaCard = memo(function MemeIdeaCard({
  idea,
  image,
  feedback,
  onFeedbackChange
}: {
  readonly idea: MemeIdea
  readonly image: MemeReviewScenario['image']
  readonly feedback: MemeFeedbackEntry
  readonly onFeedbackChange: (
    ideaId: string,
    update: Partial<MemeFeedbackEntry>
  ) => void
}) {
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
    >
      <MemePreview idea={idea} image={image} />

      <div className={styles.ideaBody}>
        <header className={styles.ideaMeta}>
          <Badge className={styles.conceptBadge}>{idea.ai_concept}</Badge>
          <Badge variant='outline' className={styles.formatBadge}>
            {idea.format}
          </Badge>
        </header>

        <div className={styles.ideaRationale}>
          <div>
            <span>Recognition hinge</span>
            <blockquote>{idea.source_anchor}</blockquote>
          </div>
          <div>
            <span>Why it might hit</span>
            <p>{idea.why_it_works}</p>
          </div>
          <details>
            <summary>Frame direction</summary>
            <p>{idea.frame_guidance}</p>
            {idea.preview.alternate_image_query ? (
              <p>
                <strong>Search brief:</strong>{' '}
                {idea.preview.alternate_image_query}
              </p>
            ) : null}
          </details>
        </div>

        <FieldGroup className={styles.feedbackFields}>
          <Field className={styles.ratingField} orientation='horizontal'>
            <FieldTitle id={`${idea.id}-rating-label`}>Your take</FieldTitle>
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
            />
          </Field>
        </FieldGroup>

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
              Glance test {glanceScore}/4 · {idea.critic.verdict}
            </p>
            <p>
              <strong>Best:</strong> {idea.critic.strongest_quality}
            </p>
            <p>
              <strong>Risk:</strong> {idea.critic.main_risk}
            </p>
          </div>
        </details>
      </div>
    </article>
  )
})

function SaveStatus({
  state,
  savedAt,
  onRetry
}: {
  readonly state: SaveState
  readonly savedAt: string | null
  readonly onRetry: () => void
}) {
  if (state === 'error') {
    return (
      <Button size='sm' variant='destructive' onClick={onRetry} data-save-state>
        <RefreshCcwIcon data-icon='inline-start' />
        Retry save
      </Button>
    )
  }

  return (
    <span className={styles.saveStatus} data-save-state={state}>
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
  feedback: MemeFeedbackDocument['feedback']
) {
  let reviewed = 0
  let liked = 0

  for (const source of sources) {
    for (const scenario of source.scenarios) {
      for (const idea of scenario.ideas) {
        const rating = feedback[idea.id]?.rating
        if (rating) reviewed += 1
        if (rating === 'like') liked += 1
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
    liked
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

function filterSources(
  sources: readonly MemeReviewSource[],
  feedback: MemeFeedbackDocument['feedback'],
  rawQuery: string,
  reviewFilter: ReviewFilter
): readonly MemeReviewSource[] {
  const query = rawQuery.trim().toLocaleLowerCase()

  if (!query && reviewFilter === 'all') return sources

  return sources.flatMap((source) => {
    const sourceMatches = source.title.toLocaleLowerCase().includes(query)
    const scenarios = source.scenarios.flatMap((scenario) => {
      const scenarioMatches =
        sourceMatches || scenario.title.toLocaleLowerCase().includes(query)
      const ideas = scenario.ideas.filter((idea) => {
        const rating = feedback[idea.id]?.rating ?? null
        const ratingMatches =
          reviewFilter === 'all' ||
          (reviewFilter === 'unreviewed'
            ? rating === null
            : rating === reviewFilter)
        const ideaMatches =
          !query ||
          scenarioMatches ||
          idea.ai_concept.toLocaleLowerCase().includes(query) ||
          idea.caption_lines.some((line) =>
            line.toLocaleLowerCase().includes(query)
          )

        return ratingMatches && ideaMatches
      })

      return ideas.length ? [{ ...scenario, ideas }] : []
    })

    return scenarios.length ? [{ ...source, scenarios }] : []
  })
}
