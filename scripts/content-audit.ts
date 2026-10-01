import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import sharp from 'sharp'

import type {
  ContentImage,
  ContentSnapshot,
  ScenarioRecord,
  SourceRecord
} from '../lib/content/schema'
import { validateContentSnapshot } from '../lib/content/validate'
import { scenarioImageAlt, sourcePosterAlt } from './sync-fast-media'

/**
 * Editorial audit of the committed snapshot against docs/notion-cms.md.
 *
 * `content:validate` rejects broken data; this reports soft-convention drift
 * for an editor to fix in Notion. `fix` findings break a stated convention;
 * `review` findings need editorial judgment.
 */

export type AuditSeverity = 'fix' | 'review'

export type AuditRule =
  | 'title-length'
  | 'tv-episode-missing'
  | 'risk-family-count'
  | 'concept-count'
  | 'clip-missing'
  | 'still-small'
  | 'still-aspect'
  | 'still-dark'
  | 'caption-alt-text'
  | 'prose-names-other-source'
  | 'duplicate-title'
  | 'trailer-missing'
  | 'poster-missing'
  | 'source-without-scenarios'
  | 'franchise-image-aspect'

export interface AuditFinding {
  readonly rule: AuditRule
  readonly severity: AuditSeverity
  readonly kind: 'scenario' | 'source' | 'franchise'
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly detail: string
}

export interface ContentAudit {
  readonly findings: readonly AuditFinding[]
  readonly stats: {
    readonly scenarios: number
    readonly sources: number
    readonly featured: number
    readonly conceptCounts: Readonly<Record<number, number>>
    readonly riskFamilyCounts: Readonly<Record<number, number>>
    readonly conceptUsage: readonly {
      readonly title: string
      readonly slug: string
      readonly scenarios: number
      readonly primary: number
    }[]
  }
}

export interface AuditOptions {
  /** Mean luminance in [0, 1] of a scenario still, keyed by scenario ID. */
  readonly stillLuminance?: ReadonlyMap<string, number>
  /** Restrict record findings to these scenario or source slugs. */
  readonly scope?: {
    readonly scenarioSlugs?: ReadonlySet<string>
    readonly sourceSlugs?: ReadonlySet<string>
  }
}

const RULE_SEVERITY: Record<AuditRule, AuditSeverity> = {
  'title-length': 'fix',
  'tv-episode-missing': 'fix',
  'risk-family-count': 'review',
  'concept-count': 'fix',
  'clip-missing': 'review',
  'still-small': 'review',
  'still-aspect': 'review',
  'still-dark': 'review',
  'caption-alt-text': 'review',
  'prose-names-other-source': 'review',
  'duplicate-title': 'fix',
  'trailer-missing': 'review',
  'poster-missing': 'review',
  'source-without-scenarios': 'review',
  'franchise-image-aspect': 'review'
}

export const AUDIT_LIMITS = {
  titleCharacters: 40,
  riskFamilies: 2,
  concepts: 5,
  stillMinWidth: 1200,
  stillAspect: [1.4, 2.45],
  franchiseAspect: [1.4, 2.45],
  stillMinLuminance: 0.13
} as const

