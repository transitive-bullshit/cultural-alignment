import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { archiveAbReportPath } from './report'
import {
  defaultArchiveV3ArtifactRoot,
  type ArchiveV3RevisedResult,
  type ArchiveV3RunManifest
} from './v3-runner'

interface RecoveryOptions {
  readonly htmlPath?: string
  readonly manifestPath?: string
  readonly backupPath?: string
  readonly expectedCaseCount?: number
}

export interface RecoveryResult {
  readonly htmlPath: string
  readonly backupPath: string
  readonly rowCount: number
  readonly readyCount: number
  readonly verifiedRevisedCount: number
  readonly producedRevisedCount: number
}

interface HtmlBlock {
  readonly start: number
  readonly end: number
  readonly html: string
}

interface ResolvedRevision {
  readonly result: ArchiveV3RevisedResult
  readonly preview: string | null
}

interface RecoveredRow {
  readonly html: string
  readonly ready: boolean
  readonly verified: boolean
  readonly copyDiffers: boolean
  readonly templateDiffers: boolean
}

const rowMarker = '<article class="case" data-comparison-row'
const variantMarker = (variant: string) => `data-variant="${variant}"`
const minimumReviewPreviewFontPx = 18

export async function recoverArchiveComparisonReport({
  htmlPath = archiveAbReportPath,
  manifestPath = join(defaultArchiveV3ArtifactRoot, 'run-manifest.json'),
  backupPath = defaultBackupPath(htmlPath),
  expectedCaseCount = 50
}: RecoveryOptions = {}): Promise<RecoveryResult> {
  const [originalHtml, manifestSource] = await Promise.all([
    readFile(htmlPath, 'utf8'),
    readFile(manifestPath, 'utf8')
  ])
  const manifest = parseManifest(manifestSource)
  const rows = locateBlocks(originalHtml, rowMarker, '</article>')
  validateInputs(manifest, rows, expectedCaseCount)

  const revisions = new Map<string, ResolvedRevision>()
  for (const result of manifest.results) {
    revisions.set(result.idea_id, {
      result: result.revised,
      preview: await readPreview(result.revised.preview_path)
    })
  }

  const casesByIdea = new Map(
    manifest.selection.cases.map(({ case_id, idea_id }) => [
      idea_id,
      { caseId: case_id, ideaId: idea_id }
    ])
  )
  const recoveredRows: string[] = []
  const seenIdeas = new Set<string>()
  let readyCount = 0
  let verifiedRevisedCount = 0
  let producedRevisedCount = 0
  let revisedNotes = 0
  let copyDifferences = 0
  let templateDifferences = 0

  for (const block of rows) {
    const matchedCase = identifyCase(block.html, casesByIdea)
    if (seenIdeas.has(matchedCase.ideaId)) {
      throw new Error(`Duplicate comparison row for ${matchedCase.ideaId}`)
    }
    seenIdeas.add(matchedCase.ideaId)
    const revision = revisions.get(matchedCase.ideaId)
    if (!revision) {
      throw new Error(`Missing v3 result for ${matchedCase.ideaId}`)
    }
    const recovered = recoverRow(block.html, matchedCase, revision)
    recoveredRows.push(recovered.html)
    if (recovered.ready) readyCount += 1
    if (recovered.verified) verifiedRevisedCount += 1
    if (revision.preview) producedRevisedCount += 1
    revisedNotes += revision.result.violations.length
    if (recovered.copyDiffers) copyDifferences += 1
    if (recovered.templateDiffers) templateDifferences += 1
  }

  let recoveredHtml = replaceBlocks(originalHtml, rows, recoveredRows)
  recoveredHtml = replaceSummary(recoveredHtml, {
    rowCount: rows.length,
    readyCount,
    verifiedRevisedCount,
    producedRevisedCount,
    copyDifferences,
    templateDifferences,
    revisedNotes,
    codexVersion: manifest.codex_version,
    requestedModel: manifest.requested_model
  })

  if (resolve(backupPath) === resolve(htmlPath)) {
    throw new Error('Backup path must differ from the report path')
  }
  await copyFile(htmlPath, backupPath, constants.COPYFILE_EXCL)
  const temporaryPath = join(
    dirname(htmlPath),
    `.${basename(htmlPath)}.${randomUUID()}.tmp`
  )
  try {
    await writeFile(temporaryPath, recoveredHtml, 'utf8')
    await rename(temporaryPath, htmlPath)
  } catch (err) {
    await rm(temporaryPath, { force: true })
    throw err
  }

  return {
    htmlPath,
    backupPath,
    rowCount: rows.length,
    readyCount,
    verifiedRevisedCount,
    producedRevisedCount
  }
}

