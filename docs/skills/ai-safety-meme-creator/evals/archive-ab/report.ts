import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  defaultArtifactRoot,
  type ArchiveAbRunManifest,
  type ArchiveAbVariant,
  type ArchiveAbVariantResult
} from './runner'
import { workspaceDirectory, type ArchiveComparisonCase } from './selection'
import {
  defaultArchiveV3ArtifactRoot,
  type ArchiveV3RevisedResult,
  type ArchiveV3RunManifest
} from './v3-runner'

const minimumReviewPreviewFontPx = 18

type ReportVariantStatus =
  | ArchiveAbVariantResult['status']
  | 'invalid'
  | 'blocked'
  | 'pending'

type ReportVariantLabel = ArchiveAbVariant | 'revised'

interface ReportVariantResult {
  readonly status: ReportVariantStatus
  readonly preview_path: string | null
  readonly plan: ArchiveAbVariantResult['plan']
  readonly evaluation_pass: boolean
  readonly violations: readonly string[]
  readonly error: string | null
  readonly render_sha256?: string | null
  readonly preview_sha256?: string | null
  readonly render_checks?: ArchiveV3RevisedResult['render_checks']
  readonly blocked_reason?: ArchiveV3RevisedResult['blocked_reason']
  readonly caption_lines?: readonly string[]
  readonly summary?: string
}

export type ArchiveAbRevisedVariantResult = Pick<
  ReportVariantResult,
  | 'status'
  | 'preview_path'
  | 'plan'
  | 'evaluation_pass'
  | 'violations'
  | 'error'
  | 'render_sha256'
  | 'preview_sha256'
  | 'render_checks'
  | 'blocked_reason'
  | 'caption_lines'
  | 'summary'
>

export type ArchiveAbRevisedResults = Readonly<
  Record<string, ArchiveAbRevisedVariantResult | undefined>
>

interface BuildArchiveAbHtmlOptions {
  readonly allowPartial?: boolean
  readonly readPreview?: (path: string) => Promise<string>
  readonly revisedResults?: ArchiveAbRevisedResults
}

export const archiveAbReportPath = join(
  workspaceDirectory,
  'docs',
  'skills',
  'ai-safety-meme-creator',
  'archive-ab-comparison.html'
)

