# Deterministic composer contract

Use the composer for all physical layout and file-producing work. The seam is semantic intent in, measured `complete` or typed `blocked` out.

The repository entry point is `scripts/compose-meme.ts`, invoked from the workspace as documented in `SKILL.md`. It accepts fixture and semantic-intent JSON, resolves source paths relative to the fixture, and returns the measured result as JSON. A host may supply an equivalent composer. Without either implementation, this skill can produce concepts only.

## Semantic input

Provide only information known before rendering:

- requested dimensions and file type;
- authentic source assets with stable IDs and semantic roles;
- one AI concept and one recognition hinge;
- exact caption beats, their reading order, copy provenance, and any semantic indentation;
- semantic mode and speaker or state anchors when applicable;
- must-preserve and soft protected regions in source coordinates;
- explicit human locks such as top/setup and bottom/payoff, source order, frame treatment, or palette.

Numeric crop rectangles, canvas text bounds, font sizes, line heights, baselines, physical line counts, and glyph measurements are renderer outputs. Keep them out of authored intent even when an evaluation fixture exposes similarly named legacy fields.

## Composer responsibilities

The composer selects and verifies physical layout using the same pinned font files and raster backend used for export. It owns source transforms, candidate placement, measured wrapping, largest-readable type fitting, contrast treatment, fallback selection, compositing, preview generation, and post-render checks. It tries the smallest measured caption well first so text does not needlessly starve the source image. For a one-zone external caption, it must keep evaluating larger wells when the compact candidate is below the 55-pixel source / 22-pixel review comfort target; the first comfortable candidate on the requested edge wins, otherwise the largest valid candidate wins. An external fallback must normally keep at least 75% of the canvas height available as visible source imagery for one caption zone, or 60% for two zones. Measured locked or source-native copy that genuinely needs three or more physical lines may use a 65% one-zone floor; it may not lower the 18-pixel review type floor.

For every caption using the default meme style, the composer must:

- render with an actual Impact font file, never a similar condensed face or fallback;
- transform alphabetic characters to uppercase for display;
- use white (`#ffffff`) fill and a restrained pure-black (`#000000`) stroke at `0.05em`, rounded up to a whole raster pixel;
- balance physical lines within each non-code caption block while keeping the minimum feasible line count, preferring layouts without a one-word final line; rank alternate breaks against measured glyph width instead of trusting character counts alone, and permit at most a two-pixel font retreat when raster rounding is the only thing preventing a balanced fit;
- retain both fill and stroke when an opaque foreground backplate is also present.

The uppercase transform is presentational. The semantic beat remains exactly as authored, and display text preserves its words, punctuation, numbers, and character order. Balanced wrapping may add line breaks only and never moves words across authored caption blocks. When a singleton line is unavoidable, preserve the copy and valid fit. Explicit code styles use greedy wrapping, their pinned face, preserved case and indentation, and a measured source-appropriate contrast treatment; they are distinct styles, not fallbacks for an Impact caption. If an actual Impact file is unavailable, block rather than substitute another font.

The composer measures glyph ink including the black stroke on an unclipped temporary surface. A candidate is valid only when measured ink and opaque backdrops remain inside their padded canvas zones, caption zones do not collide, must-preserve evidence remains unobscured and large enough to read at preview scale, and source transforms preserve aspect ratio. Long locked text that cannot fit above the readability floor blocks instead of overflowing or silently changing.

## Results

A `complete` result contains:

- final artifact and feed-preview paths, dimensions, MIME signatures, and hashes;
- exact semantic beats and source identities;
- selected template and frame transforms;
- measured physical lines, wrap mode, resolved font identity, display-case transform, font metrics, glyph bounds, fill/stroke values and widths, rasterized stroke-pixel counts, opaque-backplate evidence, backdrop bounds, source occupancy, and transformed protected regions;
- recomputed clearances for canvas edges, caption zones, and must-preserve regions.

`complete` means every objective render invariant passed. File creation alone is not completion, and evaluator notes cannot coexist with a complete geometry result.

A `blocked` result contains a stable reason code and actionable message. Use `source_pixels_unavailable`, `missing_state_frame`, `missing_font`, `conflicting_locked_constraints`, `unplaceable_text`, `protected_region_conflict`, or `render_invariant_failed` as applicable.

Retry only when the blocked reason identifies a mutable ingredient. Tighten mutable copy, choose another authentic frame, or change the semantic mode, then compose again. Stop when only locked constraints remain or two materially different corrections fail. Return the blocked result rather than a partial raster.
