# Regression-grounded skill revision

Status: accepted as the production `SKILL.md`, with the V5 typography contract and reusable regression harness retained for later passes. This filename is retained for links from the earlier review.

## Why the first two versions failed

The 50-scene legacy A/B produced all 100 requested files, but only four current plans and no first-candidate plans passed the deterministic evaluator. The 404 combined notes were diagnostic rather than a taste score, but the rendered page exposed the decisive problem: file production had been confused with completion.

The old seam asked Codex to invent physical bounds, font percentages, and rendered line counts before a raster engine measured the text. The renderer then painted those guesses even when copy wrapped differently, crossed a canvas edge, covered a face, or became unreadable at preview size. A second prose-heavy skill draft changed guidance without changing that ownership boundary, so it could not reliably fix the failures.

The repair is architectural: Codex owns meaning; deterministic code owns pixels.

## Implemented design

### Semantic agent output

The production skill now has a short routed entrypoint with separate editorial, revision, and composer-contract references. Codex returns only:

- one recognition hinge and one AI bridge
- exact caption beats and copy provenance
- semantic roles and indentation
- source frame IDs and roles
- semantic presentation mode, preferred edge, and palette

It does not author crop coordinates, canvas boxes, font sizes, baselines, line heights, or physical wrapping. `semantic-plan.ts` is the runtime contract and `semantic-plan.schema.json` constrains the Codex response.

### Measured deterministic composition

`safe-render.ts` maps semantic intent to supported templates and source treatments. The default meme style resolves an actual Impact font file; explicit code styles retain their pinned specialist face. `measured-text.ts` measures through the same Sharp/Pango path used for export, including outline ink on an unclipped layer, searches for the largest whole-pixel fit above the readability floor, ranks alternate non-code breaks against measured glyph width without increasing their line count, permits at most a two-pixel font retreat for raster-rounding balance failures, balances related zones, and preserves source aspect ratio.

The composer may try alternate edges or an external caption area when a must-preserve region prevents a valid overlay. It tries the smallest measured caption well first, but a one-zone compact well below 55 source pixels / 22 review pixels does not win merely because it fits: the composer continues on the requested edge until it finds a comfortable valid candidate, or chooses the largest valid fallback if none reaches that target. It normally rejects an external fallback when visible source imagery would occupy less than 75% of canvas height for one caption zone or 60% for two. Measured locked or source-native copy that needs at least three physical lines may use a 65% one-zone floor without lowering the 18-pixel type floor. This closes both follow-on failures where fully visible evidence became a hard-to-recognize strip and where a thinner outline accidentally selected a much smaller caption well.

The authoritative typography rules live in `references/composer-contract.md`. In the default style, semantic copy is displayed in uppercase Impact with white fill and a restrained `0.05em` pure-black stroke; the stroke remains present over a backplate. Non-code multiline captions use balanced wrapping with an orphan-line penalty, while code remains greedy and source-preserving. Case conversion and line wrapping are display transforms, so punctuation, numbers, words, order, and stored semantic copy remain exact. The composer blocks instead of substituting a lookalike font, clipping, hiding or miniaturizing required evidence, changing semantic copy, or shrinking below the type floor. Its completion evidence includes resolved font identity, display-case transform, wrap mode, physical lines, font sizes, fill/stroke values and widths, rasterized stroke-pixel counts, backplate treatment, ink bounds, source placements, source occupancy, protected-region projections, preview readability, and canvas clearance.

### Feedback lineage

Finalized copy and explicit visual treatments remain locks. A bounded execution note changes only the named ingredient. A terminal dislike replaces the rejected direction rather than paraphrasing it. The v3 runner validates source and region IDs, enforces applicable rejected-format changes, and feeds invalid or composition-blocked attempts back to Codex with the specific failure for up to three attempts.

### Strict outcome states

- `complete`: render and preview exist, hashes are recorded, measured geometry passes, and semantic, source, and feedback-lock evaluation has no violations.
- `invalid`: a raster exists but one or more deterministic invariants failed. It is never review-ready.
- `blocked`: the composer returns a typed physical constraint failure and does not claim a finished raster.
- `failed`: the agent or structured-output process failed after retry handling.
- `pending`: the comparison report has no v3 result for that case.

The runner preserves every outcome and its evidence. `complete` is the only v3 state eligible for the ready filter.

## Three-column acceptance gate

The standalone report combines:

1. historical current output
2. historical first-candidate output
3. measured v3 revised output

Historical files remain visible even when their legacy invariant checks failed; they are explicitly labeled `historical invalid`. A row becomes ready only when all three previews are present and v3 has hashes plus passing copy, canvas, text-legibility, source-occupancy, source-frame, and must-preserve-region evidence. Pending, invalid, blocked, failed, and stale unverifiable v3 rows stay in the separate WIP filter.

Run the gate with:

```bash
pnpm test:meme-skill
pnpm memes:skill-v3
pnpm memes:skill-v3:recompose
pnpm memes:skill-v3:recover-report
```

Review `docs/skills/ai-safety-meme-creator/archive-ab-comparison.html` with the status filter left on **Ready for comparison**. The latest manifest, rather than a count copied into this document, is the source of truth for readiness.

## Acceptance standard

Mechanical acceptance requires all selected v3 cases to be `complete` and report-ready. Human acceptance still decides whether the direction is funny, recognizable, concise, and worth publishing. Objective checks cannot waive that taste gate, and taste cannot waive clipping, missing source evidence, broken locks, or unreadable type.

The strongest next iteration is driven by rejected ready-only examples: record the exact human objection, reduce it to a focused fixture or invariant where possible, adjust either the semantic guidance or compositor ownership boundary, and rerun the same 50 scenes. Do not tune against WIP rasters as if they were finished candidates.

## Current boundary

The executable v3 composer is currently a repository integration owned by `v3-runner.ts`; the Markdown skill package supplies the semantic behavior and contract. Installing the skill text alone does not install a standalone composer command. General production use should either keep this host-owned handoff or package the compositor and its pinned dependencies as an explicit tool.

The current compositor targets the fixed 1200 × 800 evaluation canvas and a compact set of templates. Broader output sizes and aesthetic range should be added only with the same measured completion checks and new regression fixtures.
