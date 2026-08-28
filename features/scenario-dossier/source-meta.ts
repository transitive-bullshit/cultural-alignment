import type { SourceIdentity } from '@/lib/content/catalog'

export function shouldShowEpisode(
  sourceType: SourceIdentity['sourceType'],
  episodeLabel: string | undefined
) {
  return sourceType === 'tv-show' && Boolean(episodeLabel?.trim())
}