export async function buildArchiveAbHtml(
  manifest: ArchiveAbRunManifest,
  options: BuildArchiveAbHtmlOptions = {}
): Promise<string> {
  const allowPartial = options.allowPartial ?? false
  const readPreview = options.readPreview ?? previewDataUri
  const revisedResults = options.revisedResults ?? {}
  const resultsByCase = new Map(
    manifest.results.map((result) => [result.case_id, result])
  )
  if (!allowPartial && manifest.selection.cases.length !== 50) {
    throw new Error(
      `The final report requires all 50 cases; found ${manifest.selection.cases.length}`
    )
  }

  const reportCases = manifest.selection.cases.map((comparisonCase) => {
    const result = resultsByCase.get(comparisonCase.case_id)
    return {
      comparisonCase,
      result,
      current: result?.variants.current ?? failedVariant('current'),
      proposed: result?.variants.proposed ?? failedVariant('proposed'),
      revised: revisedResults[comparisonCase.case_id] ?? pendingRevisedVariant()
    }
  })
  const resolvedCases = await Promise.all(
    reportCases.map(
      async ({ comparisonCase, result, current, proposed, revised }, index) => {
        if (!result && !allowPartial) {
          throw new Error(`Missing result for ${comparisonCase.case_id}`)
        }
        if (
          !allowPartial &&
          (current.status !== 'complete' || proposed.status !== 'complete')
        ) {
          throw new Error(`Incomplete pair for ${comparisonCase.idea_id}`)
        }
        const [currentImage, proposedImage, revisedImage] = await Promise.all([
          resolvePreview(current.preview_path, readPreview),
          resolvePreview(proposed.preview_path, readPreview),
          resolvePreview(revised.preview_path, readPreview)
        ])
        return {
          comparisonCase,
          index,
          current,
          proposed,
          revised,
          currentImage,
          proposedImage,
          revisedImage
        }
      }
    )
  )
  const rows = resolvedCases.map(renderComparisonRow)
  const completedHistoricalVariants = reportCases
    .flatMap(({ current, proposed }) => [current, proposed])
    .filter(({ status }) => status === 'complete').length
  const producedRevisedVariants = resolvedCases.filter(({ revisedImage }) =>
    Boolean(revisedImage)
  ).length
  const verifiedRevisedVariants = resolvedCases.filter(
    ({ revised, revisedImage }) => isVerifiedRevised(revised, revisedImage)
  ).length
  const readyComparisons = resolvedCases.filter(isReadyComparison).length
  const changedCopy = reportCases.filter(({ current, proposed, revised }) =>
    valuesDiffer(
      [current, proposed, revised]
        .map(captionText)
        .filter((value) => value.length > 0)
    )
  ).length
  const changedTemplate = reportCases.filter(({ current, proposed, revised }) =>
    valuesDiffer(
      [current, proposed, revised]
        .map(({ plan }) => plan?.presentation.template)
        .filter(isDefined)
    )
  ).length
  const currentPasses = reportCases.filter(
    ({ current }) => current.evaluation_pass
  ).length
  const proposedPasses = reportCases.filter(
    ({ proposed }) => proposed.evaluation_pass
  ).length
  const currentNotes = reportCases.reduce(
    (sum, { current }) => sum + current.violations.length,
    0
  )
  const proposedNotes = reportCases.reduce(
    (sum, { proposed }) => sum + proposed.violations.length,
    0
  )
  const revisedNotes = reportCases.reduce(
    (sum, { revised }) => sum + revised.violations.length,
    0
  )

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI safety meme skill · 50-scene comparison</title>
<style>
  :root { color-scheme: light; font-family: system-ui, sans-serif; background: #f4f4f4; color: #111; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  header, main { width: min(100% - 24px, 1800px); margin-inline: auto; }
  header { padding: 24px 0 16px; }
  h1 { margin: 0 0 8px; font-size: 24px; }
  p { margin: 6px 0; }
  .quiet { color: #555; font-size: 13px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; font-size: 13px; }
  .controls { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; padding: 10px 0; background: #f4f4f4; }
  input, select { min-height: 36px; border: 1px solid #aaa; border-radius: 4px; background: white; padding: 6px 9px; font: inherit; }
  input { flex: 1; min-width: 0; }
  .case { margin: 0 0 18px; border: 1px solid #bbb; border-radius: 6px; background: white; overflow: hidden; }
  .case-head { padding: 10px 12px; border-bottom: 1px solid #ddd; }
  .case-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
  .case-title h2 { margin: 0; font-size: 16px; }
  .badge { border: 1px solid currentColor; border-radius: 999px; padding: 1px 7px; font-size: 11px; }
  .finalized { color: #176b34; }
  .disliked { color: #a12d22; }
  .pair-ready { color: #176b34; }
  .pair-wip { color: #76520b; }
  .result-state { margin-left: 4px; vertical-align: 1px; }
  .historical-pass { color: #555; }
  .historical-invalid, .revised-invalid, .result-failed, .result-blocked { color: #a12d22; }
  .revised-verified { color: #176b34; }
  .result-pending { color: #76520b; }
  .archive-copy, .feedback { margin-top: 6px; font-size: 13px; }
  .archive-copy { color: #333; }
  .feedback { padding-left: 9px; border-left: 3px solid #bbb; }
  .pair { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .variant { min-width: 0; padding: 10px; }
  .variant + .variant { border-left: 1px solid #ddd; }
  .variant[data-validation="historical-invalid"], .variant[data-validation="revised-invalid"] { background: #fff8ef; }
  .variant[data-validation="revised-verified"] { background: #f6fff8; }
  .variant h3 { margin: 0 0 7px; font-size: 14px; }
  .variant img, .missing { display: block; width: 100%; aspect-ratio: 3 / 2; background: #111; object-fit: contain; }
  .missing { display: grid; place-items: center; color: white; padding: 20px; text-align: center; }
  .plan { margin-top: 7px; font-size: 12px; color: #444; }
  .caption { margin: 6px 0 0; font-size: 13px; white-space: pre-line; }
  details { margin-top: 6px; font-size: 12px; }
  details ul { margin: 5px 0 0; padding-left: 20px; }
  [hidden] { display: none !important; }
  @media (max-width: 900px) {
    .pair { grid-template-columns: 1fr; }
    .variant + .variant { border-left: 0; border-top: 1px solid #ddd; }
    .controls { flex-wrap: wrap; }
    input { flex-basis: 100%; }
  }
</style>
</head>
<body>
<header>
  <h1>AI safety meme skill · 50-scene comparison</h1>
  <p>Current and proposed are historical outputs from the original shared renderer. Revised is the verified v3 pass. Historical failures stay visible as evidence; only v3 outputs that pass their render checks count as ready.</p>
  <p class="quiet">25 finalized positive references freeze the approved copy; 25 disliked negative references supply the rejected direction and exact human feedback. Compare the images directly.</p>
  <details class="quiet"><summary>Method and status labels</summary><p>Historical invalid means an image file was produced but the old harness reported invariant failures. V3 verified means the revised renderer completed and passed its objective checks. Pending, blocked, failed, and v3 invalid results remain WIP.</p></details>
  <div class="summary" data-report-summary>
    <span>${manifest.selection.cases.length} scenes</span>
    <span>${readyComparisons}/${manifest.selection.cases.length} three-way comparisons ready</span>
    <span>${completedHistoricalVariants}/${manifest.selection.cases.length * 2} historical renders available</span>
    <span>${verifiedRevisedVariants}/${manifest.selection.cases.length} v3 renders verified · ${producedRevisedVariants} produced</span>
    <span>${changedCopy} copy differences</span>
    <span>${changedTemplate} template differences</span>
    <span>current historical checks: ${currentPasses}/${manifest.selection.cases.length} passed · ${currentNotes} notes</span>
    <span>proposed historical checks: ${proposedPasses}/${manifest.selection.cases.length} passed · ${proposedNotes} notes</span>
    <span>revised v3 checks: ${verifiedRevisedVariants}/${manifest.selection.cases.length} passed · ${revisedNotes} notes</span>
    <span>${escapeHtml(manifest.codex_version)}</span>
    <span>${escapeHtml(manifest.requested_model)}</span>
  </div>
  <div class="controls">
    <input id="search" type="search" placeholder="Filter source, concept, caption, or feedback" aria-label="Filter comparisons">
    <select id="cohort" aria-label="Filter by archive verdict">
      <option value="all">All 50</option>
      <option value="finalized">Finalized · positive</option>
      <option value="disliked">Disliked · negative</option>
    </select>
    <select id="status" aria-label="Filter by comparison readiness">
      <option value="ready">Ready for comparison</option>
      <option value="wip">WIP</option>
      <option value="all">All statuses</option>
    </select>
    <select id="delta" aria-label="Filter by A/B difference">
      <option value="all">All comparisons</option>
      <option value="copy">Copy differs</option>
      <option value="template">Template differs</option>
      <option value="fewer">Proposed has fewer notes</option>
      <option value="more">Proposed has more notes</option>
      <option value="notes">Has invariant notes</option>
      <option value="legacyInvalid">Historical invalid output</option>
      <option value="revisedInvalid">V3 invalid output</option>
      <option value="failure">Failures</option>
    </select>
  </div>
</header>
<main data-comparison-list>
${rows.join('\n')}
</main>
<script>
  const search = document.querySelector('#search')
  const cohort = document.querySelector('#cohort')
  const status = document.querySelector('#status')
  const delta = document.querySelector('#delta')
  const rows = [...document.querySelectorAll('[data-comparison-row]')]
  const apply = () => {
    const query = search.value.trim().toLowerCase()
    for (const row of rows) {
      const cohortMatch = cohort.value === 'all' || row.dataset.cohort === cohort.value
      const statusMatch = status.value === 'all' || row.dataset.pairStatus === status.value
      const deltaMatch = delta.value === 'all' || row.dataset[delta.value] === 'true'
      const searchMatch = !query || row.dataset.search.includes(query)
      row.hidden = !(cohortMatch && statusMatch && deltaMatch && searchMatch)
    }
  }
  search.addEventListener('input', apply)
  cohort.addEventListener('change', apply)
  status.addEventListener('change', apply)
  delta.addEventListener('change', apply)
  apply()
</script>
</body>
</html>
`
}

export async function writeArchiveAbReport({
  runManifestPath = join(defaultArtifactRoot, 'run-manifest.json'),
  revisedManifestPath = join(defaultArchiveV3ArtifactRoot, 'run-manifest.json'),
  outputPath = archiveAbReportPath,
  allowPartial = process.env.MEME_SKILL_ARCHIVE_AB_ALLOW_PARTIAL === '1',
  revisedResults
}: {
  readonly runManifestPath?: string
  readonly revisedManifestPath?: string
  readonly outputPath?: string
  readonly allowPartial?: boolean
  readonly revisedResults?: ArchiveAbRevisedResults
} = {}): Promise<string> {
  const manifest = JSON.parse(
    await readFile(runManifestPath, 'utf8')
  ) as ArchiveAbRunManifest
  const resolvedRevisedResults =
    revisedResults ?? (await readRevisedResults(revisedManifestPath))
  const html = await buildArchiveAbHtml(manifest, {
    allowPartial,
    revisedResults: resolvedRevisedResults
  })
  await writeFile(outputPath, html, 'utf8')
  return outputPath
}

async function readRevisedResults(
  manifestPath: string
): Promise<ArchiveAbRevisedResults | undefined> {
  try {
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8')
    ) as ArchiveV3RunManifest
    return Object.fromEntries(
      manifest.results.map(({ case_id, revised }) => [case_id, revised])
    )
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
}

function renderComparisonRow({
  comparisonCase,
  index,
  current,
  proposed,
  revised,
  currentImage,
  proposedImage,
  revisedImage
}: {
  readonly comparisonCase: ArchiveComparisonCase
  readonly index: number
  readonly current: ReportVariantResult
  readonly proposed: ReportVariantResult
  readonly revised: ReportVariantResult
  readonly currentImage: string | null
  readonly proposedImage: string | null
  readonly revisedImage: string | null
}): string {
  const copyChanged = valuesDiffer(
    [current, proposed, revised]
      .map(captionText)
      .filter((value) => value.length > 0)
  )
  const templateChanged = valuesDiffer(
    [current, proposed, revised]
      .map(({ plan }) => plan?.presentation.template)
      .filter(isDefined)
  )
  const failure = [current, proposed, revised].some(({ status }) =>
    ['blocked', 'failed'].includes(status)
  )
  const ready = isReadyComparison({
    current,
    proposed,
    revised,
    currentImage,
    proposedImage,
    revisedImage
  })
  const notes = [current, proposed, revised].some(
    ({ violations }) => violations.length > 0
  )
  const legacyInvalid = [current, proposed].some(
    ({ status, evaluation_pass }) => status === 'complete' && !evaluation_pass
  )
  const revisedInvalid =
    revised.status === 'invalid' ||
    (revised.status === 'complete' && !revised.evaluation_pass)
  const fewerNotes = proposed.violations.length < current.violations.length
  const moreNotes = proposed.violations.length > current.violations.length
  const search = [
    comparisonCase.source_title,
    comparisonCase.scenario_title,
    comparisonCase.idea.ai_concept,
    comparisonCase.idea_id,
    ...comparisonCase.idea.caption_lines,
    comparisonCase.human_feedback ?? '',
    captionText(current),
    captionText(proposed),
    captionText(revised),
    ...revised.violations,
    revised.error ?? ''
  ]
    .join(' ')
    .toLowerCase()

  return `<article class="case" data-comparison-row data-cohort="${comparisonCase.cohort}" data-pair-status="${ready ? 'ready' : 'wip'}" data-copy="${copyChanged}" data-template="${templateChanged}" data-fewer="${fewerNotes}" data-more="${moreNotes}" data-notes="${notes}" data-legacy-invalid="${legacyInvalid}" data-revised-invalid="${revisedInvalid}" data-failure="${failure}" data-search="${escapeHtml(search)}">
  <div class="case-head">
    <div class="case-title">
      <h2>${String(index + 1).padStart(2, '0')}. ${escapeHtml(comparisonCase.source_title)} · ${escapeHtml(comparisonCase.scenario_title)}</h2>
      <span class="badge ${comparisonCase.cohort}">${comparisonCase.cohort} · ${comparisonCase.cohort === 'finalized' ? 'positive' : 'negative'}</span>
      <span class="badge ${ready ? 'pair-ready' : 'pair-wip'}">${ready ? 'ready' : 'WIP'}</span>
      <span class="quiet">${escapeHtml(comparisonCase.idea.ai_concept)} · ${escapeHtml(comparisonCase.idea.format)} · ${escapeHtml(comparisonCase.idea_id)}</span>
    </div>
    <p class="archive-copy"><strong>Archived:</strong> ${comparisonCase.idea.caption_lines.map(escapeHtml).join(' / ')}</p>
    ${comparisonCase.human_feedback ? `<p class="feedback"><strong>Human feedback:</strong> ${escapeHtml(comparisonCase.human_feedback)}</p>` : comparisonCase.cohort === 'finalized' ? '<p class="feedback"><strong>Human feedback:</strong> Locked/finalized; no written note.</p>' : '<p class="feedback"><strong>Human feedback:</strong> Disliked; no written note, so replace the direction.</p>'}
  </div>
  <div class="pair">
    ${renderVariant('current', current, currentImage)}
    ${renderVariant('proposed', proposed, proposedImage)}
    ${renderVariant('revised', revised, revisedImage)}
  </div>
</article>`
}

function renderVariant(
  label: ReportVariantLabel,
  result: ReportVariantResult,
  image: string | null
): string {
  const validation = variantValidation(label, result)
  const heading = variantHeading(label)
  const stateLabel = variantStateLabel(validation)
  if (!image) {
    const blockedDetail = result.blocked_reason
      ? `${result.blocked_reason.code}: ${result.blocked_reason.message}`
      : null
    return `<section class="variant" data-variant="${label}" data-status="${result.status}" data-validation="${validation}">
      <h3>${heading}<span class="badge result-state ${validation}">${stateLabel}</span></h3>
      <div class="missing">${escapeHtml(result.error ?? blockedDetail ?? missingVariantMessage(result.status))}</div>
    </section>`
  }
  const plan = result.plan
  const planSummary = plan
    ? renderPlanSummary(plan, result.violations, result.render_checks)
    : ''
  const caption = captionText(result)
  const rationale = result.summary ?? plan?.why_it_works
  return `<section class="variant" data-variant="${label}" data-status="${result.status}" data-validation="${validation}">
    <h3>${heading}<span class="badge result-state ${validation}">${stateLabel}</span></h3>
    <a href="${image}" target="_blank" rel="noreferrer"><img src="${image}" alt="${escapeHtml(`${label} render`)}" loading="lazy"></a>
    ${planSummary || `<p class="plan">${result.violations.length} invariant note${result.violations.length === 1 ? '' : 's'}</p>`}
    ${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ''}
    <details><summary>Render details and invariant notes</summary>
      ${rationale ? `<p>${escapeHtml(rationale)}</p>` : ''}
      ${result.violations.length ? `<ul>${result.violations.map((violation) => `<li>${escapeHtml(violation)}</li>`).join('')}</ul>` : '<p>None reported by the shared harness.</p>'}
    </details>
  </section>`
}

function failedVariant(variant: ArchiveAbVariant): ArchiveAbVariantResult {
  return {
    variant,
    status: 'failed',
    cache_key: '',
    cache_hit: false,
    attempts: 0,
    duration_ms: 0,
    artifact_directory: '',
    render_path: null,
    preview_path: null,
    render_sha256: null,
    preview_sha256: null,
    plan: null,
    evaluation_pass: false,
    violations: [],
    error: 'Not run'
  }
}

function pendingRevisedVariant(): ReportVariantResult {
  return {
    status: 'pending',
    preview_path: null,
    plan: null,
    evaluation_pass: false,
    violations: [],
    error: null
  }
}

function captionText(result: ReportVariantResult): string {
  return (
    result.caption_lines?.join('\n') ??
    result.plan?.caption_lines.map(({ text }) => text).join('\n') ??
    ''
  )
}

function valuesDiffer(values: readonly string[]): boolean {
  return values.length > 1 && new Set(values).size > 1
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function variantValidation(
  label: ReportVariantLabel,
  result: ReportVariantResult
):
  | 'historical-pass'
  | 'historical-invalid'
  | 'revised-verified'
  | 'revised-invalid'
  | 'result-blocked'
  | 'result-failed'
  | 'result-pending' {
  if (result.status === 'blocked') return 'result-blocked'
  if (result.status === 'failed') return 'result-failed'
  if (result.status === 'pending') return 'result-pending'
  if (result.status === 'invalid') return 'revised-invalid'
  if (label === 'revised') {
    return result.evaluation_pass ? 'revised-verified' : 'revised-invalid'
  }
  return result.evaluation_pass ? 'historical-pass' : 'historical-invalid'
}

function variantHeading(label: ReportVariantLabel): string {
  if (label === 'current') return 'Historical · current'
  if (label === 'proposed') return 'Historical · proposed'
  return 'V3 · revised'
}

function variantStateLabel(
  validation: ReturnType<typeof variantValidation>
): string {
  switch (validation) {
    case 'historical-pass':
      return 'historical pass'
    case 'historical-invalid':
      return 'historical invalid'
    case 'revised-verified':
      return 'v3 verified'
    case 'revised-invalid':
      return 'v3 invalid'
    case 'result-blocked':
      return 'blocked'
    case 'result-failed':
      return 'failed'
    case 'result-pending':
      return 'pending'
  }
}

function missingVariantMessage(status: ReportVariantStatus): string {
  if (status === 'pending') return 'Revised render not available yet'
  if (status === 'blocked') return 'Render blocked by an invariant'
  if (status === 'failed') return 'Render failed'
  if (status === 'invalid') return 'Render failed one or more invariants'
  return 'No render'
}

function renderPlanSummary(
  plan: NonNullable<ReportVariantResult['plan']>,
  violations: readonly string[],
  renderChecks?: ArchiveV3RevisedResult['render_checks']
): string {
  const typeSummary = renderChecks
    ? `${formatNumber(renderChecks.minimum_preview_font_px)}px at 480px`
    : `${formatNumber(Math.min(...plan.presentation.zones.map(({ font_size_pct }) => font_size_pct)))}%`
  const clearance = renderChecks
    ? ` · ${formatNumber(renderChecks.minimum_canvas_clearance_px)}px edge clearance`
    : ''
  return `<p class="plan">${escapeHtml(plan.presentation.template)} · ${escapeHtml(plan.presentation.frame_mode)} · ${plan.presentation.zones.length} zone${plan.presentation.zones.length === 1 ? '' : 's'} · min type ${typeSummary}${clearance} · ${violations.length} invariant note${violations.length === 1 ? '' : 's'}</p>`
}

async function resolvePreview(
  path: string | null,
  readPreview: (path: string) => Promise<string>
): Promise<string | null> {
  if (!path) return null
  try {
    return await readPreview(path)
  } catch {
    return null
  }
}

function isVerifiedRevised(
  revised: ReportVariantResult,
  revisedImage: string | null
): boolean {
  const checks = revised.render_checks
  return Boolean(
    revised.status === 'complete' &&
    revised.evaluation_pass &&
    revisedImage &&
    revised.render_sha256 &&
    revised.preview_sha256 &&
    checks &&
    checks.copy_preserved &&
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
    )
  )
}

function isReadyComparison({
  current,
  proposed,
  revised,
  currentImage,
  proposedImage,
  revisedImage
}: {
  readonly current: ReportVariantResult
  readonly proposed: ReportVariantResult
  readonly revised: ReportVariantResult
  readonly currentImage: string | null
  readonly proposedImage: string | null
  readonly revisedImage: string | null
}): boolean {
  return Boolean(
    current.status === 'complete' &&
    proposed.status === 'complete' &&
    currentImage &&
    proposedImage &&
    isVerifiedRevised(revised, revisedImage)
  )
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

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await writeArchiveAbReport())
}
