const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
const vercelHostname =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL

export const siteUrl = new URL(
  configuredSiteUrl ??
    (vercelHostname ? `https://${vercelHostname}` : 'http://localhost:3000')
)

export const repositoryUrl =
  'https://github.com/transitive-bullshit/cultural-alignment'
export const notionSourceUrl =
  'https://www.notion.so/3c6edb27f12480709d6dca256d247c80'
export const xProfileUrl = 'https://x.com/transitive_bs'
