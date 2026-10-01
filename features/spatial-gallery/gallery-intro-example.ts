import 'server-only'

import { contentCatalog } from '@/lib/content/snapshot'

import type { GalleryIntroExample } from './types'

const INTRO_SCENARIO_SLUG = 'keep-summer-safe'
const INTRO_MEME_SRC =
  'https://assets.cultural-alignment.com/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/memes/detail-68f8685a354878ea72b8134b820b2ddd2b41fdff2abe5519a537839d222f447c.webp'

function resolveGalleryIntroExample(): GalleryIntroExample {
  const scenario = contentCatalog.getScenarioPage(INTRO_SCENARIO_SLUG)
  const primaryConcept = scenario?.concepts[0]
  const image = scenario?.memes.find(
    ({ detailSrc }) => detailSrc === INTRO_MEME_SRC
  )

  if (!scenario || !primaryConcept || !image) {
    throw new Error(
      `Missing gallery introduction scenario, primary concept, or meme: ${INTRO_SCENARIO_SLUG}`
    )
  }

  return {
    source: scenario.source.title,
    title: scenario.title,
    concept: primaryConcept.title,
    image: {
      src: image.detailSrc,
      alt: 'Summer cowering in the car, captioned “Keep Summer safe” and “Acceptable means: [not specified]”.',
      blurDataURL: image.blurDataURL,
      width: image.width,
      height: image.height,
      focalPoint: image.focalPoint
    }
  }
}

export const galleryIntroExample = resolveGalleryIntroExample()
