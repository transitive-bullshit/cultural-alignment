import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, type Page } from '@playwright/test'
import sharp from 'sharp'
import { z } from 'zod'

/**
 * Before/after review pages for visual changes.
 *
 * `capture` screenshots each shot from a "before" origin (normally
 * production) and an "after" origin (a local server), measuring highlight
 * rectangles from selectors. `build` turns a review spec plus those shots into
 * one self-contained HTML page with per-change feedback and a Markdown export.
 */

const HELP = `Usage:
  pnpm review:visual capture <capture.json>
  pnpm review:visual build <review.json> [--out=<review.html>]

See .agents/skills/visual-review/SKILL.md for both spec formats.`

const viewportSchema = z.union([
  z.enum(['desktop', 'mobile']),
  z.object({ width: z.number().int(), height: z.number().int() })
])

const captureSpecSchema = z.object({
  before: z.url(),
  after: z.url(),
  /** Output directory, relative to the spec file. */
  out: z.string(),
  shots: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      path: z.string().startsWith('/'),
      viewport: viewportSchema.default('desktop'),
      sides: z.array(z.enum(['before', 'after'])).default(['before', 'after']),
      /** Scroll this element to `scrollOffset` px below the viewport top. */
      scrollTo: z.string().optional(),
      scrollOffset: z.number().default(24),
      waitFor: z.string().optional(),
      storage: z.record(z.string(), z.string()).default({}),
      highlights: z
        .array(
          z.object({
            selector: z.string(),
            label: z.string(),
            side: z.enum(['before', 'after', 'both']).default('after'),
            limit: z.number().int().positive().default(1)
          })
        )
        .default([])
    })
  )
})

type Highlight = { label: string; x: number; y: number; w: number; h: number }
type ShotRecord = {
  file: string
  width: number
  height: number
  url: string
  highlights: Highlight[]
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 }
} as const

/** Storage that keeps transient overlays out of review screenshots. */
const DEFAULT_STORAGE = {
  'cultural-alignment:spoiler-warning:v2': 'dismissed'
}

async function capture(specPath: string) {
  const spec = captureSpecSchema.parse(
    JSON.parse(await readFile(specPath, 'utf8'))
  )
  const outDir = resolve(dirname(specPath), spec.out)
  await mkdir(outDir, { recursive: true })
  const manifestPath = join(outDir, 'shots.json')
  const manifest: Record<string, ShotRecord> = await readFile(
    manifestPath,
    'utf8'
  )
    .then((text) => JSON.parse(text))
    .catch(() => ({}))

  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome'
  })
  try {
    for (const shot of spec.shots) {
      const viewport =
        typeof shot.viewport === 'string'
          ? VIEWPORTS[shot.viewport]
          : { ...shot.viewport, deviceScaleFactor: 1 }
      for (const side of shot.sides) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: viewport.deviceScaleFactor,
          reducedMotion: 'reduce',
          ignoreHTTPSErrors: true
        })
        const storage = { ...DEFAULT_STORAGE, ...shot.storage }
        await context.addInitScript((entries) => {
          for (const [key, value] of Object.entries(entries)) {
            try {
              window.localStorage.setItem(key, value)
            } catch {
              // Screenshots still work when storage is unavailable.
            }
          }
        }, storage)
        const page = await context.newPage()
        const url = new URL(
          shot.path,
          side === 'before' ? spec.before : spec.after
        )
        await page.goto(url.href, { waitUntil: 'networkidle' })
        await page.addStyleTag({
          content: 'nextjs-portal { display: none !important; }'
        })
        if (shot.waitFor) await page.locator(shot.waitFor).first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        if (shot.scrollTo) {
          await page.evaluate(
            ([selector, offset]) => {
              const element = document.querySelector(selector)
              if (element) {
                window.scrollTo(
                  0,
                  element.getBoundingClientRect().top + window.scrollY - offset
                )
              }
            },
            [shot.scrollTo, shot.scrollOffset] as const
          )
        }
        await page.waitForTimeout(900)

        const highlights = await measureHighlights(
          page,
          shot.highlights.filter((h) => h.side === side || h.side === 'both')
        )
        const file = `${side}-${shot.id}.png`
        await page.screenshot({ path: join(outDir, file) })
        manifest[`${side}:${shot.id}`] = {
          file,
          width: viewport.width,
          height: viewport.height,
          url: url.href,
          highlights
        }
        console.log(
          `captured ${side}:${shot.id} (${highlights.length} highlights)`
        )
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function measureHighlights(
  page: Page,
  specs: readonly { selector: string; label: string; limit: number }[]
): Promise<Highlight[]> {
  const highlights: Highlight[] = []
  for (const { selector, label, limit } of specs) {
    const rects = await page.evaluate(
      ([sel, max]) =>
        [...document.querySelectorAll(sel)].slice(0, max).map((element) => {
          const rect = element.getBoundingClientRect()
          return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        }),
      [selector, limit] as const
    )
    if (rects.length === 0) {
      console.warn(`highlight selector matched nothing: ${selector}`)
    }
    highlights.push(...rects.map((rect) => ({ label, ...rect })))
  }
  return highlights
}

