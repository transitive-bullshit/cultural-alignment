import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'

import { ScenarioDossier } from '@/features/scenario-dossier/scenario-dossier'
import {
  getScenarioSocialMetadata,
  resolveContentSocialMetadata
} from '@/lib/content/social-metadata'
import { contentCatalog } from '@/lib/content/snapshot'

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('scenario').map((slug) => ({ slug }))
}

export async function generateMetadata(
  { params }: PageProps<'/scenarios/[slug]'>,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const scenario = contentCatalog.getScenarioPage(slug)

  if (!scenario) return {}

  return resolveContentSocialMetadata(
    getScenarioSocialMetadata(scenario),
    parent
  )
}

export default async function ScenarioPage({
  params
}: PageProps<'/scenarios/[slug]'>) {
  const { slug } = await params
  const scenario = contentCatalog.getScenarioPage(slug)

  if (!scenario) notFound()

  return <ScenarioDossier scenario={scenario} />
}
