export type BrowseGalleryParams = Readonly<{
  family: string | null
}>

export type BrowseSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>

export function parseBrowseGalleryParams(
  searchParams: BrowseSearchParams,
  validFamilySlugs: ReadonlySet<string>
): BrowseGalleryParams {
  const requestedFamily = firstValue(searchParams.family)

  return {
    family:
      requestedFamily && validFamilySlugs.has(requestedFamily)
        ? requestedFamily
        : null
  }
}

export function createBrowseGalleryHref(params: BrowseGalleryParams) {
  const searchParams = new URLSearchParams()

  if (params.family) searchParams.set('family', params.family)
  const query = searchParams.toString()

  return query ? `/scenarios?${query}` : '/scenarios'
}

function firstValue(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
