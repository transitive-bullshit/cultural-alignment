import 'server-only'

import { contentCatalog } from '@/lib/content/snapshot'

import type { GalleryIntroExample } from './types'

const INTRO_SCENARIO_SLUG = 'serving-the-most-evil-master'

function resolveGalleryIntroExample(): GalleryIntroExample {
  const scenario = contentCatalog.getScenarioPage(INTRO_SCENARIO_SLUG)
  const primaryConcept = scenario?.concepts[0]

  if (!scenario || !primaryConcept) {
    throw new Error(
      `Missing gallery introduction scenario or primary concept: ${INTRO_SCENARIO_SLUG}`
    )
  }

  return {
    source: scenario.source.title,
    title: scenario.title,
    concept: primaryConcept.title,
    image: {
      src: scenario.image.detailSrc,
      alt: scenario.image.alt,
      blurDataURL: scenario.image.blurDataURL,
      width: scenario.image.width,
      height: scenario.image.height,
      focalPoint: scenario.image.focalPoint
    }
  }
}

export const galleryIntroExample = resolveGalleryIntroExample()
