import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import sharp from 'sharp'
import { z } from 'zod'

const localPath = z
  .string()
  .min(1)
  .refine(
    (value) => !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.includes('\0'),
    'Expected a local file path'
  )
const text = z.string().min(1)
const sha256 = z.string().regex(/^[a-f\d]{64}$/)
const sourceSchema = z.object({ id: text, slug: text, title: text }).strict()
const candidateSchema = z
  .object({
    id: text,
    captionLines: z.array(text).min(1),
    concept: text,
    recognitionHinge: text,
    whyItWorks: text,
    fixturePath: localPath,
    intentPath: localPath,
    artifactPath: localPath,
    previewPath: localPath,
    sha256,
    status: z.literal('complete'),
    visualSource: z
      .object({
        description: text,
        path: localPath,
        provenanceUrl: z
          .url()
          .refine(
            (value) => /^https?:\/\//i.test(value),
            'Expected an HTTP(S) provenance URL'
          )
          .optional()
      })
      .strict()
      .optional(),
    noveltyNote: text.optional(),
    existingMemeSummary: z.array(z.string()).optional(),
    alternateVisualConsideration: z.string().nullable().optional()
  })
  .strict()

export const memeCandidateBatchSchema = z
  .object({
    schemaVersion: z.literal(1),
    batchId: text,
    title: text,
    createdAt: z.iso.datetime({ offset: true }),
    scenarios: z
      .array(
        z
          .object({
            id: text,
            slug: text,
            title: text,
            source: sourceSchema,
            scene: text,
            whyAnalogyWorks: text,
            caveats: z.string(),
            concepts: z.array(text).min(1),
            existingMemes: z
              .array(z.object({ path: localPath }).strict())
              .optional(),
            candidates: z.array(candidateSchema).min(1)
          })
          .strict()
      )
      .min(1)
  })
  .strict()

export type MemeCandidateBatch = z.infer<typeof memeCandidateBatchSchema>
export type MemeCandidate =
  MemeCandidateBatch['scenarios'][number]['candidates'][number]
export type MemeReviewFeedback = {
  rating: 'unrated' | 'liked' | 'disliked'
  feedback: string
  approvedForUpload: boolean
}
export type PreparedMemeCandidateBatch = MemeCandidateBatch & {
  manifestPath: string
  batchFingerprint: string
  candidateFingerprints: Record<string, string>
}

const digest = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex')

export function parseMemeCandidateBatch(value: unknown): MemeCandidateBatch {
  const batch = memeCandidateBatchSchema.parse(value)
  const scenarioIds = new Set<string>()
  const candidateIds = new Set<string>()
  const sources = new Map<string, string>()
  for (const scenario of batch.scenarios) {
    if (scenarioIds.has(scenario.id))
      throw new Error(`Duplicate scenario ID: ${scenario.id}`)
    scenarioIds.add(scenario.id)
    const sourceIdentity = JSON.stringify(scenario.source)
    if (
      sources.has(scenario.source.id) &&
      sources.get(scenario.source.id) !== sourceIdentity
    ) {
      throw new Error(`Inconsistent source identity: ${scenario.source.id}`)
    }
    sources.set(scenario.source.id, sourceIdentity)
    for (const candidate of scenario.candidates) {
      if (['all', 'reviewed', 'approved'].includes(candidate.id))
        throw new Error(`Reserved candidate ID: ${candidate.id}`)
      if (candidateIds.has(candidate.id))
        throw new Error(`Duplicate candidate ID: ${candidate.id}`)
      candidateIds.add(candidate.id)
    }
  }
  return batch
}

