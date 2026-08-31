import concepts from '@/content/snapshot/concepts.json'
import franchises from '@/content/snapshot/franchises.json'
import riskFamilies from '@/content/snapshot/risk-families.json'
import scenarios from '@/content/snapshot/scenarios.json'
import sources from '@/content/snapshot/sources.json'
import { createContentCatalog } from './catalog'
import { validateContentSnapshot } from './validate'

export const contentSnapshot = validateContentSnapshot({
  schemaVersion: 3,
  scenarios,
  sources,
  franchises,
  riskFamilies,
  concepts
})

export const contentCatalog = createContentCatalog(contentSnapshot)
