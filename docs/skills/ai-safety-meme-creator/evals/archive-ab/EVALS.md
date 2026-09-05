# 50-scene three-way regression

This harness shows three versions of the same 50 manually curated meme scenarios:

1. **Historical · current** — the original production-skill sample rendered by the legacy plan renderer.
2. **Historical · proposed** — the first candidate-skill sample rendered by that same legacy renderer.
3. **V3 · revised** — the current production skill's semantic intent rendered by the measured deterministic composer.

The first two columns are fixed historical evidence. Their labels do not mean they are the current production code, and a generated file does not make a historical output valid.

## Cases and feedback locks

`selection.ts` fixes 50 unique scenarios:

- 25 human-finalized positive references from Batch 5
- 25 human-disliked directions from earlier rounds, favoring written feedback and then broader concept, copy, source, and format coverage

Finalized fixtures preserve approved caption bytes, source identities and order, and recoverable explicit layout treatments. Disliked fixtures carry the rejected caption, format, and original note. Retained ingredients stay locked; terminal dislikes require a materially different direction. Every source is staged by content hash, and protected-region metadata travels with it.

## Run v3 and build the report

Run the current production skill across the selected archive cases, then replace only the revised cells in the preserved standalone page:

```bash
pnpm memes:skill-v3
pnpm memes:skill-v3:recover-report
```

When only the deterministic composer changes, reuse all 50 stored semantic intents without calling Codex again:

```bash
pnpm memes:skill-v3:recompose
pnpm memes:skill-v3:recover-report
```

Recomposition rebuilds each archive fixture from the preserved selection and content-addressed sources, then runs the current safe renderer. It writes to a separate `recomposed` artifact namespace, refreshes plans, checks, statuses, paths, and hashes, and atomically replaces `run-manifest.json` only after every case finishes. The original manifest is retained as a timestamped `run-manifest.before-recompose-*.json` sibling. A newly blocked case has no render or preview path, so recovery keeps that comparison in WIP.

The v3 run uses the default authenticated `codex` session, four concurrent cases, a 240-second timeout per invocation, and up to three attempts. Codex returns semantic intent only. The host-owned composer measures physical text and source geometry, exports the full PNG and 480-pixel preview, and evaluates the result.

Useful v3 overrides:

```bash
MEME_SKILL_ARCHIVE_V3_CASES=case-id,idea-id pnpm memes:skill-v3
MEME_SKILL_ARCHIVE_V3_LIMIT=5 pnpm memes:skill-v3
MEME_SKILL_ARCHIVE_V3_CONCURRENCY=2 pnpm memes:skill-v3
MEME_SKILL_ARCHIVE_V3_TIMEOUT_MS=360000 pnpm memes:skill-v3
MEME_SKILL_ARCHIVE_V3_MODEL=model-name pnpm memes:skill-v3
```

A limited run replaces the latest v3 manifest with that subset and is useful for diagnosis. Do not run recovery until a subsequent full run restores all 50 manifest results.

The recovery command deliberately requires a complete manifest whose cases match every row in the page. Before an atomic update, it creates a timestamped `archive-ab-comparison.before-v3-recovery-*.html` sibling backup. It preserves the historical current/proposed section bytes, replaces revised sections, adds stable case and idea hooks, and recomputes row readiness and summary counts. A partial or mismatched manifest leaves the page untouched.

The legacy command remains available to reconstruct the two historical columns:

```bash
pnpm memes:skill-ab
```

It makes 100 plan-based Codex invocations and writes the historical manifest. It is not the v3 acceptance path.

## Run the V4 Impact pass

Recompose the same 50 stored semantic intents with the current typography contract, preserving an immutable V3 snapshot, then build the focused two-column review page:

```bash
pnpm memes:skill-v4-impact
pnpm memes:skill-v4-impact:report
```

V4 uses an actual Impact font file for default captions, applies uppercase only at display time, and renders white fill plus a pure-black stroke even over a backplate. Readiness also requires raster evidence that the requested stroke produced opaque black pixels; metadata alone cannot qualify a pair. V3 and V4 must both pass their applicable mechanical checks before a row appears in the default Ready filter.

## Run the V5 stroke and wrap pass

Recompose the same frozen V4 intents after typography calibration, then build the focused V4/V5 page:

