import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ScenarioDossier } from '@/features/scenario-dossier/scenario-dossier'
import { contentCatalog } from '@/lib/content/snapshot'

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('scenario').map((slug) => ({ slug }))
}

export async function generateMetadata({
  params
}: PageProps<'/scenarios/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const scenario = contentCatalog.getScenarioPage(slug)

  if (!scenario) return {}

  const description = `${scenario.title}, a scene from ${scenario.source.title}, explained as an analogy for AI safety and alignment.`

  return {
    title: scenario.title,
    description,
    alternates: {
      canonical: `/scenarios/${scenario.slug}`
    },
    keywords: [
      scenario.source.title,
      ...scenario.riskFamilies.map(({ title }) => title),
      ...scenario.concepts.map(({ title }) => title)
    ],
    openGraph: {
      type: 'article',
      title: scenario.title,
      description
    }
  }
}

export default async function ScenarioPage({
  params
}: PageProps<'/scenarios/[slug]'>) {
  const { slug } = await params
  const scenario = contentCatalog.getScenarioPage(slug)

  if (!scenario) notFound()

  return <ScenarioDossier scenario={scenario} />
}
