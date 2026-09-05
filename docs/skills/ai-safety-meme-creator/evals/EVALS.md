# AI-safety meme regression suite

The suite separates creative intent from physical composition. Codex chooses the scene hinge, one AI bridge, exact caption beats, source roles, and semantic mode. It does not choose crop rectangles, text boxes, font sizes, or physical wrapping. The deterministic v3 composer owns those values and measures the raster it exports.

## Test layers

Run the deterministic Vitest suite with:

```bash
pnpm test:meme-skill
```

It covers the synthetic fixture corpus, archive selection and feedback locks, semantic-schema parsing, measured wrapping and type fitting, source transforms, protected-region projection, compositor completion and blocking, subprocess behavior, cache keys, and the three-column report. Tests that invoke Codex are discovered but skipped by default.

Run a live authenticated Codex probe with:

```bash
pnpm test:meme-skill:live
```

The live test uses the v3 path. It stages the production `SKILL.md` and routed references, one archived request, its source images, and `semantic-plan.schema.json` in a temporary directory. Codex returns semantic intent. The host then composes and evaluates the raster before the test accepts `complete`.

Useful controls:

```bash
MEME_SKILL_EVAL_FIXTURES=case-id,idea-id pnpm test:meme-skill:live
MEME_SKILL_EVAL_LIMIT=3 pnpm test:meme-skill:live
MEME_SKILL_EVAL_MODEL=model-name pnpm test:meme-skill:live
MEME_SKILL_EVAL_TIMEOUT_MS=240000 pnpm test:meme-skill:live
```

The live test defaults to one archive case. It does not run in CI unless both `MEME_SKILL_EVALS=1` and `MEME_SKILL_EVALS_ALLOW_CI=1` are present. Its temporary artifacts are removed during teardown. Use `pnpm memes:skill-v3` for persistent review artifacts.

## V3 boundary

The agent-visible output is `SemanticMemeIntent` from `semantic-plan.ts` and `semantic-plan.schema.json`. It contains semantic caption roles, provenance, source IDs, the recognition hinge, one bridge, presentation mode, preferred edge, and palette. Fixture-owned source geometry, expectations, and human locks remain host inputs.

`safe-render.ts` converts that intent into a concrete plan. `measured-text.ts` uses the pinned fonts and the same Sharp/Pango raster path used for export. It finds the largest whole-pixel fit above the readability floor, ranks alternate non-code line breaks against measured glyph width without increasing the minimum feasible line count, allows at most a two-pixel font retreat for raster-rounding balance failures, preserves exact caption characters and semantic indentation, and returns a typed block rather than painting an invalid candidate. Code retains greedy wrapping. A one-zone external layout tries the compact well first but continues when its type is below the 55-pixel source / 22-pixel review comfort target.

The composer records measured text layers, wrap mode, font identity, display-case transform, fill/stroke evidence and width, rasterized stroke-pixel counts, source placements and occupancy, protected-region projections, preview font size, edge clearance, caption area, and copy/canvas checks. Default Impact text requires uppercase display, white fill, a `0.05em` pure-black stroke even over an opaque backplate, and balanced non-code wrapping. Code may preserve case, use greedy wrapping, and use an opaque backplate. Must-preserve regions must remain at least 99.5% visible with zero caption overlap, and external fallbacks must retain review-scale source imagery, for a result to be review-ready.

## Result states

- `complete`: the full render and preview exist, hashes are recorded, measured compositor checks pass, and the remaining semantic, source, and lock evaluator reports no violation.
- `invalid`: a raster was produced, but at least one deterministic evaluator invariant failed. It is diagnostic evidence, not an acceptable result.
- `blocked`: the composer could not satisfy a physical invariant and returned a typed reason. No finished raster is claimed.
- `failed`: Codex, schema parsing, staging, or the child process failed after retry handling.
- `pending`: report-only state used when the latest v3 manifest has no result for a selected archive case.

Mutable `unplaceable_text` and `protected_region_conflict` blocks, as well as invalid results, are fed back to Codex for a corrected semantic attempt. Transient process and malformed-output failures are also retried, up to three attempts total.

## Fixture design

The focused raster fixtures are synthetic and copyright-free. Their faces, props, screen text, before/after states, and negative space are exaggerated so each probe isolates one behavior. Rebuild them deterministically with:

```bash
node --import tsx docs/skills/ai-safety-meme-creator/evals/generate-fixture-images.ts
```

The archive suite separately uses 50 manually curated historical cases: 25 finalized positive references and 25 disliked directions. Hidden expectations and feedback-derived locks stay in the host fixture; the agent sees the request and source evidence it would receive in production.

## Oracle boundary

Vitest recomputes objective invariants; the producer's rationale is not evidence. Geometry checks use measured glyph ink and transformed source regions from the compositor. Editorial checks cover exact and retained copy, rejected directions, concepts, source identity and order, semantic placement, punctuation, palette, and other explicit feedback locks.

A deterministic pass does not prove that a meme is funny, surprising, or worth publishing. The HTML comparison remains the human taste gate. Historical plan-based outputs are retained as regression evidence, not as examples of acceptable physical composition.
