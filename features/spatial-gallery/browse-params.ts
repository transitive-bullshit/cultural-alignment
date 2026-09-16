export type BrowseGalleryParams = Readonly<{
  family: string | null
}>

export function createBrowseGalleryHref(params: BrowseGalleryParams) {
  return params.family ? `/scenarios/family/${params.family}` : '/scenarios'
}
