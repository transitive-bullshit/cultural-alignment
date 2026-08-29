const configuredSiteUrl = normalizeEnvironmentValue(
  process.env.NEXT_PUBLIC_SITE_URL
)
const vercelHostname =
  normalizeEnvironmentValue(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalizeEnvironmentValue(process.env.VERCEL_URL)

export const siteName = 'Cultural Alignment'
export const siteDescription =
  'Exploring real AI risks through the lens of pop culture'
export const siteDescriptionLong =
  'Exploring real AI risks through the lens of popular culture'
export const siteTagline = siteDescription
export const siteSummary = siteDescription

export const siteUrl = new URL(
  configuredSiteUrl ??
    (vercelHostname ? `https://${vercelHostname}` : 'http://localhost:3000')
)

export const repositoryUrl =
  'https://github.com/transitive-bullshit/cultural-alignment'
export const notionSourceUrl =
  'https://transitive-bs.notion.site/3c6edb27f12480709d6dca256d247c80?v=3c6edb27f12480a09aaf000c94ab8502'
export const xProfileUrl = 'https://x.com/transitive_bs'

function normalizeEnvironmentValue(value: string | undefined) {
  return value?.trim() || undefined
}
