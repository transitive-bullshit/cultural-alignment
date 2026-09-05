import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { workspaceDirectory, type ArchiveComparisonCase } from './selection'
import type { ArchiveV3RevisedResult, ArchiveV3RunManifest } from './v3-runner'

const minimumReviewPreviewFontPx = 18

type PreviewReader = (path: string) => Promise<string>
type VersionName = 'v3' | 'v4' | 'v5'
type VersionState = 'verified' | 'invalid' | 'blocked' | 'failed' | 'pending'
type TypographyContract = 'legacy' | 'impact' | 'thin-balanced-impact'

interface ComparisonVersionSpec {
  readonly key: VersionName
  readonly label: string
  readonly heading: string
  readonly typography: TypographyContract
}

interface ComparisonPresentation {
  readonly title: string
  readonly heading: string
  readonly explanation: string
  readonly changeSummary: string
  readonly left: ComparisonVersionSpec
  readonly right: ComparisonVersionSpec
}

export interface ImpactComparisonReportOptions {
  readonly v3Manifest: ArchiveV3RunManifest
  readonly v4Manifest: ArchiveV3RunManifest
  readonly expectedCaseCount?: number
  readonly readPreview?: PreviewReader
}

export interface WriteImpactComparisonReportOptions {
  readonly v3ManifestPath: string
  readonly v4ManifestPath: string
  readonly outputPath?: string
  readonly expectedCaseCount?: number
}

export interface StrokeWrapComparisonReportOptions {
  readonly v4Manifest: ArchiveV3RunManifest
  readonly v5Manifest: ArchiveV3RunManifest
  readonly expectedCaseCount?: number
  readonly readPreview?: PreviewReader
}

export interface WriteStrokeWrapComparisonReportOptions {
  readonly v4ManifestPath: string
  readonly v5ManifestPath: string
  readonly outputPath?: string
  readonly expectedCaseCount?: number
}

interface ResolvedVersion {
  readonly result: ArchiveV3RevisedResult | null
  readonly preview: string | null
  readonly verified: boolean
  readonly state: VersionState
}

interface ResolvedComparison {
  readonly comparisonCase: ArchiveComparisonCase
  readonly index: number
  readonly v3: ResolvedVersion
  readonly v4: ResolvedVersion
  readonly ready: boolean
}

export const defaultImpactComparisonReportPath = join(
  workspaceDirectory,
  'docs',
  'skills',
  'ai-safety-meme-creator',
  'archive-impact-comparison.html'
)

export const defaultStrokeWrapComparisonReportPath = join(
  workspaceDirectory,
  'docs',
  'skills',
  'ai-safety-meme-creator',
  'archive-stroke-wrap-comparison.html'
)

const impactPresentation: ComparisonPresentation = {
  title: 'AI safety meme · V3 / V4 comparison',
  heading: 'V3 baseline / V4 Impact pass',
  explanation:
    'Ready means both images exist and both manifests pass the strict mechanical render checks. WIP rows are hidden by default.',
  changeSummary:
    'V4 is the all-caps Impact pass with white text and a black stroke. This page does not treat a generated file as proof that a pair is reviewable.',
  left: {
    key: 'v3',
    label: 'V3',
    heading: 'V3 · baseline',
    typography: 'legacy'
  },
  right: {
    key: 'v4',
    label: 'V4',
    heading: 'V4 · Impact pass',
    typography: 'impact'
  }
}

const strokeWrapPresentation: ComparisonPresentation = {
  title: 'AI safety meme · V4 / V5 comparison',
  heading: 'V4 baseline / V5 thinner stroke + balanced wrap',
  explanation:
    'Ready means both images exist and both manifests pass the strict mechanical render checks. WIP rows are hidden by default.',
  changeSummary:
    'V5 reduces the default Impact outline from 0.10em to 0.05em and balances non-code multiline captions. Semantic copy and code wrapping are unchanged.',
  left: {
    key: 'v4',
    label: 'V4',
    heading: 'V4 · baseline',
    typography: 'impact'
  },
  right: {
    key: 'v5',
    label: 'V5',
    heading: 'V5 · thin stroke + balanced wrap',
    typography: 'thin-balanced-impact'
  }
}

export async function buildImpactComparisonHtml(
  options: ImpactComparisonReportOptions
): Promise<string> {
  return buildComparisonHtml({ ...options, presentation: impactPresentation })
}

