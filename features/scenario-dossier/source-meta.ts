const whitespace = /\s+/gu

function normalizeVisibleLabel(label: string) {
  return label
    .normalize('NFKC')
    .trim()
    .replace(whitespace, ' ')
    .toLocaleLowerCase('en-US')
}

export function hasDistinctEpisodeLabel(
  sourceTitle: string,
  episodeLabel: string | undefined
) {
  if (!episodeLabel) return false

  return (
    normalizeVisibleLabel(sourceTitle) !== normalizeVisibleLabel(episodeLabel)
  )
}