export function auditContent(
  snapshot: ContentSnapshot,
  options: AuditOptions = {}
): ContentAudit {
  const findings: AuditFinding[] = []
  const sourcesById = new Map(snapshot.sources.map((s) => [s.id, s]))
  const franchisesById = new Map(snapshot.franchises.map((f) => [f.id, f]))
  const scope = options.scope
  const scoped = Boolean(scope?.scenarioSlugs || scope?.sourceSlugs)

  const inScenarioScope = (scenario: ScenarioRecord) =>
    !scoped ||
    scope?.scenarioSlugs?.has(scenario.slug) ||
    scope?.sourceSlugs?.has(sourcesById.get(scenario.sourceId)?.slug ?? '')

  const inSourceScope = (source: SourceRecord) =>
    !scoped || Boolean(scope?.sourceSlugs?.has(source.slug))

  const add = (
    rule: AuditRule,
    kind: AuditFinding['kind'],
    record: { id: string; slug: string; title: string },
    detail: string
  ) => {
    findings.push({
      rule,
      severity: RULE_SEVERITY[rule],
      kind,
      id: record.id,
      slug: record.slug,
      title: record.title,
      detail
    })
  }

  // Multi-word titles are specific enough that a mention is likely a real
  // cross-reference rather than an ordinary phrase.
  const sourceTitleMentions = snapshot.sources
    .map((source) => ({ source, name: displayTitle(source.title) }))
    .filter(({ name }) => name.split(/\s+/).length >= 2)

  const titleCounts = countBy(snapshot.scenarios, (s) =>
    s.title.trim().toLowerCase()
  )

  for (const scenario of snapshot.scenarios) {
    if (!inScenarioScope(scenario)) continue
    const source = sourcesById.get(scenario.sourceId)

    if (scenario.title.length > AUDIT_LIMITS.titleCharacters) {
      add(
        'title-length',
        'scenario',
        scenario,
        `${scenario.title.length} characters (limit ${AUDIT_LIMITS.titleCharacters})`
      )
    }

    if ((titleCounts.get(scenario.title.trim().toLowerCase()) ?? 0) > 1) {
      add(
        'duplicate-title',
        'scenario',
        scenario,
        'Another scenario shares this title'
      )
    }

    if (source?.sourceType === 'tv-show' && !scenario.episode?.label) {
      add(
        'tv-episode-missing',
        'scenario',
        scenario,
        `${source.title} is a TV show`
      )
    }

    if (scenario.riskFamilyIds.length > AUDIT_LIMITS.riskFamilies) {
      add(
        'risk-family-count',
        'scenario',
        scenario,
        `${scenario.riskFamilyIds.length} risk families (most scenarios need one or two)`
      )
    }

    if (scenario.conceptIds.length > AUDIT_LIMITS.concepts) {
      add(
        'concept-count',
        'scenario',
        scenario,
        `${scenario.conceptIds.length} concepts (soft cap ${AUDIT_LIMITS.concepts})`
      )
    }

    if (!scenario.video) {
      add('clip-missing', 'scenario', scenario, 'No YouTube clip')
    }

    checkImage(scenario.image, AUDIT_LIMITS.stillAspect, (rule, detail) =>
      add(rule, 'scenario', scenario, detail)
    )

    const luminance = options.stillLuminance?.get(scenario.id)
    if (luminance !== undefined && luminance < AUDIT_LIMITS.stillMinLuminance) {
      add(
        'still-dark',
        'scenario',
        scenario,
        `Mean luminance ${luminance.toFixed(2)}`
      )
    }

    if (
      source &&
      scenario.image.alt !== scenarioImageAlt(source.title, scenario.title)
    ) {
      add(
        'caption-alt-text',
        'scenario',
        scenario,
        `Image caption became alt text: “${scenario.image.alt}”`
      )
    }

    const ownTitles = [
      source?.title ?? '',
      ...(source?.franchiseIds ?? []).map(
        (id) => franchisesById.get(id)?.title ?? ''
      )
    ].map((title) => title.toLowerCase())
    const prose = [scenario.scene, scenario.whyAnalogyWorks, scenario.caveats]
    for (const { source: other, name } of sourceTitleMentions) {
      if (other.id === scenario.sourceId) continue
      if (ownTitles.some((title) => title.includes(name.toLowerCase()))) {
        continue
      }
      if (prose.some((text) => containsPhrase(text, name))) {
        add(
          'prose-names-other-source',
          'scenario',
          scenario,
          `Mentions “${name}”; check it belongs in this scenario`
        )
      }
    }
  }

  const scenarioCountBySource = countBy(snapshot.scenarios, (s) => s.sourceId)
  for (const source of snapshot.sources) {
    if (!inSourceScope(source)) continue
    if (!source.youtubeTrailerUrl) {
      add('trailer-missing', 'source', source, 'No YouTube trailer')
    }
    if (!source.poster) {
      add('poster-missing', 'source', source, 'No page-body image')
    } else if (source.poster.alt !== sourcePosterAlt(source.title)) {
      add(
        'caption-alt-text',
        'source',
        source,
        `Image caption became alt text: “${source.poster.alt}”`
      )
    }
    if (!scenarioCountBySource.get(source.id)) {
      add(
        'source-without-scenarios',
        'source',
        source,
        'No scenarios reference this source'
      )
    }
  }

  if (!scoped) {
    for (const franchise of snapshot.franchises) {
      checkImage(
        franchise.image,
        AUDIT_LIMITS.franchiseAspect,
        (rule, detail) => {
          if (rule === 'still-aspect') {
            add('franchise-image-aspect', 'franchise', franchise, detail)
          }
        }
      )
    }
  }

  const usage = new Map<string, { scenarios: number; primary: number }>()
  for (const scenario of snapshot.scenarios) {
    scenario.conceptIds.forEach((id, index) => {
      const entry = usage.get(id) ?? { scenarios: 0, primary: 0 }
      entry.scenarios += 1
      if (index === 0) entry.primary += 1
      usage.set(id, entry)
    })
  }

  return {
    findings,
    stats: {
      scenarios: snapshot.scenarios.length,
      sources: snapshot.sources.length,
      featured: snapshot.scenarios.filter((s) => s.tags.includes('featured'))
        .length,
      conceptCounts: Object.fromEntries(
        countBy(snapshot.scenarios, (s) => s.conceptIds.length)
      ),
      riskFamilyCounts: Object.fromEntries(
        countBy(snapshot.scenarios, (s) => s.riskFamilyIds.length)
      ),
      conceptUsage: snapshot.concepts
        .map((concept) => ({
          title: concept.shortName,
          slug: concept.slug,
          scenarios: usage.get(concept.id)?.scenarios ?? 0,
          primary: usage.get(concept.id)?.primary ?? 0
        }))
        .toSorted((a, b) => b.scenarios - a.scenarios)
    }
  }
}

