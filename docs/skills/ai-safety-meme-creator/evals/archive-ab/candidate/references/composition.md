# Composition branch

Inspect every supplied image before selecting a frame or placing text. Alt text and dimensions are not visual inspection.

## Native templates

- One beat: one large edge overlay.
- Setup/payoff: setup at the top and comparably forceful payoff at the bottom.
- State contrast: two distinct authentic frames in before/after order.
- Dialogue: separate speaker-adjacent zones with an unmistakable gap and anchor.
- Interface: code, labels, or status text only when the depicted interface carries the joke.

Choose the semantic template first. Negative space does not justify flattening setup and payoff into one quiet corner.

Use the default high-contrast treatment unless the user locks a specific accent palette. Apply a requested accent only to the relevant label or panel; do not recolor authentic source pixels.

## Overlay-first ladder

1. Try hero-size copy over the full-bleed authentic still in its native edge zones.
2. Move a zone to the opposite edge or corner while preserving reading order.
3. Widen the zone, rebalance natural wrapping, or remove unnecessary words.
4. Reduce type modestly, retaining feed-size readability and semantic separation.
5. Add a localized feathered edge gradient where outline alone lacks contrast.
6. Use a better authentic frame.
7. Only then use a band, sidecar, contained frame, blurred margin, or nonsemantic extension, and record why every overlay attempt failed.

## Geometry rules

- Preserve source aspect ratio and use uniform scale.
- Treat caption lines as semantic zones, not forced physical rows.
- Every semantic line is rendered exactly once and every zone remains inside the canvas.
- Zones have zero mutual intersection and retain the intended reading order.
- Glyph ink and opaque backdrops cannot intersect must-preserve faces, reactions, props, gestures, readouts, subtitles, or source-native text.
- A transparent layout rectangle may overlap a coarse protected rectangle only when measured glyph ink does not and recognition remains intact.
- Standard impact copy starts around 5.8–6.5% of canvas width. Step down only for a measured collision or bad wrap. Compact type is for code, dialogue, or a real source-native interface.
- Nested code records explicit indentation levels and visible horizontal offsets.

Render copy deterministically over authentic pixels. Inspect the full output and a 480-pixel preview for clipping, duplicate or missing lines, awkward wraps, obscured hinges, incorrect frame order, text-on-text collisions, and punctuation artifacts.
