export const MEME_BATCH_SIZE = 10

export function getNextVisibleMemeCount(
  visibleCount: number,
  totalCount: number
) {
  return Math.min(totalCount, visibleCount + MEME_BATCH_SIZE)
}
