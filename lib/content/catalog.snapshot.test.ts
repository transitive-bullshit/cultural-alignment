import { describe, expect, it } from 'vitest'

import searchIndex from '@/public/content/search-index.json'

import type { ResourceKind } from './catalog'
import { contentCatalog } from './snapshot'

const resourceKinds = [
  'source',
  'risk-family',
  'concept'
] as const satisfies readonly ResourceKind[]

describe('full content catalog routes', () => {
  it('projects the complete synchronized resource set', () => {
    expect(contentCatalog.listScenarioCards()).toHaveLength(179)
    expect(contentCatalog.listResources('source')).toHaveLength(129)
    expect(contentCatalog.listResources('risk-family')).toHaveLength(5)
    expect(contentCatalog.listResources('concept')).toHaveLength(65)
  })

  it('resolves every resource summary and all of its scenario links', () => {
    for (const kind of resourceKinds) {
      for (const summary of contentCatalog.listResources(kind)) {
        const page = contentCatalog.getResourcePage(kind, summary.slug)

        expect(page).not.toBeNull()
        expect(page?.href).toBe(summary.href)
        expect(page?.scenarios).toHaveLength(summary.scenarioCount)
        expect(summary.scenarioCount).toBeGreaterThan(0)

        for (const scenario of page?.scenarios ?? []) {
          expect(contentCatalog.getScenarioPage(scenario.slug)).not.toBeNull()
        }

        for (const related of page?.relatedResources ?? []) {
          expect(
            contentCatalog.getResourcePage(related.kind, related.slug)
          ).not.toBeNull()
        }
      }
    }
  })

  it('keeps the generated client search index identical to catalog output', () => {
    expect(searchIndex).toEqual(contentCatalog.getSearchDocuments())
    expect(searchIndex).toHaveLength(378)
  })

  it('resolves every generated search href through the catalog seam', () => {
    for (const document of contentCatalog.getSearchDocuments()) {
      expect(resolveHref(document.href)).toBe(true)
    }
  })

  it('includes joined taxonomy and authored analysis in scenario keywords', () => {
    const document = contentCatalog
      .getSearchDocuments()
      .find((item) => item.href === '/scenarios/lacie-games-her-rating')

    expect(document?.keywords).toEqual(
      expect.arrayContaining([
        'Black Mirror',
        'Misalignment',
        expect.stringContaining('rating')
      ])
    )
  })
})

function resolveHref(href: string) {
  const [, segment, slug, trailing] = href.split('/')

  if (!segment || !slug || trailing) return false
  if (segment === 'scenarios') {
    return contentCatalog.getScenarioPage(slug) !== null
  }

  const resourceKindBySegment: Readonly<Record<string, ResourceKind>> = {
    sources: 'source',
    'risk-families': 'risk-family',
    concepts: 'concept'
  }
  const kind = resourceKindBySegment[segment]

  return kind ? contentCatalog.getResourcePage(kind, slug) !== null : false
}
