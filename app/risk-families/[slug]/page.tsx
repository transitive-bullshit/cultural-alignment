import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ResourceDetailPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

type RiskFamilyPageProps = {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('risk-family').map((slug) => ({ slug }))
}

export async function generateMetadata({
  params
}: RiskFamilyPageProps): Promise<Metadata> {
  const { slug } = await params
  const family = contentCatalog.getResourcePage('risk-family', slug)

  return family
    ? {
        title: family.title,
        description: family.description,
        alternates: { canonical: family.href }
      }
    : {}
}

export default async function RiskFamilyPage({ params }: RiskFamilyPageProps) {
  const { slug } = await params
  const family = contentCatalog.getResourcePage('risk-family', slug)

  if (!family) notFound()

  return <ResourceDetailPage resource={family} />
}