function parseManifest(source: string): ArchiveV3RunManifest {
  const value = JSON.parse(source) as Partial<ArchiveV3RunManifest>
  if (
    value.schema_version !== 1 ||
    !Number.isSafeInteger(value.case_count) ||
    !Array.isArray(value.results) ||
    !value.selection ||
    !Array.isArray(value.selection.cases)
  ) {
    throw new Error('V3 run manifest is missing required fields')
  }
  if (value.results.length !== value.case_count) {
    throw new Error(
      `V3 manifest declares ${value.case_count} cases but contains ${value.results.length} results`
    )
  }
  if (value.selection.cases.length !== value.case_count) {
    throw new Error(
      `V3 manifest declares ${value.case_count} cases but selects ${value.selection.cases.length}`
    )
  }
  const selected = new Map(
    value.selection.cases.map(({ case_id, idea_id }) => [idea_id, case_id])
  )
  if (selected.size !== value.case_count) {
    throw new Error('V3 manifest contains duplicate selected idea IDs')
  }
  for (const result of value.results) {
    if (selected.get(result.idea_id) !== result.case_id) {
      throw new Error(
        `V3 result ${result.idea_id} does not match the selected case identity`
      )
    }
  }
  return value as ArchiveV3RunManifest
}

function validateInputs(
  manifest: ArchiveV3RunManifest,
  rows: readonly HtmlBlock[],
  expectedCaseCount: number
): void {
  if (
    manifest.case_count !== expectedCaseCount ||
    rows.length !== expectedCaseCount
  ) {
    throw new Error(
      `Report recovery requires exactly ${expectedCaseCount} cases; page has ${rows.length} and manifest has ${manifest.case_count}`
    )
  }
  if (rows.length !== manifest.case_count) {
    throw new Error(
      `Comparison page has ${rows.length} rows but the v3 manifest has ${manifest.case_count}; refusing a partial recovery`
    )
  }
  if (rows.length === 0) {
    throw new Error('Comparison page contains no data-comparison-row blocks')
  }
}

function identifyCase(
  row: string,
  casesByIdea: ReadonlyMap<
    string,
    { readonly caseId: string; readonly ideaId: string }
  >
): { readonly caseId: string; readonly ideaId: string } {
  const hookedIdea = readAttribute(openingTag(row), 'data-idea-id')
  if (hookedIdea) {
    const matched = casesByIdea.get(hookedIdea)
    if (!matched) throw new Error(`Unknown hooked idea ID ${hookedIdea}`)
    const hookedCase = readAttribute(openingTag(row), 'data-case-id')
    if (hookedCase && hookedCase !== matched.caseId) {
      throw new Error(
        `Hooked case ID ${hookedCase} does not match ${matched.caseId}`
      )
    }
    return matched
  }
  const matches = [...casesByIdea.values()].filter(({ ideaId }) =>
    row.includes(` · ${escapeHtml(ideaId)}</span>`)
  )
  if (matches.length !== 1) {
    throw new Error(
      `Expected one manifest identity in comparison row; found ${matches.length}`
    )
  }
  return matches[0]!
}

