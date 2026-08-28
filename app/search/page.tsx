import type { Metadata } from 'next'

import { SearchResultsPage } from '@/features/content-navigation/resource-pages'
import { searchDocumentGroups } from '@/lib/content/search'
import { contentCatalog } from '@/lib/content/snapshot'

type SearchPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search scenarios, sources, AI risk families, and AI safety concepts.',
  alternates: { canonical: '/search' }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = firstValue((await searchParams).q).trim()
  const documents = searchDocumentGroups(
    contentCatalog.getSearchDocuments(),
    query,
    25
  ).flatMap((group) => group.documents)

  return <SearchResultsPage query={query} documents={documents} />
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}
