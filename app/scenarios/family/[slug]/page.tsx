import type { Metadata } from 'next'

import {
  getScenarioFamily,
  ScenarioArchivePage,
  scenarioFamilies
} from '../../scenario-archive-page'

export const dynamicParams = false

export function generateStaticParams() {
  return scenarioFamilies.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params
}: PageProps<'/scenarios/family/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const family = getScenarioFamily(slug)

  if (!family) return {}

  return {
    title: `${family.title} scenarios`,
    description: `Browse cultural analogies for ${family.title}.`,
    alternates: { canonical: `/scenarios/family/${slug}` }
  }
}

export default async function ScenarioFamilyArchivePage({
  params
}: PageProps<'/scenarios/family/[slug]'>) {
  const { slug } = await params

  return <ScenarioArchivePage familySlug={slug} />
}