function recoverRow(
  row: string,
  identity: { readonly caseId: string; readonly ideaId: string },
  revision: ResolvedRevision
): RecoveredRow {
  const current = locateSingleBlock(row, variantMarker('current'), '</section>')
  const proposed = locateSingleBlock(
    row,
    variantMarker('proposed'),
    '</section>'
  )
  const revised = locateSingleBlock(row, variantMarker('revised'), '</section>')
  const verified = isVerifiedRevision(revision)
  const historicalAvailable = [current, proposed].every(
    ({ html }) =>
      readAttribute(openingTag(html), 'data-status') === 'complete' &&
      /<img\b/.test(html)
  )
  const ready = historicalAvailable && verified
  const captions = [
    readClassContent(current.html, 'caption'),
    readClassContent(proposed.html, 'caption'),
    revisionCaption(revision.result)
  ].filter((caption): caption is string => Boolean(caption))
  const templates = [
    readPlanTemplate(current.html),
    readPlanTemplate(proposed.html),
    revision.result.plan?.presentation.template
  ].filter((template): template is string => Boolean(template))
  const historicalNotes =
    countOccurrences(current.html, '<li>') +
    countOccurrences(proposed.html, '<li>')
  const historicalFailure = [current, proposed].some(({ html }) =>
    ['failed', 'blocked'].includes(
      readAttribute(openingTag(html), 'data-status') ?? ''
    )
  )

  let recovered = `${row.slice(0, revised.start)}${renderRevision(revision, verified)}${row.slice(revised.end)}`
  let tag = openingTag(recovered)
  tag = setAttribute(tag, 'data-case-id', identity.caseId)
  tag = setAttribute(tag, 'data-idea-id', identity.ideaId)
  tag = setAttribute(tag, 'data-pair-status', ready ? 'ready' : 'wip')
  tag = setAttribute(tag, 'data-copy', String(valuesDiffer(captions)))
  tag = setAttribute(tag, 'data-template', String(valuesDiffer(templates)))
  tag = setAttribute(
    tag,
    'data-notes',
    String(historicalNotes + revision.result.violations.length > 0)
  )
  tag = setAttribute(
    tag,
    'data-revised-invalid',
    String(
      revision.result.status === 'invalid' ||
        (revision.result.status === 'complete' && !verified)
    )
  )
  tag = setAttribute(
    tag,
    'data-failure',
    String(
      historicalFailure ||
        ['blocked', 'failed'].includes(revision.result.status)
    )
  )
  tag = setAttribute(tag, 'data-search', searchableRow(recovered, revision))
  recovered = `${tag}${recovered.slice(openingTag(recovered).length)}`
  recovered = recovered.replace(
    /<span class="badge pair-(?:ready|wip)">(?:ready|WIP)<\/span>/,
    `<span class="badge pair-${ready ? 'ready' : 'wip'}">${ready ? 'ready' : 'WIP'}</span>`
  )

  return {
    html: recovered,
    ready,
    verified,
    copyDiffers: valuesDiffer(captions),
    templateDiffers: valuesDiffer(templates)
  }
}

function renderRevision(
  { result, preview }: ResolvedRevision,
  verified: boolean
): string {
  const validation = revisionValidation(result, verified)
  const state = revisionStateLabel(validation)
  if (!preview) {
    const detail = result.blocked_reason
      ? `${result.blocked_reason.code}: ${result.blocked_reason.message}`
      : result.error || missingRevisionMessage(result.status)
    return `<section class="variant" data-variant="revised" data-status="${result.status}" data-validation="${validation}">
      <h3>V3 · revised<span class="badge result-state ${validation}">${state}</span></h3>
      <div class="missing">${escapeHtml(detail)}</div>
    </section>`
  }
  const plan = result.plan
  const caption = revisionCaption(result)
  const rationale = plan?.why_it_works
  const details = result.violations.length
    ? `<ul>${result.violations.map((violation) => `<li>${escapeHtml(violation)}</li>`).join('')}</ul>`
    : '<p>None reported by the shared harness.</p>'
  return `<section class="variant" data-variant="revised" data-status="${result.status}" data-validation="${validation}">
    <h3>V3 · revised<span class="badge result-state ${validation}">${state}</span></h3>
    <a href="${preview}" target="_blank" rel="noreferrer"><img src="${preview}" alt="revised render" loading="lazy"></a>
    ${plan ? renderPlanSummary(result) : `<p class="plan">${result.violations.length} invariant note${result.violations.length === 1 ? '' : 's'}</p>`}
    ${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ''}
    <details><summary>Render details and invariant notes</summary>
      ${rationale ? `<p>${escapeHtml(rationale)}</p>` : ''}
      ${details}
    </details>
  </section>`
}

