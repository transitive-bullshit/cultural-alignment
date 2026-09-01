import { describe, expect, it } from 'vitest'

import type { ContentImage } from '../lib/content/schema'
import {
  franchiseImageAlt,
  reuseSnapshotMedia,
  scenarioImageAlt,
  scenarioMemeAlt,
  sourcePosterAlt,
  type CurrentMediaRecords,
  type PreviousSnapshotMedia
} from './sync-fast-media'

const blurDataURL = 'data:image/webp;base64,AAAA'

function image(name: string, alt = name): ContentImage {
  return {
    gallerySrc: `https://assets.example/${name}-gallery.webp`,
    detailSrc: `https://assets.example/${name}-detail.webp`,
    width: 1,
    height: 1,
    alt,
    blurDataURL
  }
}

const scenarioA = {
  id: 'scenario-a',
  title: 'Scenario A',
  sourceId: 'source-a',
  image: image('scenario-a'),
  memes: [image('scenario-a-meme')]
}
const scenarioB = {
  id: 'scenario-b',
  title: 'Scenario B',
  sourceId: 'source-b',
  image: image('scenario-b'),
  memes: []
}
const sourceA = {
  id: 'source-a',
  title: 'Source A',
  poster: image('source-a')
}
const sourceB = { id: 'source-b', title: 'Source B', poster: null }
const franchiseA = {
  id: 'franchise-a',
  title: 'Franchise A',
  image: image('franchise-a')
}
const franchiseB = {
  id: 'franchise-b',
  title: 'Franchise B',
  image: image('franchise-b')
}

const snapshot: PreviousSnapshotMedia = {
  scenarios: [scenarioA, scenarioB],
  sources: [sourceA, sourceB],
  franchises: [franchiseA, franchiseB]
}

const current: CurrentMediaRecords = {
  scenarios: [scenarioB, scenarioA],
  sources: [sourceB, sourceA],
  franchises: [franchiseB, franchiseA]
}

describe('reuseSnapshotMedia', () => {
  it('reuses every image field by stable record ID', () => {
    const result = reuseSnapshotMedia(snapshot, current)

    expect(result.scenarioImages).toEqual([scenarioB.image, scenarioA.image])
    expect(result.scenarioImages[0]).toBe(scenarioB.image)
    expect(result.scenarioMemes).toEqual([scenarioB.memes, scenarioA.memes])
    expect(result.sourcePosters).toEqual([sourceB.poster, sourceA.poster])
    expect(result.franchiseImages).toEqual([franchiseB.image, franchiseA.image])
  })

  it('refreshes generated alts after title changes and preserves custom alts', () => {
    const previousSource = {
      id: 'source',
      title: 'Previous source',
      poster: image('poster', sourcePosterAlt('Previous source'))
    }
    const previousScenario = {
      id: 'scenario',
      title: 'Previous scenario',
      sourceId: previousSource.id,
      image: image(
        'scenario',
        scenarioImageAlt(previousSource.title, 'Previous scenario')
      ),
      memes: [
        image('generated-meme', scenarioMemeAlt('Previous scenario', 0, 2)),
        image('custom-meme', 'Custom meme description')
      ]
    }
    const previousFranchise = {
      id: 'franchise',
      title: 'Previous franchise',
      image: image('franchise', franchiseImageAlt('Previous franchise'))
    }
    const next = {
      scenarios: [{ ...previousScenario, title: 'Current scenario' }],
      sources: [{ ...previousSource, title: 'Current source' }],
      franchises: [{ ...previousFranchise, title: 'Current franchise' }]
    }

    const result = reuseSnapshotMedia(
      {
        scenarios: [previousScenario],
        sources: [previousSource],
        franchises: [previousFranchise]
      },
      next
    )

    expect(result.scenarioImages[0]!.alt).toBe(
      scenarioImageAlt(next.sources[0]!.title, next.scenarios[0]!.title)
    )
    expect(result.scenarioMemes[0]![0]!.alt).toBe(
      scenarioMemeAlt(next.scenarios[0]!.title, 0, 2)
    )
    expect(result.scenarioMemes[0]![1]).toBe(previousScenario.memes[1])
    expect(result.sourcePosters[0]!.alt).toBe(
      sourcePosterAlt(next.sources[0]!.title)
    )
    expect(result.franchiseImages[0]!.alt).toBe(
      franchiseImageAlt(next.franchises[0]!.title)
    )
  })

  it.each([
    [
      'scenarios',
      {
        ...current,
        scenarios: [{ ...current.scenarios[0]!, id: 'missing-scenario' }]
      }
    ],
    [
      'sources',
      {
        ...current,
        sources: [{ ...current.sources[0]!, id: 'missing-source' }]
      }
    ],
    [
      'franchises',
      {
        ...current,
        franchises: [{ ...current.franchises[0]!, id: 'missing-franchise' }]
      }
    ]
  ] satisfies readonly [string, CurrentMediaRecords][])(
    'rejects missing %s media instead of guessing',
    (collection, ids) => {
      expect(() => reuseSnapshotMedia(snapshot, ids)).toThrow(
        new RegExp(`--fast.+${collection}.+missing-.+without --fast`, 's')
      )
    }
  )
})
