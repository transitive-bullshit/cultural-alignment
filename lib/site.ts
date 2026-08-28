const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
const vercelHostname =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL

export const siteUrl = new URL(
  configuredSiteUrl ??
    (vercelHostname ? `https://${vercelHostname}` : 'http://localhost:3000')
)
