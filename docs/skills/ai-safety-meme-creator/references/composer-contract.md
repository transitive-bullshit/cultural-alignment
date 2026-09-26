# Deterministic composer contract

Use the composer for all physical layout and file-producing work. The seam is semantic intent in, measured `complete` or typed `blocked` out.

The repository entry point is [`scripts/compose-meme.ts`](../scripts/compose-meme.ts), invoked from the repository root as documented in [SKILL.md](../SKILL.md). It accepts fixture and semantic-intent JSON, resolves image paths relative to the fixture file, and prints the measured result as JSON. A host may supply an equivalent composer. Installing the Markdown skill alone does not install the repository's TypeScript renderer or dependencies.

The current implementation exports a fixed 1200 × 800 PNG. `--preview` optionally writes a 480-pixel-wide PNG, or WebP when the preview filename ends in `.webp`. Arbitrary dimensions and full-artifact formats are not supported input fields. If the request requires another output contract, report that limitation rather than claiming the composer honored it.

Default captions require an actual Impact font. The resolver checks platform font locations or an explicit `MEME_IMPACT_FONT_PATH`; it returns `missing_font` when no verified Impact face is available. Impact is not the bundled Barlow Condensed font used for site social images. Use the installed repository dependencies for the Sharp/Pango raster backend and code styles.

## Input ownership

Use the executable schemas rather than inventing JSON fields:

- **Fixture:** [`memeSkillFixtureSchema`](../evals/schema.ts) owns the request, authentic source images, protected regions, feedback provenance, and allowed or locked expectations. [`fixtures/scenarios.json`](../evals/fixtures/scenarios.json) shows complete examples; those fixture-loader image paths are relative to `evals/`, so rebase them when creating a standalone CLI fixture. Despite its legacy name, `protected_regions[].canvas_rect_pct` is `[x, y, width, height]` in percentages of the identified source image, before its canvas transform.
- **Intent:** [`semanticMemeIntentSchema`](../evals/semantic-plan.ts) and its [JSON schema](../evals/semantic-plan.schema.json) own one AI bridge, the recognition hinge's region IDs, exact caption beats and provenance, source IDs and roles, semantic mode, preferred edge, and palette. `fixture_id` must equal the fixture's `id`. Speaker anchors and indentation belong here when applicable.

Numeric crop rectangles, canvas text bounds, font sizes, line heights, baselines, physical line counts, and glyph measurements are renderer outputs. Keep them out of authored intent even when an evaluation fixture exposes similarly named legacy fields.

## Composer responsibilities

The composer selects and verifies physical layout using the same resolved font files and raster backend used for export. It owns source transforms, candidate placement, measured wrapping, largest-readable type fitting, contrast treatment, fallback selection, compositing, preview generation, and post-render checks. It tries the smallest measured caption well first so text does not needlessly starve the source image. For a one-zone external caption, it must keep evaluating larger wells when the compact candidate is below the 55-pixel source / 22-pixel review comfort target; the first comfortable candidate on the requested edge wins, otherwise the largest valid candidate wins. An external fallback must normally keep at least 75% of the canvas height available as visible source imagery for one caption zone, or 60% for two zones. Measured locked or source-native copy that genuinely needs three or more physical lines may use a 65% one-zone floor; it may not lower the 18-pixel review type floor.

For every caption using the default meme style, the composer must:

- render with an actual Impact font file, never a similar condensed face or fallback;
- transform alphabetic characters to uppercase for display;
- use white (`#ffffff`) fill and a restrained pure-black (`#000000`) stroke at `0.05em`, rounded up to a whole raster pixel;
- balance physical lines within each non-code caption block while keeping the minimum feasible line count, preferring layouts without a one-word final line; rank alternate breaks against measured glyph width instead of trusting character counts alone, and permit at most a two-pixel font retreat when raster rounding is the only thing preventing a balanced fit;
- retain both fill and stroke when an opaque foreground backplate is also present.

The uppercase transform is presentational. The semantic beat remains exactly as authored, and display text preserves its words, punctuation, numbers, and character order. Balanced wrapping may add line breaks only and never moves words across authored caption blocks. When a singleton line is unavoidable, preserve the copy and valid fit. Explicit code styles use greedy wrapping, their pinned face, preserved case and indentation, and a measured source-appropriate contrast treatment; they are distinct styles, not fallbacks for an Impact caption. If an actual Impact file is unavailable, block rather than substitute another font.

The composer measures glyph ink including the black stroke on an unclipped temporary surface. A candidate is valid only when measured ink and opaque backdrops remain inside their padded canvas zones, caption zones do not collide, must-preserve evidence remains unobscured and large enough to read at preview scale, and source transforms preserve aspect ratio. Long locked text that cannot fit above the readability floor blocks instead of overflowing or silently changing.

## Results

A CLI `complete` result contains:

- final artifact path, dimensions, format, and SHA-256 hash; preview path and hash when requested;
- exact semantic beats and source identities;
- selected template and frame transforms;
- measured physical lines, wrap mode, resolved font identity, display-case transform, font metrics, glyph bounds, fill/stroke values and widths, rasterized stroke-pixel counts, opaque-backplate evidence, backdrop bounds, source occupancy, and transformed protected regions;
- recomputed clearances for canvas edges, caption zones, and must-preserve regions.

`complete` means the composer's physical render checks passed. File creation alone is not completion. The CLI does not run [`evaluateMemePlan`](../evals/evaluate.ts), which the archive runner additionally uses to check semantic, source, and feedback expectations. Honor those expectations and inspect the preview before delivery; archive acceptance also requires its evaluator to pass.

A `blocked` result contains a reason code and actionable message. The implemented codes are `missing_source`, `missing_font`, `unplaceable_text`, `protected_region_conflict`, and `render_invariant_failed`. Invalid fixture/intent JSON or a mismatched fixture ID causes a CLI error rather than a typed render block. Read the JSON `status`: a typed block does not itself produce a nonzero process exit.

Retry only when the blocked reason identifies a mutable ingredient. Tighten mutable copy, choose another authentic frame, or change the semantic mode, then compose again. Stop when only locked constraints remain or two materially different corrections fail. Return the blocked result rather than a partial raster.