function renderPlanSummary(result: ArchiveV3RevisedResult): string {
  const plan = result.plan!
  const checks = result.render_checks
  const type = checks
    ? `${formatNumber(checks.minimum_preview_font_px)}px at 480px`
    : `${formatNumber(Math.min(...plan.presentation.zones.map(({ font_size_pct }) => font_size_pct)))}%`
  const clearance = checks
    ? ` · ${formatNumber(checks.minimum_canvas_clearance_px)}px edge clearance`
    : ''
  return `<p class="plan">${escapeHtml(plan.presentation.template)} · ${escapeHtml(plan.presentation.frame_mode)} · ${plan.presentation.zones.length} zone${plan.presentation.zones.length === 1 ? '' : 's'} · min type ${type}${clearance} · ${result.violations.length} invariant note${result.violations.length === 1 ? '' : 's'}</p>`
}

function revisionValidation(
  result: ArchiveV3RevisedResult,
  verified: boolean
): 'revised-verified' | 'revised-invalid' | 'result-blocked' | 'result-failed' {
  if (result.status === 'blocked') return 'result-blocked'
  if (result.status === 'failed') return 'result-failed'
  return verified ? 'revised-verified' : 'revised-invalid'
}

function revisionStateLabel(
  validation: ReturnType<typeof revisionValidation>
): string {
  if (validation === 'revised-verified') return 'v3 verified'
  if (validation === 'revised-invalid') return 'v3 invalid'
  if (validation === 'result-blocked') return 'blocked'
  return 'failed'
}

function missingRevisionMessage(
  status: ArchiveV3RevisedResult['status']
): string {
  if (status === 'complete') return 'Revised preview is missing'
  if (status === 'invalid') return 'Invalid render preview is missing'
  if (status === 'blocked') return 'Render blocked by an invariant'
  return 'Render failed'
}

function isVerifiedRevision({ result, preview }: ResolvedRevision): boolean {
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
    checks.text_layers.length > 0 &&
    checks.text_layers.every(
      ({ legibility_pass }) => legibility_pass === true
    ) &&
    checks.source_frames.length > 0 &&
    checks.protected_regions.every(
      ({ priority, visible_ratio, caption_overlap_px }) =>
        priority !== 'must' ||
        (visible_ratio >= 0.995 && caption_overlap_px === 0)
    )
  )
}

async function readPreview(path: string | null): Promise<string | null> {
  if (!path) return null
  try {
    const extension = extname(path).toLowerCase()
    const mime =
      extension === '.webp'
        ? 'image/webp'
        : extension === '.png'
          ? 'image/png'
          : 'image/jpeg'
    return `data:${mime};base64,${(await readFile(path)).toString('base64')}`
  } catch {
    return null
  }
}

function replaceSummary(
  html: string,
  metrics: {
    readonly rowCount: number
    readonly readyCount: number
    readonly verifiedRevisedCount: number
    readonly producedRevisedCount: number
    readonly copyDifferences: number
    readonly templateDifferences: number
    readonly revisedNotes: number
    readonly codexVersion: string
    readonly requestedModel: string
  }
): string {
  const summary = locateSingleBlock(html, 'data-report-summary', '</div>')
  const spans = [...summary.html.matchAll(/<span>([\s\S]*?)<\/span>/g)].map(
    ([, value]) => value!
  )
  const historicalRenders = requiredMetric(
    spans,
    'historical renders available'
  )
  const currentChecks = requiredMetric(spans, 'current historical checks:')
  const proposedChecks = requiredMetric(spans, 'proposed historical checks:')
  const noteLabel = metrics.revisedNotes === 1 ? 'note' : 'notes'
  const replacement = `<div class="summary" data-report-summary>
    <span>${metrics.rowCount} scenes</span>
    <span>${metrics.readyCount}/${metrics.rowCount} three-way comparisons ready</span>
    <span>${historicalRenders}</span>
    <span>${metrics.verifiedRevisedCount}/${metrics.rowCount} v3 renders verified · ${metrics.producedRevisedCount} produced</span>
    <span>${metrics.copyDifferences} copy differences</span>
    <span>${metrics.templateDifferences} template differences</span>
    <span>${currentChecks}</span>
    <span>${proposedChecks}</span>
    <span>revised v3 checks: ${metrics.verifiedRevisedCount}/${metrics.rowCount} passed · ${metrics.revisedNotes} ${noteLabel}</span>
    <span>${escapeHtml(metrics.codexVersion)}</span>
    <span>${escapeHtml(metrics.requestedModel)}</span>
  </div>`
  return `${html.slice(0, summary.start)}${replacement}${html.slice(summary.end)}`
}