/** Validate local bytes and bind ratings to the exact context, caption, intent, and image. */
export async function prepareMemeCandidateBatch(
  value: unknown,
  manifestPath: string
): Promise<PreparedMemeCandidateBatch> {
  const batch = parseMemeCandidateBatch(value)
  const root = dirname(resolve(manifestPath))
  const candidateFingerprints: Record<string, string> = Object.create(null)
  for (const scenario of batch.scenarios) {
    for (const meme of scenario.existingMemes ?? []) {
      meme.path = resolve(root, meme.path)
      await readFile(meme.path)
    }
    for (const candidate of scenario.candidates) {
      const fileHashes: Record<string, string> = {}
      for (const field of [
        'fixturePath',
        'intentPath',
        'artifactPath',
        'previewPath'
      ] as const) {
        candidate[field] = resolve(root, candidate[field])
        const bytes = await readFile(candidate[field])
        fileHashes[field] = digest(bytes)
        if (field === 'fixturePath' || field === 'intentPath')
          JSON.parse(bytes.toString('utf8'))
        else {
          const metadata = await sharp(bytes).metadata()
          if (metadata.format !== 'png' || !metadata.width || !metadata.height)
            throw new Error(`${candidate.id}: ${field} must be a rendered PNG`)
        }
      }
      if (fileHashes.artifactPath !== candidate.sha256)
        throw new Error(
          `${candidate.id}: artifact SHA-256 differs from the manifest`
        )
      if (candidate.visualSource) {
        candidate.visualSource.path = resolve(root, candidate.visualSource.path)
        fileHashes.visualSource = digest(
          await readFile(candidate.visualSource.path)
        )
      }
      const {
        candidates: _otherCandidates,
        existingMemes,
        ...context
      } = scenario
      candidateFingerprints[candidate.id] = digest(
        JSON.stringify({ context, existingMemes, candidate, fileHashes })
      )
    }
  }
  return {
    ...batch,
    manifestPath: resolve(manifestPath),
    candidateFingerprints,
    batchFingerprint: digest(
      JSON.stringify({ batchId: batch.batchId, candidateFingerprints })
    )
  }
}

type CandidateBinding = {
  candidateId: string
  candidateFingerprint: string
  sha256: string
}
export type MemeReviewExport = {
  schemaVersion: 1
  kind: 'meme-candidate-review'
  batchId: string
  batchFingerprint: string
  manifestPath: string
  exportedAt: string
  selection: string
  candidates: (CandidateBinding & {
    source: MemeCandidateBatch['scenarios'][number]['source']
    scenario: Omit<
      MemeCandidateBatch['scenarios'][number],
      'source' | 'candidates'
    > & { notionPageUrl: string }
    candidate: MemeCandidate
    review: MemeReviewFeedback
  })[]
}

export function compactMemeReviewExport(value: MemeReviewExport) {
  return {
    ...value,
    candidates: value.candidates.map(
      ({ candidateId, candidateFingerprint, sha256, scenario, review }) => ({
        candidateId,
        candidateFingerprint,
        sha256,
        scenarioId: scenario.id,
        review
      })
    )
  }
}

/** Self-contained so the same restoration rules run inside the static review page. */
export function restoreMemeReviewFeedback(
  batchId: string,
  bindings: CandidateBinding[],
  value: unknown
) {
  const restored: Record<string, MemeReviewFeedback> = Object.create(null)
  if (!value || typeof value !== 'object')
    throw new Error('Expected a feedback JSON object')
  const envelope = value as Partial<MemeReviewExport>
  if (
    envelope.schemaVersion !== 1 ||
    envelope.kind !== 'meme-candidate-review' ||
    envelope.batchId !== batchId ||
    !Array.isArray(envelope.candidates)
  ) {
    throw new Error('Feedback belongs to a different batch or format')
  }
  const known = new Map(
    bindings.map((binding) => [binding.candidateId, binding])
  )
  let skipped = 0
  for (const entry of envelope.candidates) {
    const binding = entry && known.get(entry.candidateId)
    const review = entry?.review
    if (
      !binding ||
      binding.candidateFingerprint !== entry.candidateFingerprint ||
      binding.sha256 !== entry.sha256 ||
      !review ||
      !['unrated', 'liked', 'disliked'].includes(review.rating) ||
      typeof review.feedback !== 'string' ||
      typeof review.approvedForUpload !== 'boolean'
    ) {
      skipped++
      continue
    }
    // Disliking a direction always clears any earlier upload approval.
    restored[entry.candidateId] = {
      rating: review.rating,
      feedback: review.feedback,
      approvedForUpload:
        review.approvedForUpload && review.rating !== 'disliked'
    }
  }
  return { restored, skipped }
}

