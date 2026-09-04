import { describe, expect, it } from 'vitest'

import type { MemeReviewSource } from './catalog'
import {
  filterMemeIdeasByFinalizationState,
  filterMemeIdeasByReviewState,
  hasReviewedMemeIdea,
  hasUnreviewedMemeIdea,
  prioritizeFinalizedMemeIdeas
} from './review-queue'
import type { MemeFeedbackEntry } from './schema'

describe('meme review queue', () => {
  it('puts finalized ideas first within each scenario without splitting the hierarchy', () => {
    const sources = reviewSources([
      {
        slug: 'source-a',
        scenarios: [
          {
            slug: 'scenario-a',
            ideas: ['a--01', 'a--02', 'a--03', 'a--04']
          },
          { slug: 'scenario-b', ideas: ['b--01'] }
        ]
      },
      {
        slug: 'source-b',
        scenarios: [{ slug: 'scenario-c', ideas: ['c--01', 'c--02'] }]
      }
    ])
    const feedback: Record<string, MemeFeedbackEntry> = {
      'a--02': {
        rating: 'like',
        notes: '',
        locked: true,
        lockRevision: 1
      },
      'a--04': {
        rating: 'like',
        notes: '',
        locked: true,
        lockRevision: 1
      },
      'c--01': {
        rating: 'like',
        notes: '',
        locked: true,
        lockRevision: 1
      }
    }

    const ordered = prioritizeFinalizedMemeIdeas(sources, feedback)

    expect(ordered.map(({ slug }) => slug)).toEqual(['source-a', 'source-b'])
    expect(
      ordered.map((source) =>
        source.scenarios.map(({ slug, ideas }) => ({
          slug,
          ideaIds: ideas.map(({ id }) => id)
        }))
      )
    ).toEqual([
      [
        {
          slug: 'scenario-a',
          ideaIds: ['a--02', 'a--04', 'a--01', 'a--03']
        },
        { slug: 'scenario-b', ideaIds: ['b--01'] }
      ],
      [{ slug: 'scenario-c', ideaIds: ['c--01', 'c--02'] }]
    ])
    expect(ordered.flatMap(sourceIdeaIds)).toHaveLength(7)
    expect(new Set(ordered.flatMap(sourceIdeaIds)).size).toBe(7)
  })

  it('keeps a scenario in the unreviewed queue while any one of its ideas is unreviewed', () => {
    const scenario = reviewSources([
      {
        slug: 'source-a',
        scenarios: [
          {
            slug: 'scenario-a',
            ideas: ['a--01', 'a--02', 'a--03']
          }
        ]
      }
    ])
      .at(0)
      ?.scenarios.at(0)
    if (!scenario) throw new Error('Missing review scenario fixture')
    const feedback: Record<string, MemeFeedbackEntry> = {
      'a--01': {
        rating: 'like',
        notes: '',
        locked: false,
        lockRevision: 0
      },
      'a--02': {
        rating: 'dislike',
        notes: '',
        locked: false,
        lockRevision: 0
      }
    }

    expect(hasUnreviewedMemeIdea(scenario.ideas, feedback)).toBe(true)
    expect(
      filterMemeIdeasByReviewState(scenario.ideas, feedback, 'unreviewed').map(
        ({ id }) => id
      )
    ).toEqual(['a--01', 'a--02', 'a--03'])

    feedback['a--03'] = {
      rating: 'neutral',
      notes: '',
      locked: false,
      lockRevision: 0
    }

    expect(hasUnreviewedMemeIdea(scenario.ideas, feedback)).toBe(false)
    expect(
      filterMemeIdeasByReviewState(scenario.ideas, feedback, 'unreviewed')
    ).toEqual([])
  })

  it('keeps a scenario in the reviewed queue while any one idea is reviewed', () => {
    const scenario = reviewSources([
      {
        slug: 'source-a',
        scenarios: [
          {
            slug: 'scenario-a',
            ideas: ['a--01', 'a--02']
          }
        ]
      }
    ])
      .at(0)
      ?.scenarios.at(0)
    if (!scenario) throw new Error('Missing review scenario fixture')
    const feedback: Record<string, MemeFeedbackEntry> = {
      'a--01': {
        rating: 'like',
        notes: '',
        locked: false,
        lockRevision: 0
      }
    }

    expect(hasReviewedMemeIdea(scenario.ideas, feedback)).toBe(true)
    expect(
      filterMemeIdeasByReviewState(scenario.ideas, feedback, 'reviewed').map(
        ({ id }) => id
      )
    ).toEqual(['a--01', 'a--02'])
  })

  it('keeps finalized and candidate filters scoped to individual ideas', () => {
    const scenario = reviewSources([
      {
        slug: 'source-a',
        scenarios: [
          {
            slug: 'scenario-a',
            ideas: ['a--01', 'a--02', 'a--03']
          }
        ]
      }
    ])
      .at(0)
      ?.scenarios.at(0)
    if (!scenario) throw new Error('Missing review scenario fixture')
    const feedback: Record<string, MemeFeedbackEntry> = {
      'a--01': {
        rating: 'like',
        notes: '',
        locked: true,
        lockRevision: 1
      },
      'a--02': {
        rating: 'like',
        notes: '',
        locked: false,
        lockRevision: 0
      },
      'a--03': {
        rating: 'dislike',
        notes: '',
        locked: false,
        lockRevision: 0
      }
    }

    expect(
      filterMemeIdeasByFinalizationState(
        scenario.ideas,
        feedback,
        'finalized'
      ).map(({ id }) => id)
    ).toEqual(['a--01'])
    expect(
      filterMemeIdeasByFinalizationState(
        scenario.ideas,
        feedback,
        'candidates'
      ).map(({ id }) => id)
    ).toEqual(['a--02', 'a--03'])
  })
})

function reviewSources(
  sources: readonly {
    readonly slug: string
    readonly scenarios: readonly {
      readonly slug: string
      readonly ideas: readonly string[]
    }[]
  }[]
): readonly MemeReviewSource[] {
  return sources.map(({ slug, scenarios }) => ({
    slug,
    title: slug,
    scenarios: scenarios.map((scenario) => ({
      slug: scenario.slug,
      title: scenario.slug,
      href: `/scenarios/${scenario.slug}`,
      featured: true,
      episodeLabel: null,
      source: { slug, title: slug },
      image: {
        src: 'https://example.com/frame.jpg',
        alt: 'Frame',
        width: 1600,
        height: 900,
        blurDataURL: 'data:image/png;base64,AA==',
        objectPosition: '50% 50%'
      },
      assets: [],
      ideas: scenario.ideas.map((id) => ({ id }))
    }))
  })) as unknown as readonly MemeReviewSource[]
}

function sourceIdeaIds(source: MemeReviewSource): readonly string[] {
  return source.scenarios.flatMap(({ ideas }) => ideas.map(({ id }) => id))
}
