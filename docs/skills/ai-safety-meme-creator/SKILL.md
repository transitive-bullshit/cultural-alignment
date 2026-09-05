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

Read every branch that applies. A finished revision normally requires all three.

## Authority and locks

Treat supplied scene facts, scenario caveats, authentic assets, and fictional fixture provenance as authoritative. Verify only relevant external facts the request does not establish.

Explicitly finalized copy, canonical wording, source assets, source order, output requirements, semantic placement, and visual treatments are locks. Preserve them exactly unless the user asks to change that ingredient. If locks conflict with scene truth or a measured render invariant, return a blocked result naming the conflict.

## Core workflow

1. Inspect every candidate source image. Record one recognition hinge, one AI bridge, and the visible regions that carry the scene. The intent is ready when each is explicit and every must-preserve region belongs to a selected source.
2. If concept or copy is mutable, use the editorial branch to choose one direction and its semantic mode. The direction is ready when every caption beat serves either recognition or the single bridge.
3. Express the result as semantic intent: exact caption beats and provenance, source IDs and roles, protected regions, semantic mode, output requirements, and explicit human locks.
4. Submit that intent to the deterministic composer. In this repository, write validated fixture and intent JSON and run `node --import tsx docs/skills/ai-safety-meme-creator/scripts/compose-meme.ts --fixture <fixture.json> --intent <intent.json> --output <render.png> --preview <preview.png>`. The composer exclusively owns crop coordinates, text boxes, physical wrapping, font size, line height, baselines, padding, contrast geometry, and export. Never estimate or self-report those values as measured layout. If neither this entry point nor a host-owned equivalent is available, return concept-only semantic intent and do not claim a finished image.
5. Deliver only a composer result with `status: complete`. When the composer returns `blocked`, revise only mutable ingredients identified by the reason or return the blocked result. A blocked render is not a finished meme.

## Content invariants

- Preserve canon accuracy: names, spelling, numbers, units, speaker, capability state, chronology, and before/after order.
- Make the visible scene support the caption; do not rely on invisible intent or unsupported plot claims.
- Use one authentic frame unless a real state contrast requires two distinct, correctly ordered frames.
- Keep semantic copy exact. The composer may add physical line breaks and the declared display-case transform; neither may change words, punctuation, numbers, or character order.
- Render final text as a deterministic foreground layer. Generated imagery may extend nonsemantic background pixels, but it does not spell the caption.
- Keep the recognition evidence large enough to read at the review-preview size. A fully visible face, prop, or scene hinge that has been reduced to an unusable thumbnail does not satisfy completion.

## Delivery

Unless the user requests concepts or variants, return the single strongest complete image, its dimensions and path, and a compact record of the concept, hinge, exact semantic beats, source roles, semantic mode, and locks honored.

For concept-only work, return semantic intent without claiming a render exists. For an impossible locked request, return the composer's typed blocked result without inventing an asset.
