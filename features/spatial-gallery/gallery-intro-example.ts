import 'server-only'

import { contentCatalog } from '@/lib/content/snapshot'

import type { GalleryIntroExample } from './types'

const INTRO_SCENARIO_SLUG = 'sit-tight-and-assess'
const INTRO_MEME_SRC =
  'https://assets.cultural-alignment.com/media/generated/scenarios/3cdedb27f12481bdb2f5e77a3b7320b6/memes/detail-24f69cb00c9464b4eb60fd61f123cdd9098649cdf0a8705b0766ec8dd2a41061.webp'

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
      alt: 'A worried scientist captioned “Extinction probability: 99.78%” and “Sit tight and assess”.',
      blurDataURL: image.blurDataURL,
      width: image.width,
      height: image.height,
      focalPoint: image.focalPoint
    }
  }
}

export const galleryIntroExample = resolveGalleryIntroExample()
