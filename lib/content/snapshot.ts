import concepts from '@/content/snapshot/concepts.json'
import riskFamilies from '@/content/snapshot/risk-families.json'
import scenarios from '@/content/snapshot/scenarios.json'
import sources from '@/content/snapshot/sources.json'
import { createContentCatalog } from './catalog'
import { validateContentSnapshot } from './validate'

export const contentSnapshot = validateContentSnapshot({
  schemaVersion: 1,
  scenarios,
  sources,
  riskFamilies,
  concepts
})

export const contentCatalog = createContentCatalog(contentSnapshot)
