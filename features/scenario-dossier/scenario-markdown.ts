import type { ScenarioPage, TaxonomyLink } from '@/lib/content/catalog'

import { shouldShowEpisode } from './source-meta'

export function formatScenarioAsMarkdown(scenario: ScenarioPage, siteUrl: URL) {
  const details = [
    `- **Source:** ${markdownLink(scenario.source.title, scenario.source.href, siteUrl)}`,
    formatEpisode(scenario, siteUrl),
    `- **Release date:** ${scenario.releaseDate ?? 'Unknown'}`,
    `- **Risk families:** ${formatTaxonomyLinks(scenario.riskFamilies, siteUrl)}`,
    `- **AI safety concepts:** ${formatTaxonomyLinks(scenario.concepts, siteUrl)}`,
    `- **Scenario page:** ${markdownLink('View the original dossier', `/scenarios/${scenario.slug}`, siteUrl)}`
  ].filter((line) => line !== null)
  const imageUrl = markdownDestination(scenario.image.detailSrc, siteUrl)
  const sections = [
    `# ${escapeMarkdownText(scenario.title)}`,
    `## Scenario details\n\n${details.join('\n')}`,
    `## Scene still\n\n![${escapeMarkdownAlt(scenario.image.alt)}](${imageUrl})`,
    `## Scene\n\n${scenario.scene}`,
    `## AI safety analogy\n\n${scenario.whyAnalogyWorks}`,
    `## Where the analogy breaks\n\n${scenario.caveats}`
  ]

  if (scenario.video) {
    const videoUrl = new URL('https://www.youtube.com/watch')
    videoUrl.searchParams.set('v', scenario.video.id)

    if (scenario.video.startSeconds !== undefined) {
      videoUrl.searchParams.set('t', `${scenario.video.startSeconds}s`)
    }

    sections.push(
      `## Video\n\n${markdownLink('Watch the scene on YouTube', videoUrl.href, siteUrl)}`
    )
  }

  return `${sections.join('\n\n')}\n`
}

function formatEpisode(scenario: ScenarioPage, siteUrl: URL) {
  const episode = scenario.episode

  if (
    !episode ||
    !shouldShowEpisode(scenario.source.sourceType, episode.label)
  ) {
    return null
  }

  const label = episode.href
    ? markdownLink(episode.label, episode.href, siteUrl)
    : escapeMarkdownText(episode.label)

  return `- **Episode:** ${label}`
}

function formatTaxonomyLinks(items: readonly TaxonomyLink[], siteUrl: URL) {
  if (items.length === 0) return 'None assigned'

  return items
    .map((item) => markdownLink(item.title, item.href, siteUrl))
    .join(', ')
}

function markdownLink(label: string, href: string, siteUrl: URL) {
  return `[${escapeMarkdownText(label)}](${markdownDestination(href, siteUrl)})`
}

function absoluteUrl(href: string, siteUrl: URL) {
  return new URL(href, siteUrl).href
}

function markdownDestination(href: string, siteUrl: URL) {
  return absoluteUrl(href, siteUrl)
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
    .replaceAll('\\', '%5C')
}

function escapeMarkdownText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]{}<>#+.!|~]/g, '\\$&')
}

function escapeMarkdownAlt(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[[\]\\]/g, '\\$&')
}
