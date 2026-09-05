---
name: ai-safety-meme-creator
description: Create or revise a standalone AI-safety pop-culture meme from a supplied scene and authentic still. Use for meme concept or copy work, deterministic image composition, and feedback-bounded revisions.
---

# AI-safety meme creator

Produce one unmistakable scene cue + one concrete AI bridge, then stop.

## Route

- Read [references/editorial.md](references/editorial.md) when concept or copy is mutable.
- Read [references/composition.md](references/composition.md) for a finished render or any frame, layout, typography, or contrast change.
- Read [references/revision.md](references/revision.md) when prior output, ratings, notes, or locked ingredients are supplied.
- For file-producing work, follow [references/result-contract.md](references/result-contract.md).

## Input contract

Treat supplied scene facts, caveats, protected regions, and fictional fixture provenance as authoritative. Verify only relevant current or external claims the request does not establish.

Mark exact copy, canonical quotes, source assets, dimensions, file type, and requested layout as locked when the user supplies them as final. Preserve locked values byte for byte. If locked requirements conflict with one another or with an objective render invariant, emit a blocked result naming the conflict; never silently rewrite or claim a finished asset.

## Workflow

1. Record exactly one recognition hinge, one AI concept, and every must-preserve image region. This step is complete when all three are present in the result manifest.
2. If copy is mutable, select one direction with the highest recognition and payoff per word. Use one semantic caption zone when the image supplies the setup; use two for setup/payoff, inversion, state contrast, or dialogue. This step is complete when every word serves either recognition or the single bridge.
3. Bind the direction to its native template: one-beat edge overlay; setup at top and payoff at bottom; genuine state contrast with unique before/after assets; speaker-adjacent dialogue with a measured gap; source-native interface only when the interface carries the joke.
4. Render final text as a deterministic foreground layer over undistorted authentic source pixels. Start with a cover overlay. Record a concrete fallback reason when a must-preserve hinge forces an alternate edge, smaller readable type, alternate frame, band, sidecar, contain treatment, or extension.
5. Export the requested dimensions and file type, defaulting to WebP or JPEG when neither is specified. Also export a 480-pixel preview and `result.json`. Recompute objective checks from the files and measured layout before returning complete.

## Objective invariants

- Each semantic caption zone appears exactly once, stays inside the canvas, follows reading order, and has zero intersection with another caption zone.
- Rendered glyph ink and opaque backdrops have zero intersection with must-preserve faces, reactions, props, readouts, gestures, and source-native text. A transparent layout box may overlap a coarse protected box only when measured ink does not and recognition survives. Soft regions may overlap with a recorded reason.
- A state contrast uses two distinct source hashes in declared before/after order. Every other native template uses one source unless its contract explicitly says otherwise.
- Every source transform uses uniform scale and preserves aspect ratio.
- Conventional impact copy starts at hero size. Standard size requires a recorded collision or wrapping reason. Compact is reserved for code, dialogue, or source-native interfaces.
- Generated fragments omit cosmetic terminal periods. Locked copy, canonical quotes, decimals, ellipses, abbreviations, questions, exclamations, filenames, and code preserve their exact punctuation.
- Nested code carries explicit indentation levels and measured horizontal offsets.
- A fallback panel or external frame requires a recorded failed overlay attempt against the same must-preserve regions.

## Evaluation

Objective checks run against the exported raster and renderer-captured geometry. Do not encode a passing self-review as a required literal value.

An independent evaluator receives only the request facts, source pixels, final raster, and neutral rubric. It judges exact-scene recognition, one clear AI mapping, standalone parsing, comic or emotional force, and visible proof. Replace a weak direction instead of rationalizing it.

## Delivery

Return the final artifact, 480-pixel preview, and versioned result manifest. Print `MEME_RESULT=/absolute/path/result.json` as the stable handoff marker.
