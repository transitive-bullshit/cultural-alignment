# AI-safety meme regression suite

The suite separates creative intent from physical composition. Codex chooses the scene hinge, one AI bridge, exact caption beats, source roles, and semantic mode. It does not choose crop rectangles, text boxes, font sizes, or physical wrapping. The deterministic v3 composer owns those values and measures the raster it exports.

These checks are opt-in and excluded from `pnpm test` and `pnpm test:unit`. Use this suite when changing the creator skill, its renderer, or its regression harness. For creating one image, follow [SKILL.md](../SKILL.md); for archive comparisons and generated report browser checks, follow [archive-ab/EVALS.md](archive-ab/EVALS.md). Archived candidate skills under `archive-ab/candidate/` reproduce historical runs and do not govern new work.

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

The [composer contract](../references/composer-contract.md) owns input schemas, font prerequisites, typography, render invariants, and supported output. `safe-render.ts` turns semantic intent into measured geometry using `measured-text.ts` and the same Sharp/Pango path used for export. Fixture-owned geometry, expectations, and human locks remain host inputs.

The direct composer CLI checks physical rendering. This harness additionally runs the semantic/source/feedback evaluator before accepting `complete`, so a CLI `complete` result alone does not establish archive readiness.

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
