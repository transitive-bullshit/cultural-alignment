import type { ScenarioListQuery } from '@/lib/content/catalog'

export type BrowseGalleryParams = Readonly<{
  family: string | null
  sort: NonNullable<ScenarioListQuery['sort']>
}>

export type BrowseSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>

export function parseBrowseGalleryParams(
  searchParams: BrowseSearchParams,
  validFamilySlugs: ReadonlySet<string>
): BrowseGalleryParams {
  const requestedFamily = firstValue(searchParams.family)
  const requestedSort = firstValue(searchParams.sort)

  return {
    family:
      requestedFamily && validFamilySlugs.has(requestedFamily)
        ? requestedFamily
        : null,
    sort: requestedSort === 'release-asc' ? 'release-asc' : 'release-desc'
  }
}

export function createBrowseGalleryHref(params: BrowseGalleryParams) {
  const searchParams = new URLSearchParams()

  if (params.family) searchParams.set('family', params.family)
  searchParams.set('sort', params.sort)

  return `/scenarios?${searchParams.toString()}`
}

function firstValue(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