export function buildMemeReviewExport(
  batch: PreparedMemeCandidateBatch,
  feedback: Record<string, MemeReviewFeedback>,
  selection = 'reviewed'
): MemeReviewExport {
  return {
    schemaVersion: 1,
    kind: 'meme-candidate-review',
    batchId: batch.batchId,
    batchFingerprint: batch.batchFingerprint,
    manifestPath: batch.manifestPath,
    exportedAt: new Date().toISOString(),
    selection,
    candidates: batch.scenarios.flatMap((scenario) =>
      scenario.candidates.flatMap((candidate) => {
        const review = feedback[candidate.id] ?? {
          rating: 'unrated',
          feedback: '',
          approvedForUpload: false
        }
        const selected =
          selection === 'all' ||
          selection === candidate.id ||
          (selection === 'approved'
            ? review.approvedForUpload && review.rating !== 'disliked'
            : selection === 'reviewed' &&
              (review.rating !== 'unrated' ||
                review.feedback.trim() !== '' ||
                review.approvedForUpload))
        if (!selected) return []
        const candidateFingerprint = batch.candidateFingerprints[candidate.id]
        if (!candidateFingerprint)
          throw new Error(`Missing candidate fingerprint: ${candidate.id}`)
        const { candidates: _candidates, source, ...scenarioData } = scenario
        return [
          {
            candidateId: candidate.id,
            candidateFingerprint,
            sha256: candidate.sha256,
            source,
            scenario: {
              ...scenarioData,
              notionPageUrl: `https://app.notion.com/p/${scenario.id.replaceAll('-', '')}`
            },
            candidate,
            review: {
              ...review,
              approvedForUpload:
                review.approvedForUpload && review.rating !== 'disliked'
            }
          }
        ]
      })
    )
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
const inlineJson = (value: unknown) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')

/** One self-contained interface, with immutable rendered assets adjacent to it. */
export function renderMemeCandidateReview(
  batch: PreparedMemeCandidateBatch,
  outputPath: string
) {
  const href = (path: string) =>
    relative(dirname(resolve(outputPath)), path)
      .split('/')
      .map(encodeURIComponent)
      .join('/')
  const sources = [
    ...new Map(
      batch.scenarios.map((scenario) => [scenario.source.id, scenario.source])
    ).values()
  ]
  const cards = sources
    .map(
      (
        source,
        _sourceIndex
      ) => `<section class="source-group" data-source="${escapeHtml(source.id)}" id="source-${escapeHtml(source.id)}">
    <h2>${escapeHtml(source.title)}</h2>
    ${batch.scenarios
      .filter((scenario) => scenario.source.id === source.id)
      .map(
        (
          scenario
        ) => `<section class="scenario-group" data-scenario="${escapeHtml(scenario.id)}">
      <h3>${escapeHtml(scenario.title)} <a href="https://app.notion.com/p/${encodeURIComponent(scenario.id.replaceAll('-', ''))}" rel="noreferrer" target="_blank">Notion ↗</a></h3>
      <details><summary>Scene, analogy, and existing memes</summary><p>${escapeHtml(scenario.scene)}</p><p>${escapeHtml(scenario.whyAnalogyWorks)}</p><p>Caveats: ${escapeHtml(scenario.caveats)}</p><p>Concepts: ${escapeHtml(scenario.concepts.join(', '))}</p>${(scenario.existingMemes ?? []).map((meme) => `<img class="existing" loading="lazy" src="${escapeHtml(href(meme.path))}" alt="Existing meme for ${escapeHtml(scenario.title)}">`).join('')}</details>
      <div class="candidate-grid">${scenario.candidates
        .map(
          (
            candidate
          ) => `<article data-candidate="${escapeHtml(candidate.id)}" class="candidate">
        <a href="${escapeHtml(href(candidate.artifactPath))}" target="_blank" rel="noreferrer"><img loading="lazy" width="480" height="320" src="${escapeHtml(href(candidate.previewPath))}" alt="${escapeHtml(candidate.captionLines.join(' / '))}"></a>
        <p class="caption">${candidate.captionLines.map(escapeHtml).join('<br>')}</p>
        <p><strong>${escapeHtml(candidate.concept)}</strong> · ${escapeHtml(candidate.id)}</p>
        <p>${escapeHtml(candidate.whyItWorks)}</p>
        <details><summary>Candidate details</summary><p>Recognition hinge: ${escapeHtml(candidate.recognitionHinge)}</p>${candidate.noveltyNote ? `<p>Novelty: ${escapeHtml(candidate.noveltyNote)}</p>` : ''}${candidate.visualSource ? `<p>Visual: ${escapeHtml(candidate.visualSource.description)}${candidate.visualSource.provenanceUrl ? ` <a href="${escapeHtml(candidate.visualSource.provenanceUrl)}" target="_blank" rel="noreferrer">Provenance ↗</a>` : ''}</p>` : ''}<p><a href="${escapeHtml(href(candidate.fixturePath))}">Fixture</a> · <a href="${escapeHtml(href(candidate.intentPath))}">Intent</a></p></details>
        <div class="votes" role="group" aria-label="Rate ${escapeHtml(candidate.id)}"><button type="button" data-rating="liked" aria-pressed="false">Like</button><button type="button" data-rating="disliked" aria-pressed="false">Dislike</button><button type="button" data-rating="unrated" aria-pressed="true">Unrated</button></div>
        <label>Feedback<textarea data-feedback rows="3" placeholder="What should change or stay?"></textarea></label>
        <label class="approval"><input type="checkbox" data-approval> Approve this exact candidate for upload</label>
        <button type="button" data-copy="${escapeHtml(candidate.id)}">Copy candidate data</button>
      </article>`
        )
        .join('')}</div>
    </section>`
      )
      .join('')}
  </section>`
    )
    .join('')
  const browserEntries = buildMemeReviewExport(batch, {}, 'all')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(batch.title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f5f3;color:#20201f;font:16px/1.45 system-ui,sans-serif}header,main{max-width:1500px;margin:auto;padding:24px}header{padding-bottom:12px}h1{font-size:28px;margin:0 0 8px}h2{margin-top:30px;border-bottom:1px solid #bbb;padding-bottom:8px}h3{font-size:21px;margin:24px 0 8px}h3 a{font-size:14px;font-weight:400}p{margin:8px 0}a{color:#174e86}button,select,input,textarea{font:inherit}button,select,input[type=search]{padding:8px 12px;border:1px solid #aaa;border-radius:5px;background:white;color:inherit}button{cursor:pointer}button:hover{background:#eee}button[aria-pressed=true]{background:#263e38;color:#fff;border-color:#263e38}button[data-rating=disliked][aria-pressed=true]{background:#7c3333}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #1673c9;outline-offset:2px}.toolbar{position:sticky;top:0;z-index:1;background:#f5f5f3;box-shadow:0 2px 4px #0001;padding:12px 24px}.toolbar-inner{max-width:1452px;margin:auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px}.toolbar input[type=search]{flex:1;min-width:170px}.toolbar label{display:inline-flex;align-items:center;gap:5px;max-width:100%;min-width:0}.toolbar select{max-width:100%;min-width:0}.toolbar p{width:100%;font-size:14px}nav{display:flex;flex-wrap:wrap;gap:6px 16px}nav a{font-size:14px}.candidate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:18px}.candidate{background:white;border:1px solid #ccc;border-radius:8px;padding:14px;min-width:0}.candidate> a{display:block}.candidate img{width:100%;height:auto;display:block;border-radius:3px;background:#ddd}.candidate p{overflow-wrap:anywhere}.caption{font-weight:650;font-size:18px}.votes{display:flex;gap:8px;margin-top:12px}label{display:block}textarea{width:100%;padding:8px;border:1px solid #aaa;border-radius:4px;resize:vertical;margin:5px 0 8px}.approval{display:flex;gap:7px;align-items:flex-start;margin-bottom:12px;font-size:14px}.approval input{margin-top:4px}details{font-size:14px;margin:10px 0}summary{cursor:pointer}.existing{width:220px;max-width:100%;height:auto;margin:8px 8px 0 0}[hidden]{display:none!important}#clipboard-fallback{max-width:1452px;margin:12px auto 0;padding:12px;background:#fff;border:1px solid #aaa}#clipboard-fallback textarea{height:130px}#status{min-height:21px}section{scroll-margin-top:var(--toolbar-offset,225px)}@media(max-width:600px){header,main{padding:16px}.toolbar{position:static;padding:10px 16px}.candidate-grid{grid-template-columns:1fr}.toolbar-inner>button{font-size:14px}}
</style></head><body>
<header><h1>${escapeHtml(batch.title)}</h1><p>Every image is a candidate. Like, dislike, or leave feedback. Upload approval is a separate choice; nothing is uploaded from this page.</p><p>Feedback saves in this browser for this batch. Export a backup before changing browsers or local URLs.</p><details><summary>Jump to a media source (${sources.length})</summary><nav aria-label="Media sources">${sources.map((source) => `<a href="#source-${escapeHtml(source.id)}" data-source-link="${escapeHtml(source.id)}">${escapeHtml(source.title)}</a>`).join('')}</nav></details></header>
<div class="toolbar"><div class="toolbar-inner">
<input type="search" id="search" aria-label="Search candidates" placeholder="Search source, scenario, caption, concept…">
<label>Source <select id="source-filter"><option value="all">All sources</option>${sources.map((source) => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.title)}</option>`).join('')}</select></label>
<label>Show <select id="review-filter"><option value="all">All candidates</option><option value="unreviewed">Unreviewed</option><option value="liked">Liked</option><option value="disliked">Disliked</option><option value="feedback">With feedback</option><option value="approved">Approved for upload</option></select></label>
<button type="button" data-copy="reviewed">Copy reviewed results</button><button type="button" data-copy="approved">Copy approved results</button><button type="button" id="export">Export JSON backup</button><button type="button" id="import">Import backup</button><input hidden type="file" id="import-file" accept="application/json,.json">
<p id="counts"></p><p id="status" role="status" aria-live="polite"></p></div><div id="clipboard-fallback" hidden><label>Clipboard unavailable. Copy this JSON manually<textarea id="clipboard-text" readonly></textarea></label><button type="button" id="close-clipboard">Close</button></div></div>
<main>${cards}<p id="empty" hidden>No candidates match these filters</p></main>
<script>
'use strict';
const payload=${inlineJson(browserEntries)};
const restoreFeedback=${restoreMemeReviewFeedback.toString()};
const compactExport=${compactMemeReviewExport.toString()};
const bindings=payload.candidates.map(({candidateId,candidateFingerprint,sha256})=>({candidateId,candidateFingerprint,sha256}));
const entries=new Map(payload.candidates.map(entry=>[entry.candidateId,entry]));
const cards=[...document.querySelectorAll('[data-candidate]')];
const storageKey='meme-candidate-review:v1:'+payload.batchId;
let feedback=Object.create(null);
const status=document.querySelector('#status');
const search=document.querySelector('#search');
const sourceFilter=document.querySelector('#source-filter');
const reviewFilter=document.querySelector('#review-filter');
const message=text=>{status.textContent=text};
const review=id=>feedback[id]||{rating:'unrated',feedback:'',approvedForUpload:false};
function exportData(selection){return {...payload,selection,exportedAt:new Date().toISOString(),candidates:payload.candidates.filter(entry=>{const r=review(entry.candidateId);return selection==='all'||selection===entry.candidateId||(selection==='approved'?r.approvedForUpload&&r.rating!=='disliked':selection==='reviewed'&&(r.rating!=='unrated'||r.feedback.trim()||r.approvedForUpload))}).map(entry=>({...entry,review:{...review(entry.candidateId)}}))}}
function save(){try{localStorage.setItem(storageKey,JSON.stringify({schemaVersion:1,kind:payload.kind,batchId:payload.batchId,candidates:bindings.filter(binding=>Object.hasOwn(feedback,binding.candidateId)).map(binding=>({...binding,review:review(binding.candidateId)}))}));message('Feedback saved locally')}catch{message('Local saving is unavailable. Export a JSON backup to keep your feedback')}}
function refreshControls(){for(const card of cards){const r=review(card.dataset.candidate);for(const button of card.querySelectorAll('[data-rating]'))button.setAttribute('aria-pressed',String(button.dataset.rating===r.rating));card.querySelector('[data-feedback]').value=r.feedback;card.querySelector('[data-approval]').checked=r.approvedForUpload}}
function filter(){const query=search.value.trim().toLocaleLowerCase();let visible=0;let liked=0;let disliked=0;let notes=0;let approved=0;let reviewed=0;for(const card of cards){const entry=entries.get(card.dataset.candidate);const r=review(entry.candidateId);const hasNote=!!r.feedback.trim();const isReviewed=r.rating!=='unrated'||hasNote||r.approvedForUpload;liked+=Number(r.rating==='liked');disliked+=Number(r.rating==='disliked');notes+=Number(hasNote);approved+=Number(r.approvedForUpload);reviewed+=Number(isReviewed);const matchesReview=reviewFilter.value==='all'||(reviewFilter.value==='unreviewed'&&!isReviewed)||(reviewFilter.value===r.rating)||(reviewFilter.value==='feedback'&&hasNote)||(reviewFilter.value==='approved'&&r.approvedForUpload);const searchable=[entry.candidateId,entry.source.title,entry.scenario.title,entry.scenario.scene,...entry.scenario.concepts,...entry.candidate.captionLines,entry.candidate.concept,r.feedback].join(' ').toLocaleLowerCase();card.hidden=!(matchesReview&&(sourceFilter.value==='all'||sourceFilter.value===entry.source.id)&&(!query||searchable.includes(query)));visible+=Number(!card.hidden)}for(const scenario of document.querySelectorAll('.scenario-group'))scenario.hidden=![...scenario.querySelectorAll('[data-candidate]')].some(card=>!card.hidden);for(const source of document.querySelectorAll('.source-group'))source.hidden=![...source.querySelectorAll('.scenario-group')].some(scenario=>!scenario.hidden);document.querySelector('#counts').textContent=visible+' / '+cards.length+' visible · '+reviewed+' reviewed · '+liked+' liked · '+disliked+' disliked · '+notes+' with feedback · '+approved+' approved';document.querySelector('#empty').hidden=visible!==0;const toolbar=document.querySelector('.toolbar');document.documentElement.style.setProperty('--toolbar-offset',(getComputedStyle(toolbar).position==='sticky'?Math.ceil(toolbar.getBoundingClientRect().height)+16:16)+'px')}
async function copy(selection){const exported=exportData(selection);const data=JSON.stringify(selection==='reviewed'?compactExport(exported):exported,null,2);try{if(!navigator.clipboard?.writeText)throw new Error('unavailable');await navigator.clipboard.writeText(data);message('Copied '+exported.candidates.length+' candidate(s) with feedback')}catch{const area=document.querySelector('#clipboard-text');document.querySelector('#clipboard-fallback').hidden=false;area.value=data;area.focus();area.select();message('Copy the selected JSON text manually')}}
for(const card of cards){const id=card.dataset.candidate;for(const button of card.querySelectorAll('[data-rating]'))button.addEventListener('click',()=>{const previous=review(id);const nextRating=previous.rating===button.dataset.rating?'unrated':button.dataset.rating;feedback[id]={...previous,rating:nextRating,approvedForUpload:nextRating==='disliked'?false:previous.approvedForUpload};save();refreshControls();filter()});card.querySelector('[data-feedback]').addEventListener('input',event=>{feedback[id]={...review(id),feedback:event.target.value};save();filter()});card.querySelector('[data-approval]').addEventListener('change',event=>{const previous=review(id);feedback[id]={...previous,rating:event.target.checked&&previous.rating==='disliked'?'unrated':previous.rating,approvedForUpload:event.target.checked};save();refreshControls();filter()})}
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',()=>copy(button.dataset.copy));
search.addEventListener('input',filter);sourceFilter.addEventListener('change',()=>{filter();document.querySelector('.source-group:not([hidden])')?.scrollIntoView({block:'start'})});reviewFilter.addEventListener('change',filter);window.addEventListener('resize',filter);
for(const link of document.querySelectorAll('[data-source-link]'))link.addEventListener('click',()=>{sourceFilter.value=link.dataset.sourceLink;search.value='';reviewFilter.value='all';filter()});
document.querySelector('#close-clipboard').addEventListener('click',()=>{document.querySelector('#clipboard-fallback').hidden=true});
document.querySelector('#export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(exportData('all'),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='meme-feedback-'+payload.batchId.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('JSON backup exported')});
document.querySelector('#import').addEventListener('click',()=>document.querySelector('#import-file').click());
document.querySelector('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const result=restoreFeedback(payload.batchId,bindings,JSON.parse(await file.text()));feedback=Object.assign(Object.create(null),feedback,result.restored);save();refreshControls();filter();message('Restored '+Object.keys(result.restored).length+' candidates; skipped '+result.skipped+' changed or unknown candidates')}catch(error){message('Import failed: '+error.message)}event.target.value=''});
try{const saved=localStorage.getItem(storageKey);if(saved){const result=restoreFeedback(payload.batchId,bindings,JSON.parse(saved));feedback=result.restored;message('Restored local feedback'+(result.skipped?'; skipped '+result.skipped+' changed candidates':''))}}catch{message('Local feedback could not be restored. You can import a JSON backup')}
refreshControls();filter();
</script></body></html>`
}

const HELP = `Usage: pnpm memes:review --manifest=<batch.json> [--out=<review.html>]

Generate one temporary local HTML review page. Paths resolve relative to the
manifest. The default output is review.html beside it. Rendered PNGs, fixture
and intent JSON, and artifact SHA-256 are verified before writing the page.
No uploads or Notion writes occur. Open review.html locally or serve its folder
on loopback. Feedback stays in browser storage; copy results to this chat or
export a JSON backup. Likes do not authorize uploads.`

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean' }
    },
    strict: true
  })
  if (values.help) {
    console.log(HELP)
    return
  }
  if (!values.manifest) throw new Error(HELP)
  const manifestPath = resolve(values.manifest)
  const outputPath = resolve(
    values.out ?? resolve(dirname(manifestPath), 'review.html')
  )
  if (outputPath === manifestPath)
    throw new Error('Review output cannot overwrite its manifest')
  const batch = await prepareMemeCandidateBatch(
    JSON.parse(await readFile(manifestPath, 'utf8')),
    manifestPath
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, renderMemeCandidateReview(batch, outputPath))
  console.log(
    JSON.stringify(
      {
        status: 'complete',
        batchId: batch.batchId,
        sources: new Set(batch.scenarios.map((scenario) => scenario.source.id))
          .size,
        scenarios: batch.scenarios.length,
        candidates: Object.keys(batch.candidateFingerprints).length,
        outputPath,
        batchFingerprint: batch.batchFingerprint
      },
      null,
      2
    )
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
}