export async function buildStrokeWrapComparisonHtml({
  v4Manifest,
  v5Manifest,
  expectedCaseCount,
  readPreview
}: StrokeWrapComparisonReportOptions): Promise<string> {
  validateComparableIntents(v4Manifest, v5Manifest)
  return buildComparisonHtml({
    v3Manifest: v4Manifest,
    v4Manifest: v5Manifest,
    expectedCaseCount,
    readPreview,
    presentation: strokeWrapPresentation
  })
}

async function buildComparisonHtml({
  v3Manifest,
  v4Manifest,
  expectedCaseCount = 50,
  readPreview = previewDataUri,
  presentation
}: ImpactComparisonReportOptions & {
  readonly presentation: ComparisonPresentation
}): Promise<string> {
  requirePositiveInteger(expectedCaseCount, 'Expected case count')
  validateManifest(v3Manifest, presentation.left.label)
  validateManifest(v4Manifest, presentation.right.label)
  if (v3Manifest.case_count !== expectedCaseCount) {
    throw new Error(
      `${presentation.left.label} baseline must contain exactly ${expectedCaseCount} cases; found ${v3Manifest.case_count}`
    )
  }

  const canonicalCases = new Map(
    v3Manifest.selection.cases.map((comparisonCase) => [
      comparisonCase.case_id,
      comparisonCase
    ])
  )
  validateCandidateIdentities(
    v4Manifest,
    canonicalCases,
    presentation.right.label
  )

  const v3Results = resultsByCase(v3Manifest)
  const v4Results = resultsByCase(v4Manifest)
  const comparisons = await Promise.all(
    v3Manifest.selection.cases.map(async (comparisonCase, index) => {
      const [v3, v4] = await Promise.all([
        resolveVersion(
          presentation.left,
          v3Results.get(comparisonCase.case_id),
          readPreview
        ),
        resolveVersion(
          presentation.right,
          v4Results.get(comparisonCase.case_id),
          readPreview
        )
      ])
      return {
        comparisonCase,
        index,
        v3,
        v4,
        ready: v3.verified && v4.verified
      } satisfies ResolvedComparison
    })
  )
  const readyCount = comparisons.filter(({ ready }) => ready).length
  const wipCount = comparisons.length - readyCount

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(presentation.title)}</title>
<style>
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #111; background: #f2f2f2; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  header, main { width: min(1500px, calc(100% - 24px)); margin-inline: auto; }
  header { padding: 20px 0 12px; }
  h1 { margin: 0 0 6px; font-size: 24px; }
  p { margin: 5px 0; }
  .quiet { color: #555; font-size: 13px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 12px 0; font-size: 13px; }
  .controls { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; padding: 9px 0; background: #f2f2f2; }
  input, select { min-height: 36px; border: 1px solid #999; border-radius: 4px; background: white; padding: 6px 9px; font: inherit; }
  input { flex: 1; min-width: 0; }
  .case { margin: 0 0 16px; overflow: hidden; border: 1px solid #aaa; border-radius: 5px; background: white; }
  .case-head { padding: 10px 12px; border-bottom: 1px solid #ddd; }
  .case-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 9px; }
  h2 { margin: 0; font-size: 16px; }
  .badge { display: inline-block; border: 1px solid currentColor; border-radius: 999px; padding: 1px 7px; font-size: 11px; }
  .ready, .verified { color: #176b34; }
  .wip, .pending { color: #7a5300; }
  .invalid, .blocked, .failed { color: #a12d22; }
  .feedback { margin-top: 7px; padding-left: 8px; border-left: 3px solid #bbb; font-size: 13px; }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .version { min-width: 0; padding: 10px; }
  .version + .version { border-left: 1px solid #ddd; }
  .version[data-state="invalid"], .version[data-state="blocked"], .version[data-state="failed"] { background: #fff8ef; }
  .version[data-state="verified"] { background: #f6fff8; }
  h3 { margin: 0 0 7px; font-size: 14px; }
  h3 .badge { margin-left: 6px; }
  img, .missing { display: block; width: 100%; aspect-ratio: 3 / 2; background: #111; object-fit: contain; }
  .missing { display: grid; place-items: center; padding: 18px; color: white; text-align: center; }
  .caption, .metrics, details { font-size: 12px; }
  .caption { white-space: pre-line; }
  .metrics { color: #444; }
  details ul { margin: 5px 0 0; padding-left: 19px; }
  [hidden] { display: none !important; }
  @media (max-width: 800px) {
    .pair { grid-template-columns: 1fr; }
    .version + .version { border-left: 0; border-top: 1px solid #ddd; }
    .controls { flex-wrap: wrap; }
    input { flex-basis: 100%; }
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(presentation.heading)}</h1>
  <p>${escapeHtml(presentation.explanation)}</p>
  <p class="quiet">${escapeHtml(presentation.changeSummary)}</p>
  <div class="summary" data-report-summary data-ready-count="${readyCount}" data-wip-count="${wipCount}">
    <span>${comparisons.length} scenes</span>
    <span>${readyCount} ready for comparison</span>
    <span>${wipCount} WIP</span>
  </div>
  <div class="controls">
    <input id="search" type="search" placeholder="Filter scene, concept, caption, or feedback" aria-label="Filter comparisons">
    <select id="status" aria-label="Filter by comparison readiness">
      <option value="ready" selected>Ready for comparison</option>
      <option value="wip">WIP</option>
      <option value="all">All statuses</option>
    </select>
  </div>
</header>
<main data-comparison-list>
${comparisons.map((comparison) => renderComparison(comparison, presentation)).join('\n')}
</main>
<script>
  const search = document.querySelector('#search')
  const status = document.querySelector('#status')
  const rows = [...document.querySelectorAll('[data-comparison-row]')]
  const apply = () => {
    const query = search.value.trim().toLowerCase()
    for (const row of rows) {
      const statusMatch = status.value === 'all' || row.dataset.pairStatus === status.value
      const searchMatch = !query || row.dataset.search.includes(query)
      row.hidden = !(statusMatch && searchMatch)
    }
  }
  search.addEventListener('input', apply)
  status.addEventListener('change', apply)
  apply()
</script>
</body>
</html>
`
}

export async function writeImpactComparisonReport({
  v3ManifestPath,
  v4ManifestPath,
  outputPath = defaultImpactComparisonReportPath,
  expectedCaseCount = 50
}: WriteImpactComparisonReportOptions): Promise<string> {
  const [v3Source, v4Source] = await Promise.all([
    readFile(v3ManifestPath, 'utf8'),
    readFile(v4ManifestPath, 'utf8')
  ])
  const html = await buildImpactComparisonHtml({
    v3Manifest: JSON.parse(v3Source) as ArchiveV3RunManifest,
    v4Manifest: JSON.parse(v4Source) as ArchiveV3RunManifest,
    expectedCaseCount
  })
  await writeFile(outputPath, html, 'utf8')
  return outputPath
}

export async function writeStrokeWrapComparisonReport({
  v4ManifestPath,
  v5ManifestPath,
  outputPath = defaultStrokeWrapComparisonReportPath,
  expectedCaseCount = 50
}: WriteStrokeWrapComparisonReportOptions): Promise<string> {
  const [v4Source, v5Source] = await Promise.all([
    readFile(v4ManifestPath, 'utf8'),
    readFile(v5ManifestPath, 'utf8')
  ])
  const html = await buildStrokeWrapComparisonHtml({
    v4Manifest: JSON.parse(v4Source) as ArchiveV3RunManifest,
    v5Manifest: JSON.parse(v5Source) as ArchiveV3RunManifest,
    expectedCaseCount
  })
  await writeFile(outputPath, html, 'utf8')
  return outputPath
}

function renderComparison(
  { comparisonCase, index, v3, v4, ready }: ResolvedComparison,
  presentation: ComparisonPresentation
): string {
  const search = [
    comparisonCase.source_title,
    comparisonCase.scenario_title,
    comparisonCase.idea.ai_concept,
    comparisonCase.idea_id,
    ...comparisonCase.idea.caption_lines,
    comparisonCase.human_feedback ?? '',
    captionText(v3.result),
    captionText(v4.result),
    ...(v3.result?.violations ?? []),
    ...(v4.result?.violations ?? [])
  ]
    .join(' ')
    .toLowerCase()
  const status = ready ? 'ready' : 'wip'

  return `<article class="case" data-comparison-row data-case-id="${escapeHtml(comparisonCase.case_id)}" data-idea-id="${escapeHtml(comparisonCase.idea_id)}" data-cohort="${comparisonCase.cohort}" data-pair-status="${status}" data-search="${escapeHtml(search)}"${ready ? '' : ' hidden'}>
  <div class="case-head">
    <div class="case-title">
      <h2>${String(index + 1).padStart(2, '0')}. ${escapeHtml(comparisonCase.source_title)} · ${escapeHtml(comparisonCase.scenario_title)}</h2>
      <span class="badge ${status}">${ready ? 'Ready' : 'WIP'}</span>
      <span class="quiet">${escapeHtml(comparisonCase.idea.ai_concept)} · ${escapeHtml(comparisonCase.idea_id)}</span>
    </div>
    <p class="quiet"><strong>Archived copy:</strong> ${comparisonCase.idea.caption_lines.map(escapeHtml).join(' / ')}</p>
    ${renderFeedback(comparisonCase)}
  </div>
  <div class="pair">
    ${renderVersion(presentation.left, v3)}
    ${renderVersion(presentation.right, v4)}
  </div>
</article>`
}

function renderVersion(
  version: ComparisonVersionSpec,
  resolved: ResolvedVersion
): string {
  const stateLabel =
    resolved.state === 'verified' ? 'verified' : resolved.state.toUpperCase()
  const result = resolved.result
  const image = resolved.preview
    ? `<a href="${escapeHtml(resolved.preview)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(resolved.preview)}" alt="${version.key.toUpperCase()} render" loading="lazy"></a>`
    : `<div class="missing">${escapeHtml(missingMessage(resolved))}</div>`
  const caption = captionText(result)
  const renderedLines = renderedLineText(result)
  const strokeWidths =
    result?.render_checks?.text_layers
      .map(({ stroke_width_px }) => stroke_width_px)
      .filter((width) => Number.isFinite(width) && width > 0) ?? []
  const strokeMetric = strokeWidths.length
    ? ` · ${Math.min(...strokeWidths)}–${Math.max(...strokeWidths)}px outline`
    : ''
  const metrics = result?.render_checks
    ? `<p class="metrics">${formatNumber(result.render_checks.minimum_preview_font_px)}px min type at 480px${strokeMetric} · ${formatNumber(result.render_checks.minimum_canvas_clearance_px)}px edge clearance · ${result.violations.length} invariant note${result.violations.length === 1 ? '' : 's'}</p>`
    : ''
  const details = result
    ? `<details><summary>Checks and notes</summary>${result.violations.length ? `<ul>${result.violations.map((violation) => `<li>${escapeHtml(violation)}</li>`).join('')}</ul>` : '<p>No invariant notes.</p>'}</details>`
    : ''

  return `<section class="version" data-version="${version.key}" data-state="${resolved.state}">
    <h3>${escapeHtml(version.heading)}<span class="badge ${resolved.state}">${stateLabel}</span></h3>
    ${image}
    ${metrics}
    ${caption ? `<p class="caption"><strong>Semantic copy:</strong> ${escapeHtml(caption)}</p>` : ''}
    ${renderedLines ? `<p class="caption"><strong>Rendered lines:</strong> ${escapeHtml(renderedLines)}</p>` : ''}
    ${details}
  </section>`
}

function renderFeedback(comparisonCase: ArchiveComparisonCase): string {
  if (comparisonCase.human_feedback) {
    return `<p class="feedback"><strong>Human feedback:</strong> ${escapeHtml(comparisonCase.human_feedback)}</p>`
  }
  return comparisonCase.cohort === 'finalized'
    ? '<p class="feedback"><strong>Human feedback:</strong> Finalized reference; no written note.</p>'
    : '<p class="feedback"><strong>Human feedback:</strong> Disliked direction; no written note.</p>'
}

async function resolveVersion(
  version: ComparisonVersionSpec,
  caseResult: ArchiveV3RunManifest['results'][number] | undefined,
  readPreview: PreviewReader
): Promise<ResolvedVersion> {
  if (!caseResult) {
    return { result: null, preview: null, verified: false, state: 'pending' }
  }
  const result = caseResult.revised
  const preview = await resolvePreview(result.preview_path, readPreview)
  const verified = isVerified(version.typography, result, preview)
  return {
    result,
    preview,
    verified,
    state: verified ? 'verified' : unverifiedState(result)
  }
}

function isVerified(
  typography: TypographyContract,
  result: ArchiveV3RevisedResult,
  preview: string | null
): boolean {
  const checks = result.render_checks
  return Boolean(
    result.status === 'complete' &&
    result.evaluation_pass &&
    preview &&
    result.render_sha256 &&
    result.preview_sha256 &&
    checks?.copy_preserved &&
    checks.glyph_overflow_px === 0 &&
    checks.zones_inside_canvas &&
    checks.minimum_preview_font_px >= minimumReviewPreviewFontPx &&
    checks.source_occupancy?.meets_review_floor === true &&
    checks.text_legibility_pass === true &&
    Array.isArray(checks.text_layers) &&
    checks.text_layers.length > 0 &&
    checks.text_layers.every(
      ({ legibility_pass }) => legibility_pass === true
    ) &&
    Array.isArray(checks.source_frames) &&
    checks.source_frames.length > 0 &&
    Array.isArray(checks.protected_regions) &&
    checks.protected_regions.every(
      ({ priority, visible_ratio, caption_overlap_px }) =>
        priority !== 'must' ||
        (visible_ratio >= 0.995 && caption_overlap_px === 0)
    ) &&
    (typography === 'legacy' ||
      hasRequestedImpactTypography(
        result,
        typography === 'thin-balanced-impact'
      ))
  )
}

function hasRequestedImpactTypography(
  result: ArchiveV3RevisedResult,
  requireThinBalanced: boolean
): boolean {
  const impactZoneIds =
    result.plan?.presentation.zones
      .filter(({ style }) => style === 'impact')
      .map(({ id }) => id) ?? null
  if (!impactZoneIds) return false
  if (impactZoneIds.length === 0) return true
  const layersByZone = new Map(
    result.render_checks?.text_layers.map((layer) => [layer.zone_id, layer]) ??
      []
  )
  return impactZoneIds.every((zoneId) => {
    const layer = layersByZone.get(zoneId)
    return Boolean(
      layer &&
      typeof layer.font_family === 'string' &&
      layer.font_family.toLowerCase() === 'impact' &&
      layer.display_transform === 'uppercase' &&
      layer.fill_color?.toLowerCase() === '#ffffff' &&
      layer.stroke_color?.toLowerCase() === '#000000' &&
      layer.stroke_pixel_count > 0 &&
      (!requireThinBalanced ||
        (layer.wrap_mode === 'balance' &&
          layer.stroke_width_em === 0.05 &&
          layer.stroke_width_px ===
            Math.max(1, Math.ceil(layer.font_size_px * 0.05)))) &&
      Array.isArray(layer.physical_lines) &&
      layer.physical_lines.every(
        (line) => line === line.toLocaleUpperCase('en-US')
      )
    )
  })
}

function unverifiedState(result: ArchiveV3RevisedResult): VersionState {
  if (result.status === 'blocked') return 'blocked'
  if (result.status === 'failed') return 'failed'
  return 'invalid'
}

function missingMessage(resolved: ResolvedVersion): string {
  if (!resolved.result) return 'Not generated yet'
  if (resolved.result.error) return resolved.result.error
  if (resolved.result.blocked_reason) {
    return `${resolved.result.blocked_reason.code}: ${resolved.result.blocked_reason.message}`
  }
  if (resolved.result.status === 'complete') return 'Preview is missing'
  if (resolved.result.status === 'invalid') return 'Invalid preview is missing'
  if (resolved.result.status === 'blocked') return 'Render was blocked'
  return 'Render failed'
}

function captionText(result: ArchiveV3RevisedResult | null): string {
  return (
    result?.plan?.caption_lines.map(({ text }) => text).join('\n') ??
    result?.intent?.caption_lines.map(({ text }) => text).join('\n') ??
    ''
  )
}

function renderedLineText(result: ArchiveV3RevisedResult | null): string {
  return (
    result?.render_checks?.text_layers
      .map(({ physical_lines }) => physical_lines.join(' / '))
      .join(' | ') ?? ''
  )
}

function resultsByCase(
  manifest: ArchiveV3RunManifest
): ReadonlyMap<string, ArchiveV3RunManifest['results'][number]> {
  return new Map(manifest.results.map((result) => [result.case_id, result]))
}

function validateManifest(manifest: ArchiveV3RunManifest, label: string): void {
  if (
    manifest.schema_version !== 1 ||
    !Number.isSafeInteger(manifest.case_count) ||
    manifest.case_count < 0 ||
    !manifest.selection ||
    !Array.isArray(manifest.selection.cases) ||
    !Array.isArray(manifest.results)
  ) {
    throw new Error(`${label} manifest is missing required fields`)
  }
  if (
    manifest.case_count !== manifest.selection.cases.length ||
    manifest.case_count !== manifest.results.length
  ) {
    throw new Error(
      `${label} manifest declares ${manifest.case_count} cases but contains ${manifest.selection.cases.length} selections and ${manifest.results.length} results`
    )
  }

  const selected = new Map<string, string>()
  const selectedIdeas = new Set<string>()
  for (const comparisonCase of manifest.selection.cases) {
    if (
      selected.has(comparisonCase.case_id) ||
      selectedIdeas.has(comparisonCase.idea_id)
    ) {
      throw new Error(`${label} manifest contains duplicate case identities`)
    }
    selected.set(comparisonCase.case_id, comparisonCase.idea_id)
    selectedIdeas.add(comparisonCase.idea_id)
  }
  const seenResults = new Set<string>()
  for (const result of manifest.results) {
    if (seenResults.has(result.case_id)) {
      throw new Error(`${label} manifest contains duplicate case results`)
    }
    if (selected.get(result.case_id) !== result.idea_id) {
      throw new Error(
        `${label} result ${result.idea_id} does not match its selected case identity`
      )
    }
    seenResults.add(result.case_id)
  }
}

function validateCandidateIdentities(
  manifest: ArchiveV3RunManifest,
  canonicalCases: ReadonlyMap<string, ArchiveComparisonCase>,
  label: string
): void {
  for (const comparisonCase of manifest.selection.cases) {
    const canonical = canonicalCases.get(comparisonCase.case_id)
    if (!canonical || canonical.idea_id !== comparisonCase.idea_id) {
      throw new Error(
        `${label} manifest contains unknown case identity ${comparisonCase.case_id}/${comparisonCase.idea_id}`
      )
    }
  }
}

function validateComparableIntents(
  baseline: ArchiveV3RunManifest,
  candidate: ArchiveV3RunManifest
): void {
  const baselineCases = new Map(
    baseline.selection.cases.map((comparisonCase) => [
      comparisonCase.case_id,
      comparisonCase
    ])
  )
  for (const comparisonCase of candidate.selection.cases) {
    const baselineCase = baselineCases.get(comparisonCase.case_id)
    if (
      !baselineCase ||
      JSON.stringify(baselineCase) !== JSON.stringify(comparisonCase)
    ) {
      throw new Error(
        `V5 changed the archived selection for ${comparisonCase.case_id}`
      )
    }
  }

  const baselineResults = resultsByCase(baseline)
  for (const caseResult of candidate.results) {
    const baselineResult = baselineResults.get(caseResult.case_id)
    if (
      !baselineResult ||
      JSON.stringify(baselineResult.revised.intent) !==
        JSON.stringify(caseResult.revised.intent)
    ) {
      throw new Error(`V5 changed semantic intent for ${caseResult.case_id}`)
    }
  }
}

async function resolvePreview(
  path: string | null,
  readPreview: PreviewReader
): Promise<string | null> {
  if (!path) return null
  try {
    return await readPreview(path)
  } catch {
    return null
  }
}

async function previewDataUri(path: string): Promise<string> {
  const extension = extname(path).toLowerCase()
  const mime =
    extension === '.webp'
      ? 'image/webp'
      : extension === '.png'
        ? 'image/png'
        : 'image/jpeg'
  return `data:${mime};base64,${(await readFile(path)).toString('base64')}`
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export async function runImpactComparisonReportCli(
  args: readonly string[] = process.argv.slice(2)
): Promise<string> {
  if (args.length < 2 || args.length > 3) {
    throw new Error(
      'Usage: node --import tsx impact-comparison-report.ts <immutable-v3-manifest.json> <v4-manifest.json> [output.html]'
    )
  }
  const [v3ManifestPath, v4ManifestPath, outputPath] = args
  return writeImpactComparisonReport({
    v3ManifestPath: resolve(v3ManifestPath!),
    v4ManifestPath: resolve(v4ManifestPath!),
    outputPath: outputPath ? resolve(outputPath) : undefined
  })
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await runImpactComparisonReportCli())
}