const reviewSpecSchema = z.object({
  title: z.string(),
  intro: z.string().default(''),
  /** Directory holding shots.json, relative to the spec file. */
  shots: z.string(),
  changes: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string(),
      summary: z.string(),
      /** Before/after pairs by shot id. */
      compare: z
        .array(
          z.object({
            shot: z.string(),
            label: z.string(),
            beforeLabel: z.string().default('Before · production'),
            afterLabel: z.string().default('After · this branch')
          })
        )
        .default([]),
      /** One side only, for candidates or new surfaces. */
      shots: z
        .array(
          z.object({
            shot: z.string(),
            label: z.string(),
            side: z.enum(['before', 'after']).default('after')
          })
        )
        .default([]),
      choices: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            detail: z.string().default(''),
            shot: z.string().optional()
          })
        )
        .default([]),
      table: z
        .object({
          columns: z.array(z.string()),
          rows: z.array(
            z.object({ id: z.string(), cells: z.array(z.string()) })
          ),
          flagLabel: z.string().default('Flag')
        })
        .optional()
    })
  )
})

type ReviewSpec = z.infer<typeof reviewSpecSchema>

async function build(specPath: string, outPath: string | undefined) {
  const spec = reviewSpecSchema.parse(
    JSON.parse(await readFile(specPath, 'utf8'))
  )
  const shotsDir = resolve(dirname(specPath), spec.shots)
  const manifest = JSON.parse(
    await readFile(join(shotsDir, 'shots.json'), 'utf8')
  ) as Record<string, ShotRecord>

  const images = new Map<string, string>()
  const imageFor = async (key: string) => {
    const record = manifest[key]
    if (!record) throw new Error(`Missing shot ${key}; run capture first`)
    if (!images.has(key)) {
      const data = await sharp(join(shotsDir, record.file))
        .resize({
          width: Math.min(record.width * 2, 1600),
          withoutEnlargement: true
        })
        .webp({ quality: 78 })
        .toBuffer()
      images.set(key, `data:image/webp;base64,${data.toString('base64')}`)
    }
    return { record, src: images.get(key)! }
  }

  const sections: string[] = []
  for (const change of spec.changes) {
    const parts: string[] = []
    for (const pair of change.compare) {
      const before = await imageFor(`before:${pair.shot}`)
      const after = await imageFor(`after:${pair.shot}`)
      parts.push(`<figure class="pair">
  <figcaption>${escapeHtml(pair.label)}</figcaption>
  <div class="pair-grid">${figure(before, pair.beforeLabel)}${figure(after, pair.afterLabel)}</div>
</figure>`)
    }
    if (change.shots.length > 0) {
      const figures = await Promise.all(
        change.shots.map(async ({ shot, label, side }) =>
          figure(await imageFor(`${side}:${shot}`), label)
        )
      )
      parts.push(`<div class="singles">${figures.join('')}</div>`)
    }
    if (change.choices.length > 0) {
      const cards = await Promise.all(
        change.choices.map(async (choice) => {
          const image = choice.shot
            ? figure(await imageFor(`after:${choice.shot}`), '')
            : ''
          const inputId = `pick-${change.id}-${choice.id}`
          return `<label class="choice" for="${inputId}">
  ${image}
  <span class="choice-head"><input type="radio" id="${inputId}" name="pick-${change.id}" value="${escapeHtml(choice.label)}" data-change="${change.id}"><strong>${escapeHtml(choice.label)}</strong></span>
  ${choice.detail ? `<span class="choice-detail">${escapeHtml(choice.detail)}</span>` : ''}
</label>`
        })
      )
      parts.push(`<div class="choices">${cards.join('')}</div>`)
    }
    if (change.table) {
      const { columns, rows, flagLabel } = change.table
      parts.push(`<div class="table-wrap"><table>
<thead><tr><th scope="col">${escapeHtml(flagLabel)}</th>${columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}</tr></thead>
<tbody>${rows
        .map(
          (row) =>
            `<tr><td><input type="checkbox" id="flag-${change.id}-${row.id}" data-change="${change.id}" data-row="${escapeHtml(row.cells[0] ?? row.id)}" aria-label="${escapeHtml(flagLabel)}: ${escapeHtml(row.cells[0] ?? row.id)}"></td>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
        )
        .join('\n')}</tbody>
</table></div>`)
    }
    sections.push(`<section class="change" id="${change.id}" data-change-id="${change.id}" data-change-title="${escapeHtml(change.title)}">
  <header><h2>${escapeHtml(change.title)}</h2><p>${escapeHtml(change.summary)}</p></header>
  ${parts.join('\n')}
  <div class="feedback">
    <label for="fb-${change.id}">Feedback on this change <span>(optional)</span></label>
    <textarea id="fb-${change.id}" data-change="${change.id}" rows="3" placeholder="Anything to keep, change, or revert"></textarea>
  </div>
</section>`)
  }

  const html = renderPage(spec, sections)
  const target = outPath
    ? resolve(outPath)
    : join(dirname(resolve(specPath)), 'review.html')
  await writeFile(target, html)
  console.log(`wrote ${target} (${(html.length / 1024 / 1024).toFixed(1)} MB)`)
}

function figure(
  { record, src }: { record: ShotRecord; src: string },
  label: string
) {
  const boxes = record.highlights
    .map((h, index) => {
      const style = `left:${pct(h.x, record.width)};top:${pct(h.y, record.height)};width:${pct(h.w, record.width)};height:${pct(h.h, record.height)}`
      return `<span class="mark" style="${style}"><span class="mark-tag">${index + 1}. ${escapeHtml(h.label)}</span></span>`
    })
    .join('')
  return `<figure class="shot">
  ${label ? `<figcaption>${escapeHtml(label)}</figcaption>` : ''}
  <div class="shot-frame" style="aspect-ratio:${record.width}/${record.height}">
    <img src="${src}" alt="${escapeHtml(label || 'Screenshot')}" width="${record.width}" height="${record.height}" loading="lazy">${boxes}
  </div>
</figure>`
}

function pct(value: number, total: number) {
  return `${((Math.max(0, value) / total) * 100).toFixed(2)}%`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderPage(spec: ReviewSpec, sections: readonly string[]) {
  const storageKey = `visual-review:${spec.title}`
  return `<title>${escapeHtml(spec.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap">
<style>
/* Layout: one reading column of changes; comparisons widen to two columns. */
:root {
  --paper: #f3ece0;
  --raised: #faf6ee;
  --ink: #2d2a26;
  --muted: #6f675d;
  --rule: #d9ccb8;
  --accent: #e8471c;
  --on-accent: #ffffff;
  --display: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  --body: 'Geist', system-ui, sans-serif;
  --mono: 'Geist Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --paper: #1c1a17; --raised: #25221e; --ink: #efe7d9; --muted: #a99f90; --rule: #3c3731; --accent: #ff6a3d; --on-accent: #1c1a17; color-scheme: dark; }
}
:root[data-theme="dark"] { --paper: #1c1a17; --raised: #25221e; --ink: #efe7d9; --muted: #a99f90; --rule: #3c3731; --accent: #ff6a3d; --on-accent: #1c1a17; color-scheme: dark; }
body { background: var(--paper); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.5; padding-inline: 16px; padding-block: 0 64px; }
main { max-width: 1240px; margin: 0 auto; display: grid; gap: 56px; }
.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--paper); border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; justify-content: space-between; padding-block: 14px; }
.top h1 { margin: 0; font-family: var(--display); font-weight: 800; font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.02em; line-height: 1; text-wrap: balance; }
.intro { max-width: 70ch; margin: 0; color: var(--muted); }
.export { display: flex; gap: 12px; align-items: center; }
.export output { font-family: var(--mono); font-size: 12px; color: var(--muted); }
button { font: 600 14px var(--body); background: var(--accent); color: var(--on-accent); border: 0; border-radius: 3px; padding: 10px 16px; cursor: pointer; }
button:focus-visible, textarea:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.change { display: grid; gap: 20px; padding-top: 28px; border-top: 1px solid var(--ink); }
.change header { display: grid; gap: 6px; }
.change h2 { margin: 0; font-family: var(--display); font-weight: 800; font-size: clamp(26px, 3.4vw, 36px); letter-spacing: -0.015em; line-height: 1.02; text-wrap: balance; }
.change header p { margin: 0; max-width: 72ch; }
figure { margin: 0; min-width: 0; }
figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.pair > figcaption { color: var(--ink); }
.pair-grid, .singles { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); align-items: start; }
.shot-frame { position: relative; display: block; max-width: 100%; border: 1px solid var(--rule); background: var(--raised); }
.shot-frame img { display: block; width: 100%; height: auto; }
.mark { position: absolute; border: 2px solid var(--accent); pointer-events: none; }
.mark-tag { position: absolute; left: -2px; bottom: 100%; background: var(--accent); color: var(--on-accent); font: 500 11px/1.3 var(--mono); padding: 2px 6px; white-space: nowrap; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; }
.choices { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.choice { display: grid; gap: 8px; align-content: start; padding: 10px; border: 1px solid var(--rule); background: var(--raised); cursor: pointer; min-width: 0; }
.choice:has(input:checked) { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.choice-head { display: flex; gap: 8px; align-items: center; }
.choice-head input { accent-color: var(--accent); width: 16px; height: 16px; }
.choice-detail { color: var(--muted); font-size: 13px; }
.table-wrap { overflow-x: auto; border: 1px solid var(--rule); background: var(--raised); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--rule); }
th { font: 500 11px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); position: sticky; top: 0; background: var(--raised); }
td input { accent-color: var(--accent); width: 16px; height: 16px; }
tr:has(input:checked) td { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.feedback { display: grid; gap: 6px; }
.feedback label { font-weight: 600; }
.feedback label span { color: var(--muted); font-weight: 400; }
textarea { width: 100%; box-sizing: border-box; font: 15px/1.5 var(--body); color: var(--ink); background: var(--raised); border: 1px solid var(--rule); border-radius: 3px; padding: 10px 12px; resize: vertical; }
#fallback { width: 100%; min-height: 160px; }
@media (prefers-reduced-motion: no-preference) { button { transition: filter 120ms ease; } button:hover { filter: brightness(1.08); } }
</style>
<main>
  <div class="top">
    <h1>${escapeHtml(spec.title)}</h1>
    <div class="export">
      <output id="status" aria-live="polite">No feedback yet</output>
      <button type="button" id="copy">Copy feedback</button>
    </div>
  </div>
  ${spec.intro ? `<p class="intro">${escapeHtml(spec.intro)}</p>` : ''}
  ${sections.join('\n')}
  <textarea id="fallback" hidden readonly aria-label="Feedback to copy"></textarea>
</main>
<script>
(() => {
  const KEY = ${JSON.stringify(storageKey)};
  const fields = () => [...document.querySelectorAll('textarea[data-change], input[data-change]')];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const save = () => {
    const state = {};
    for (const el of fields()) state[el.id] = el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    update();
  };
  const markdown = () => {
    const out = ['# Review feedback: ' + document.title, ''];
    for (const section of document.querySelectorAll('[data-change-id]')) {
      const id = section.dataset.changeId;
      const lines = [];
      const pick = section.querySelector('input[type=radio]:checked');
      if (pick) lines.push('Pick: ' + pick.value);
      const flags = [...section.querySelectorAll('input[type=checkbox]:checked')].map((el) => el.dataset.row);
      if (flags.length) lines.push('Flagged: ' + flags.join('; '));
      const note = section.querySelector('textarea').value.trim();
      if (note) lines.push(note);
      if (lines.length) out.push('## ' + section.dataset.changeTitle + ' (' + id + ')', ...lines, '');
    }
    return out.length > 2 ? out.join('\\n') : '';
  };
  const update = () => {
    const count = [...document.querySelectorAll('[data-change-id]')].filter((s) =>
      s.querySelector('textarea').value.trim() || s.querySelector('input:checked')).length;
    document.getElementById('status').textContent = count ? count + (count === 1 ? ' change' : ' changes') + ' with feedback' : 'No feedback yet';
  };
  const state = load();
  for (const el of fields()) {
    if (el.id in state) { if (el.type === 'radio' || el.type === 'checkbox') el.checked = state[el.id]; else el.value = state[el.id]; }
    el.addEventListener(el.tagName === 'TEXTAREA' ? 'input' : 'change', save);
  }
  update();
  document.getElementById('copy').addEventListener('click', async () => {
    const text = markdown();
    const status = document.getElementById('status');
    if (!text) { status.textContent = 'Add feedback or a pick first'; return; }
    try { await navigator.clipboard.writeText(text); status.textContent = 'Copied. Paste it into your agent.'; }
    catch {
      const fallback = document.getElementById('fallback');
      fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select();
      status.textContent = 'Press Cmd+C to copy the selected text';
    }
  });
})();
</script>
`
}

async function main() {
  const [command, specPath, ...rest] = process.argv.slice(2)
  if (!command || !specPath || command === '--help' || command === '-h') {
    console.log(HELP)
    return
  }
  if (command === 'capture') return capture(resolve(specPath))
  if (command === 'build') {
    const out = rest.find((arg) => arg.startsWith('--out='))?.slice(6)
    return build(resolve(specPath), out)
  }
  throw new Error(`Unknown command "${command}".\n\n${HELP}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
