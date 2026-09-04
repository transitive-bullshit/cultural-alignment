import type { MemeReviewSource } from './catalog'
import type { MemeFeedbackEntry } from './schema'

export type MemeReviewFilter = 'all' | 'unreviewed' | 'reviewed'
export type MemeFinalizationFilter = 'all' | 'finalized' | 'candidates'

export function prioritizeFinalizedMemeIdeas(
  sources: readonly MemeReviewSource[],
  feedback: Readonly<Record<string, MemeFeedbackEntry | undefined>>
): readonly MemeReviewSource[] {
  return sources.map((source) => ({
    ...source,
    scenarios: source.scenarios.map((scenario) => {
      const finalized: (typeof scenario.ideas)[number][] = []
      const candidates: (typeof scenario.ideas)[number][] = []

      for (const idea of scenario.ideas) {
        if (feedback[idea.id]?.locked === true) {
          finalized.push(idea)
        } else {
          candidates.push(idea)
        }
      }

      return { ...scenario, ideas: [...finalized, ...candidates] }
    })
  }))
}

export function hasUnreviewedMemeIdea<T extends { readonly id: string }>(
  ideas: readonly T[],
  feedback: Readonly<Record<string, MemeFeedbackEntry | undefined>>
) {
  return ideas.some((idea) => {
    const entry = feedback[idea.id]
    return (entry?.rating ?? null) === null && entry?.locked !== true
  })
}

export function hasReviewedMemeIdea<T extends { readonly id: string }>(
  ideas: readonly T[],
  feedback: Readonly<Record<string, MemeFeedbackEntry | undefined>>
) {
  return ideas.some((idea) => (feedback[idea.id]?.rating ?? null) !== null)
}

export function filterMemeIdeasByReviewState<T extends { readonly id: string }>(
  ideas: readonly T[],
  feedback: Readonly<Record<string, MemeFeedbackEntry | undefined>>,
  reviewFilter: MemeReviewFilter
): readonly T[] {
  if (reviewFilter === 'all') return ideas
  if (reviewFilter === 'unreviewed') {
    return hasUnreviewedMemeIdea(ideas, feedback) ? ideas : []
  }

  return hasReviewedMemeIdea(ideas, feedback) ? ideas : []
}

export function filterMemeIdeasByFinalizationState<
  T extends { readonly id: string }
>(
  ideas: readonly T[],
  feedback: Readonly<Record<string, MemeFeedbackEntry | undefined>>,
  finalizationFilter: MemeFinalizationFilter
): readonly T[] {
  if (finalizationFilter === 'all') return ideas

  return ideas.filter((idea) => {
    const finalized = feedback[idea.id]?.locked === true
    return finalizationFilter === 'finalized' ? finalized : !finalized
  })
}
