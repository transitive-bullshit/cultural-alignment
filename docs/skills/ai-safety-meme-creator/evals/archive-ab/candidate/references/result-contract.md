# Result contract

File-producing runs return a versioned manifest with `status: complete` or `status: blocked`.

A complete result records artifact and preview paths, MIME signatures, dimensions and hashes; source paths, roles, hashes and uniform transforms; the single concept and recognition hinge; template and fallback reason; semantic copy provenance; measured physical lines, glyph boxes, backdrop boxes, font metrics and indentation; transformed protected regions; and recomputed geometry checks.

The renderer, not the producer's prose, measures geometry. Treat self-reported checks as a report that an evaluator must recompute from files and renderer output.

A blocked result records a stable reason code and concrete conflict. Initial codes are `source_pixels_unavailable`, `missing_state_frame`, `conflicting_locked_constraints`, `no_valid_direction`, and `render_invariant_failed`.

For plan-only evaluation requests, follow the caller's supplied structured schema instead of inventing file paths. The same provenance, semantic-zone, source-order, and geometry rules still apply.
