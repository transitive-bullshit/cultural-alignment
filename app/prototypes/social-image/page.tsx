import type { Metadata } from 'next'

import { contentCatalog } from '@/lib/content/snapshot'

import { SocialImagePrototype } from './social-image-prototype'
import type { SocialImageScenario } from './prototype-types'

export const metadata: Metadata = {
  title: 'Social image prototypes',
  description: 'Explorations for the primary Cultural Alignment social image.',
  robots: { index: false, follow: false }
}

const scenarioSlugs = [
  'keep-summer-safe',
  'mickeys-runaway-brooms',
  'gps-into-the-lake',
  'lacie-games-her-rating',
  'hal-resists-disconnection',
  'bender-resists-reset',
  'auto-enforces-directive-a113',
  'skynet-launches-judgment-day'
] as const

const scenarios = scenarioSlugs.map((slug): SocialImageScenario => {
  const scenario = contentCatalog.getScenarioPage(slug)
  if (!scenario) throw new Error(`Missing social image scenario: ${slug}`)

  return {
    slug: scenario.slug,
    title: scenario.title,
    source: scenario.source.title,
    image: {
      src: scenario.image.detailSrc,
      alt: scenario.image.alt,
      width: scenario.image.width,
      height: scenario.image.height
    }
  }
})

export default async function SocialImagePrototypePage({
  searchParams
}: {
  readonly searchParams: Promise<{
    readonly render?: string | readonly string[]
    readonly tile?: string | readonly string[]
    readonly v?: string | readonly string[]
  }>
}) {
  const requestedParams = await searchParams
  const requestedVariant = requestedParams.v
  const rawVariant = Array.isArray(requestedVariant)
    ? requestedVariant[0]
    : requestedVariant
  const requestedRender = requestedParams.render
  const rawRender = Array.isArray(requestedRender)
    ? requestedRender[0]
    : requestedRender
  const requestedTile = requestedParams.tile
  const rawTile = Array.isArray(requestedTile)
    ? requestedTile[0]
    : requestedTile
  const parsedVariant = Number.parseInt(rawVariant ?? '1', 10)
  const initialVariant = Number.isInteger(parsedVariant)
    ? Math.min(5, Math.max(1, parsedVariant)) - 1
    : 0

  return (
    <SocialImagePrototype
      data={{ scenarios }}
      initialVariant={initialVariant}
      renderScale={rawRender === '2x' ? 2 : 1}
      renderTile={rawTile === 'right' ? 'right' : 'left'}
    />
  )
}
