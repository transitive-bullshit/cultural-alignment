---
name: ai-safety-meme-creator
description: Create or revise a finished pop-culture meme that maps an exact scene to one concrete AI or AI-safety concept, using authentic source frames and deterministic composition.
---

# Create AI-safety pop-culture memes

Produce one unmistakable scene cue + one concrete AI bridge, then stop.

## Route

- Read [references/editorial.md](references/editorial.md) when the concept, caption, frame choice, or semantic mode is mutable.
- Read [references/revision.md](references/revision.md) whenever prior output, ratings, notes, approvals, rejections, or requested fixes are supplied.
- Read [references/composer-contract.md](references/composer-contract.md) for every finished image, layout change, or plan consumed by a renderer.
- Read the repository's [generation policy](../../../data/meme-review/GENERATION_POLICY.md) when working with review batches, lineage, finalization, or publication. This skill's composer does not publish to the review tool or Notion.

Read every branch that applies. A finished revision normally requires the editorial, revision, and composer references.

## Authority and locks

Treat supplied scene facts, scenario caveats, authentic assets, and fictional fixture provenance as authoritative. Verify only relevant external facts the request does not establish.

Explicitly approved copy, canonical wording, source assets, source order, output requirements, semantic placement, and visual treatments are locks. Preserve them exactly unless the user asks to change that ingredient. In the review tool, a Like alone keeps a lineage mutable; `locked: true` freezes its exact finalized version under the generation policy. If locks conflict with scene truth or a measured render invariant, report the conflict without claiming a finished image.

## Core workflow

1. Inspect every candidate source image. Record one recognition hinge, one AI bridge, and the visible regions that carry the scene. The intent is ready when each is explicit and every must-preserve region belongs to a selected source.
2. If concept or copy is mutable, use the editorial branch to choose one direction and its semantic mode. The direction is ready when every caption beat serves either recognition or the single bridge.
3. Write the fixture and semantic intent using the schemas and field ownership in the composer contract. The fixture carries source evidence and human locks; intent carries exact caption beats, provenance, source roles, and semantic mode.
4. From the repository root, run `node --import tsx docs/skills/ai-safety-meme-creator/scripts/compose-meme.ts --fixture <fixture.json> --intent <intent.json> --output <render.png> --preview <preview.png>`. This implementation exports a 1200 × 800 PNG and a 480-pixel-wide preview, and requires an actual Impact font. It exclusively owns crop coordinates, text boxes, physical wrapping, font size, line height, baselines, padding, contrast geometry, and export. If neither this entry point nor a host-owned equivalent is available, return concept-only semantic intent.
5. Deliver only when the composer returns `status: complete`, the caption and selected sources honor the request and locks, and the preview passes visual inspection. The CLI verifies physical composition; it does not run the archive's additional editorial evaluator. When it returns `blocked`, revise only mutable ingredients identified by the reason or return that result.

## Content invariants

- Preserve canon accuracy: names, spelling, numbers, units, speaker, capability state, chronology, and before/after order.
- Make the visible scene support the caption; do not rely on invisible intent or unsupported plot claims.
- Use one authentic frame unless a real state contrast requires two distinct, correctly ordered frames.
- Keep semantic copy exact. The composer may add physical line breaks and the declared display-case transform; neither may change words, punctuation, numbers, or character order.
- Render final text as a deterministic foreground layer. Generated imagery may extend nonsemantic background pixels, but it does not spell the caption.
- Keep the recognition evidence large enough to read at the review-preview size. A fully visible face, prop, or scene hinge that has been reduced to an unusable thumbnail does not satisfy completion.

## Delivery

Unless the user requests concepts or variants, return the single strongest complete image, its dimensions and path, and a compact record of the concept, hinge, exact semantic beats, source roles, semantic mode, and locks honored.

For concept-only work, return semantic intent without claiming a render exists. For an impossible locked request, report the conflict and include the composer's typed blocked result when available.
