# Meme composer regression suite

The creator skill separates creative intent from physical composition. An agent chooses the scene hinge, one AI bridge, exact caption beats, source roles, and semantic mode. The deterministic composer in `safe-render.ts` owns crop, text boxes, font size, wrapping, and export, and measures the raster it produces. The [composer contract](../references/composer-contract.md) owns its schemas, typography, and completion states.

The suite is opt-in and excluded from `pnpm test` and `pnpm test:unit`. Run it when changing the composer, its schemas, or the evaluator:

```bash
pnpm test:meme-skill
```

It covers the synthetic fixture corpus, semantic-schema parsing, measured wrapping and type fitting, source transforms, protected-region projection, compositor completion and blocking, and the semantic, source, and lock evaluator in `evaluate.ts`.

## Fixtures

The raster fixtures in `fixtures/` are synthetic and copyright-free. Their faces, props, screen text, before/after states, and negative space are exaggerated so each probe isolates one behavior. Rebuild them deterministically with:

```bash
node --import tsx docs/skills/ai-safety-meme-creator/evals/generate-fixture-images.ts
```

`feedback_sources` entries record which review notes motivated each fixture; the review rounds they cite were retired on 2026-10-01 and remain in git history.

## Oracle boundary

Vitest recomputes objective invariants; the producer's rationale is not evidence. Geometry checks use measured glyph ink and transformed source regions from the compositor. Editorial checks cover exact and retained copy, rejected directions, concepts, source identity and order, semantic placement, punctuation, palette, and explicit feedback locks.

A deterministic pass does not prove that a meme is funny, surprising, or worth publishing. The owner's pick in the riff workflow is the taste gate.
