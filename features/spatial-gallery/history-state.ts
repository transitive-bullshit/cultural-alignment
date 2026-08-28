const GALLERY_HISTORY_STATE_KEY = 'culturalAlignmentGallery'

type SpatialGalleryHistoryState = Readonly<{
  itemId: string
  offsetX: number
  version: 1
}>

type GalleryHistoryEnvelope = Readonly<{
  [GALLERY_HISTORY_STATE_KEY]?: Readonly<Record<string, unknown>>
}>

export function readGalleryHistoryState(
  historyState: unknown,
  galleryKey: string,
  itemIds: ReadonlySet<string>
): SpatialGalleryHistoryState | null {
  if (!isRecord(historyState)) return null

  const envelope = historyState as GalleryHistoryEnvelope
  const galleryStates = envelope[GALLERY_HISTORY_STATE_KEY]
  if (!isRecord(galleryStates)) return null

  const candidate = galleryStates[galleryKey]
  if (!isRecord(candidate)) return null
  if (candidate.version !== 1) return null
  if (typeof candidate.itemId !== 'string') return null
  if (!itemIds.has(candidate.itemId)) return null
  if (typeof candidate.offsetX !== 'number') return null
  if (!Number.isFinite(candidate.offsetX)) return null

  return {
    itemId: candidate.itemId,
    offsetX: candidate.offsetX,
    version: 1
  }
}

export function mergeGalleryHistoryState(
  historyState: unknown,
  galleryKey: string,
  galleryState: SpatialGalleryHistoryState
) {
  const currentHistory = isRecord(historyState) ? historyState : {}
  const currentGalleries = isRecord(currentHistory[GALLERY_HISTORY_STATE_KEY])
    ? currentHistory[GALLERY_HISTORY_STATE_KEY]
    : {}

  return {
    ...currentHistory,
    [GALLERY_HISTORY_STATE_KEY]: {
      ...currentGalleries,
      [galleryKey]: galleryState
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