function checkImage(
  image: ContentImage,
  [minAspect, maxAspect]: readonly [number, number],
  report: (rule: 'still-small' | 'still-aspect', detail: string) => void
) {
  if (image.width < AUDIT_LIMITS.stillMinWidth) {
    report('still-small', `${image.width} × ${image.height}`)
  }
  const aspect = image.width / image.height
  if (aspect < minAspect || aspect > maxAspect) {
    report(
      'still-aspect',
      `${image.width} × ${image.height} (${aspect.toFixed(2)}:1)`
    )
  }
}

/** Strips disambiguators such as “(2005 film)” from a source title. */
function displayTitle(title: string) {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function containsPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    'u'
  ).test(text)
}

function countBy<T, K>(items: readonly T[], key: (item: T) => K) {
  const counts = new Map<K, number>()
  for (const item of items) {
    const value = key(item)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

export function notionUrl(id: string) {
  return `https://app.notion.com/p/${id.replaceAll('-', '')}`
}

export function formatAuditMarkdown(
  audit: ContentAudit,
  { limit }: { limit: number }
): string {
  const lines: string[] = ['# Content audit', '']
  const { stats } = audit
  const total = stats.scenarios
  const inRange = (stats.conceptCounts[2] ?? 0) + (stats.conceptCounts[3] ?? 0)
  lines.push(
    `${total} scenarios, ${stats.sources} sources, ${stats.featured} tagged featured.`,
    `Concepts per scenario: ${formatDistribution(stats.conceptCounts)} (${percent(inRange, total)} have the recommended two or three).`,
    `Risk families per scenario: ${formatDistribution(stats.riskFamilyCounts)}.`,
    ''
  )

  const byRule = new Map(
    [...Map.groupBy(audit.findings, (finding) => finding.rule)].toSorted(
      ([ruleA, a], [ruleB, b]) =>
        Number(RULE_SEVERITY[ruleA] === 'review') -
          Number(RULE_SEVERITY[ruleB] === 'review') || b.length - a.length
    )
  )
  if (byRule.size === 0) {
    lines.push('No findings.')
  } else {
    lines.push('| Rule | Severity | Count |', '| --- | --- | --- |')
    for (const [rule, findings] of byRule) {
      lines.push(
        `| \`${rule}\` | ${RULE_SEVERITY[rule]} | ${findings.length} |`
      )
    }
    for (const [rule, findings] of byRule) {
      lines.push('', `## \`${rule}\` (${RULE_SEVERITY[rule]})`, '')
      for (const finding of findings.slice(0, limit)) {
        lines.push(
          `- [${finding.title}](${notionUrl(finding.id)}) \`${finding.slug}\`: ${finding.detail}`
        )
      }
      if (findings.length > limit) {
        lines.push(`- …and ${findings.length - limit} more (raise \`--limit\`)`)
      }
    }
  }

  const usage = stats.conceptUsage
  lines.push(
    '',
    '## Concept usage',
    '',
    `Most used: ${usage
      .slice(0, 8)
      .map((c) => `${c.title} ${c.scenarios} (${c.primary} primary)`)
      .join(', ')}.`,
    `Least used: ${usage
      .slice(-8)
      .map((c) => `${c.title} ${c.scenarios}`)
      .join(', ')}.`
  )
  return `${lines.join('\n')}\n`
}

function formatDistribution(counts: Readonly<Record<number, number>>) {
  return Object.entries(counts)
    .toSorted(([a], [b]) => Number(a) - Number(b))
    .map(([count, scenarios]) => `${count}→${scenarios}`)
    .join(', ')
}

function percent(part: number, whole: number) {
  return `${whole === 0 ? 0 : Math.round((part / whole) * 100)}%`
}

async function readStillLuminance(snapshot: ContentSnapshot) {
  const entries = await Promise.all(
    snapshot.scenarios.map(async (scenario) => {
      const base64 = scenario.image.blurDataURL.split(',')[1] ?? ''
      const { channels } = await sharp(Buffer.from(base64, 'base64'))
        .removeAlpha()
        .stats()
      const [r, g, b] = channels.map((channel) => channel.mean / 255)
      return [scenario.id, 0.2126 * r! + 0.7152 * g! + 0.0722 * b!] as const
    })
  )
  return new Map(entries)
}

async function main() {
  const { values } = parseArgs({
    options: {
      json: { type: 'boolean', default: false },
      limit: { type: 'string', default: '25' },
      scenario: { type: 'string', multiple: true },
      source: { type: 'string', multiple: true },
      help: { type: 'boolean', short: 'h', default: false }
    }
  })

  if (values.help) {
    console.log(`Usage: pnpm content:audit [options]

Report snapshot drift from docs/notion-cms.md. Reads the committed snapshot;
run a content sync first to audit the latest Notion edits.

Options:
  --scenario <slug>  Limit record findings to a scenario (repeatable)
  --source <slug>    Limit record findings to a source and its scenarios (repeatable)
  --limit <n>        Findings listed per rule in Markdown (default 25)
  --json             Print every finding as JSON
  -h, --help         Show this help message`)
    return
  }

  const projectRoot = fileURLToPath(new URL('..', import.meta.url))
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(
      await readFile(join(projectRoot, 'content/snapshot', name), 'utf8')
    )

  const snapshot = validateContentSnapshot({
    schemaVersion: 3,
    scenarios: await read('scenarios.json'),
    sources: await read('sources.json'),
    franchises: await read('franchises.json'),
    riskFamilies: await read('risk-families.json'),
    concepts: await read('concepts.json')
  })

  const scenarioSlugs = values.scenario ? new Set(values.scenario) : undefined
  const sourceSlugs = values.source ? new Set(values.source) : undefined
  for (const slug of scenarioSlugs ?? []) {
    if (!snapshot.scenarios.some((s) => s.slug === slug)) {
      throw new Error(`Unknown scenario slug: ${slug}`)
    }
  }
  for (const slug of sourceSlugs ?? []) {
    if (!snapshot.sources.some((s) => s.slug === slug)) {
      throw new Error(`Unknown source slug: ${slug}`)
    }
  }

  const audit = auditContent(snapshot, {
    stillLuminance: await readStillLuminance(snapshot),
    scope:
      scenarioSlugs || sourceSlugs ? { scenarioSlugs, sourceSlugs } : undefined
  })

  if (values.json) {
    console.log(JSON.stringify(audit, null, 2))
  } else {
    const limit = Number.parseInt(values.limit, 10)
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(
        `--limit must be a positive integer, received ${values.limit}`
      )
    }
    process.stdout.write(formatAuditMarkdown(audit, { limit }))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