function requiredMetric(spans: readonly string[], marker: string): string {
  const value = spans.find((span) => span.includes(marker))
  if (!value) throw new Error(`Comparison summary is missing ${marker}`)
  return value
}

function searchableRow(row: string, revision: ResolvedRevision): string {
  const headerEnd = row.indexOf('<div class="pair">')
  const header = headerEnd === -1 ? '' : row.slice(0, headerEnd)
  return [
    textContent(header),
    revisionCaption(revision.result),
    ...revision.result.violations,
    revision.result.error ?? '',
    revision.result.blocked_reason?.code ?? '',
    revision.result.blocked_reason?.message ?? ''
  ]
    .join(' ')
    .toLowerCase()
}

function revisionCaption(result: ArchiveV3RevisedResult): string {
  return (
    result.plan?.caption_lines.map(({ text }) => text).join('\n') ??
    result.intent?.caption_lines.map(({ text }) => text).join('\n') ??
    ''
  )
}

function readClassContent(html: string, className: string): string | null {
  const match = html.match(
    new RegExp(
      `<[^>]+class="[^"]*\\b${escapeRegex(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`
    )
  )
  return match?.[1] ? decodeHtml(match[1].trim()) : null
}

function readPlanTemplate(section: string): string | null {
  const plan = readClassContent(section, 'plan')
  return plan?.split(' · ')[0]?.trim() || null
}

function valuesDiffer(values: readonly string[]): boolean {
  return values.length > 1 && new Set(values).size > 1
}

function locateBlocks(
  source: string,
  marker: string,
  closingTag: string
): readonly HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  let cursor = 0
  while (true) {
    const markerIndex = source.indexOf(marker, cursor)
    if (markerIndex === -1) return blocks
    const start = source.lastIndexOf('<', markerIndex)
    const closingIndex = source.indexOf(closingTag, markerIndex)
    if (start === -1 || closingIndex === -1) {
      throw new Error(`Unclosed HTML block for ${marker}`)
    }
    const end = closingIndex + closingTag.length
    blocks.push({ start, end, html: source.slice(start, end) })
    cursor = end
  }
}

function locateSingleBlock(
  source: string,
  marker: string,
  closingTag: string
): HtmlBlock {
  const blocks = locateBlocks(source, marker, closingTag)
  if (blocks.length !== 1) {
    throw new Error(
      `Expected one HTML block for ${marker}; found ${blocks.length}`
    )
  }
  return blocks[0]!
}

function replaceBlocks(
  source: string,
  blocks: readonly HtmlBlock[],
  replacements: readonly string[]
): string {
  let cursor = 0
  let output = ''
  blocks.forEach((block, index) => {
    output += source.slice(cursor, block.start)
    output += replacements[index]!
    cursor = block.end
  })
  return output + source.slice(cursor)
}

function openingTag(html: string): string {
  const end = html.indexOf('>')
  if (end === -1) throw new Error('HTML block has no opening tag')
  return html.slice(0, end + 1)
}

function readAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${escapeRegex(name)}="([^"]*)"`))
  return match?.[1] ?? null
}

function setAttribute(tag: string, name: string, value: string): string {
  const attribute = `${name}="${escapeHtml(value)}"`
  const pattern = new RegExp(`\\s${escapeRegex(name)}="[^"]*"`)
  return pattern.test(tag)
    ? tag.replace(pattern, ` ${attribute}`)
    : tag.replace(/>$/, ` ${attribute}>`)
}

function textContent(html: string): string {
  return decodeHtml(html.replaceAll(/<[^>]*>/g, ' ').replaceAll(/\s+/g, ' '))
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&amp;', '&')
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1
}

function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

function defaultBackupPath(htmlPath: string): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
  const extension = extname(htmlPath)
  const stem = basename(htmlPath, extension)
  return join(
    dirname(htmlPath),
    `${stem}.before-v3-recovery-${timestamp}${extension}`
  )
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(JSON.stringify(await recoverArchiveComparisonReport(), null, 2))
}
