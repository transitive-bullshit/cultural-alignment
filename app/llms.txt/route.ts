import { contentCatalog } from '@/lib/content/snapshot'
import { repositoryUrl, siteTagline, siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const scenarioCount = contentCatalog.getStaticSlugs('scenario').length
  const sourceCount = contentCatalog.getStaticSlugs('source').length
  const franchiseCount = contentCatalog.getStaticSlugs('franchise').length
  const riskFamilyCount = contentCatalog.getStaticSlugs('risk-family').length
  const conceptCount = contentCatalog.getStaticSlugs('concept').length
  const link = (path: string) => new URL(path, siteUrl).toString()

  const markdown = `# Cultural Alignment

> ${siteTagline}.

Each scenario is an analogy rather than a substitute for research. Scenario dossiers explain both why an analogy works and where it breaks. The structured scenario data is released under CC0; third-party imagery, clips, titles, and trademarks remain the property of their respective owners.

## Explore

- [Scenarios](${link('/scenarios')}): ${scenarioCount} scenario dossiers
- [Sources](${link('/sources')}): ${sourceCount} films and television sources
- [Franchises](${link('/franchises')}): ${franchiseCount} media franchises
- [Risk families](${link('/risk-families')}): ${riskFamilyCount} high-level risk categories
- [AI safety concepts](${link('/concepts')}): ${conceptCount} concepts

## Project

- [About](${link('/about')})
- [Privacy](${link('/privacy')})
- [Sitemap](${link('/sitemap.xml')})
- [Source repository](${repositoryUrl})
`

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