```bash
pnpm memes:skill-v5-stroke-wrap
pnpm memes:skill-v5-stroke-wrap:report
```

V5 halves the default Impact outline from `0.10em` to `0.05em` and balances non-code physical lines without increasing their minimum feasible line count. It prefers layouts without a one-word final line, preserves semantic copy and authored caption-block boundaries, and leaves code on greedy source-preserving wrapping. V5 readiness requires measured `0.05em` stroke width, the matching raster-pixel width, opaque black stroke pixels, and the balanced wrap mode for every default Impact layer. V4 and V5 must both verify before a row appears in the default Ready filter.

When both historical and v3 manifests are available, `pnpm memes:skill-ab:report` can rebuild the page from structured data. Use the recovery command when the historical manifest is unavailable but the self-contained HTML still holds its images.

## Result and readiness semantics

V3 uses strict states:

- `complete` means the revised render passed measured compositor checks and all remaining semantic, source, and feedback-lock invariants.
- `invalid` means image files exist but deterministic evaluation found a violation.
- `blocked` means composition could not meet an invariant; the typed reason is retained and no finished image is claimed.
- `failed` means the invocation or structured-output path failed after retries.
- `pending` exists only in the report when no revised result is present.

A row is **ready for comparison** only when both historical previews load and the revised result is `complete`, its preview loads, both artifact hashes exist, copy and canvas checks pass, source-frame evidence exists, and every must-preserve region is at least 99.5% visible with zero caption overlap.

Historical invariant failures do not make a row WIP: those broken images are the baseline being compared. They are labeled `historical invalid` in their own columns. `Ready` means all three images are present and the v3 candidate is objectively verified; it is not an endorsement of either historical image.

The report defaults to **Ready for comparison**. Use the separate status control to inspect `WIP`, and the variant badges to distinguish historical invalid, v3 invalid, blocked, failed, and pending outputs.

## Artifacts and cache

Historical artifacts live under `test-results/meme-skill-archive-ab/`. Revised artifacts live under `test-results/meme-skill-archive-v3/`. The isolated Impact pass and its frozen V3 baseline live under `test-results/meme-skill-archive-v4-impact/`. The thinner-stroke and balanced-wrap pass plus its frozen V4 baseline live under `test-results/meme-skill-archive-v5-stroke-wrap/`.

The v3 tree contains:

- `run-manifest.json` — latest selection and revised outcome for each run case
- `sources/` — content-addressed source images
- `cache/<case>/revised/<key>/` — request, semantic intent, invocation logs, outcome, evaluation, full render, and preview when produced
- `cache/<case>/recomposed/<key>/` — deterministic re-renders of stored intents with no Codex invocation
- `failures/` — failed invocations plus their staged agent inputs

The cache key covers the request, expectations, feedback, prompt, model, Codex version, production skill package, source bytes, semantic schema, composer, evaluator, and geometry code. Repeating an identical full run resumes from valid cached outcomes.

## View the comparison

The report builders are the durable comparison tool. They write local, self-contained HTML review artifacts that are intentionally gitignored because each file embeds the complete image batch:

```text
docs/skills/ai-safety-meme-creator/archive-ab-comparison.html
```

Serve that directory locally, for example:

```bash
python3 -m http.server 4310 --directory docs/skills/ai-safety-meme-creator
```

Then open `http://127.0.0.1:4310/archive-ab-comparison.html`.

The focused V3/V4 typography comparison is `http://127.0.0.1:4310/archive-impact-comparison.html` after running the V4 report command.

The focused V4/V5 stroke and wrapping comparison is `http://127.0.0.1:4312/archive-stroke-wrap-comparison.html` while the local review server is running on port 4312.

The report is deliberately compact and self-contained. Each row shows archived copy and human feedback, the three image columns, status badges, measured v3 type and clearance, and expandable invariant details.

## Tests and limits

Run deterministic coverage with:

```bash
pnpm test:meme-skill
```

Run the opt-in v3 live integration with:

```bash
pnpm test:meme-skill:live
```

Objective verification prevents clipped text, missing files, hidden must-preserve evidence, broken locks, and other known mechanical failures from being labeled ready. It does not score humor or taste. Human review of the ready-only page remains the acceptance gate.
