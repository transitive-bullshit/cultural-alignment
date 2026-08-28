# Design system

This records the built and selected Dossier system, not an aspirational theme.

## Visual character

The site is a speculative cultural archive without literal institutional or investigative fiction. Its ground is warm paper, its typography is charcoal, and electric orange is reserved for interaction and orientation. The paper/grid ground remains continuous across the viewport; the rejected split-background treatment must not return. Scene imagery provides the color; taxonomy does not turn the gallery into a category rainbow.

Primary roles:

- Display: Barlow Condensed, heavy and tightly tracked
- Reading: Geist, neutral and comfortable at long measures
- Metadata: Geist Mono, compact uppercase labels
- Ground: pale warm paper and subtle grid/rule lines
- Accent: electric orange for crosshairs, selected brackets, active fills, and focused links

## Site shell

Every route uses the same header component: a larger Barlow Condensed wordmark on the left, optional context or tagline in the center, and Search plus Gallery on the right. Header and footer share one wordmark component; only “Alignment” scrambles once on viewport entry and again on deliberate fine-pointer hover. Reduced-motion visitors receive stable copy, and keyboard focus does not trigger decorative motion. The Command-K palette opens without motion and uses highlighted text matches.

A shared footer closes every non-gallery page with archive navigation, project and policy links, the public Notion source, and GitHub/X profiles. Footer links use the same electric-orange interaction treatment as the rest of the archive.

## Gallery

The desktop gallery is a dense five-row projected surface on one horizontal axis. Vertical wheel movement advances the surface; horizontal-dominant trackpad gestures remain browser-owned. At rest, rows are level. Speed reveals the material: left-edge cards shear upward and right-edge cards shear downward, with deformation increasing toward the edges.

Wrapping is cyclic, not mirrored. The deterministic pattern avoids matching horizontal neighbors, including across its seam. Offscreen copies overlap beyond the viewport so partially visible cards never pop. A scenario may appear twice on a wide screen, but only the exact hovered projection becomes vivid and receives orange brackets; moving into a gap clears emphasis instead of selecting another copy.

Hover arrival is deliberately snappier than release. Selected corner brackets scale with the card and replace the rejected adjacent-plus treatment. A small nonvisual hit halo adds pointer tolerance without changing visible spacing. The one-time entrance coast begins fast enough to expose the opposing edge deformation, then settles; user input interrupts it.

Explicit header and lower-chrome safe areas keep cards and brackets on-screen. On desktop, the lower-left selected-frame panel remains stable and contains the keyboard-accessible scenario action. At `680px` and below the visual panel is removed, its canvas space is reclaimed, and an assistive selected-scenario link preserves keyboard and screen-reader access. Touch guidance explains the two-tap select/open model. The WebGL canvas itself is not focusable. On fine pointers, the gallery uses the orange crosshair cursor throughout.

## Dossier

The opening view pairs a cinematic media plate with a grid-owned title and vertical source metadata. The approved title scale is the current, smaller Dossier setting: `clamp(68px, 7.35vw, 120px)` on desktop and `clamp(55px, 17vw, 78px)` on mobile. It has no character-width cap; its layout column governs balanced, complete-word wrapping. The title precedes a vertical, left-× metadata list: source is actionable, episode and year are inert, and an episode label identical to the source title is omitted for movie-style records. The desktop header phrase is centered to the viewport independently of the identity and navigation widths.

The reading order is fixed: Scene, Why this analogy works, Where the analogy breaks. Only the second panel is prominent, while all three reserve identical geometry.

A quiet Copy as Markdown action sits directly below the source metadata in the narrative column. It copies semantic headings, linked metadata, the authored analysis, an absolute Markdown still image, and a timestamped YouTube link when available, then reports short-lived clipboard success or failure.

Risk families and concepts close the dossier reading section. Their links scramble once as they enter and again on deliberate fine-pointer hover. Same-source and cross-source discovery sections follow, with the latter using visible shared taxonomy as context. At wide desktop sizes each section uses three restrained cards; below that breakpoint it shows two. Related-scenario stills use the gallery's washed grayscale treatment until fine-pointer hover or keyboard focus, while same-source stills stay in color. The same richer card is shared by source, risk-family, and concept detail pages, where a continuous collection renders every matching scenario in a responsive three-, two-, or one-column grid. Display headings wrap within their layout boxes rather than arbitrary character-width caps. Scrambling is not used for body copy or ambient decoration.

## Media and spoilers

The full media plate is a play/pause target. Its keyboard focus ring sits outside the media bounds instead of covering the image. A small contextual cursor reads Play clip or Pause clip and disappears over playback, progress, and Return-to-still controls. Explicit controls use Play clip, Pause clip, and Resume clip consistently. The “Scene still” label appears only while the still is visible. The player instance stays mounted when returning to the still, while playback resets to the configured clip start. The custom timeline supports scrubbing and focused keyboard seeking. While a clip plays, custom chrome fades after 2.8 seconds without interaction when the plate is not hovered; hover, pointer or keyboard activity, scrubbing, and control focus restore it immediately, and paused or still states keep it visible. YouTube does not expose a supported top-chrome-only configuration, so its native controls remain disabled rather than mixing two incomplete control surfaces. Missing video is an intentional composed state.

The spoiler warning is the sole spinning-text element and is shared by the featured gallery and Dossier. Its full circular surface is the dismiss target—there is no separate close icon. An orange fill expands on hover/focus, and a versioned local-storage value prevents a dismissed-state hydration flash.

## Motion grammar

- Explore: elastic, continuous, interruptible
- Select: fast, exact, and locally vivid
- Navigate: one confident media-led transition; a short-lived DOM proxy carries the selected WebGL frame into the Dossier media plate
- Read: mostly still, with restrained entry/hover text effects

Avoid scanlines, ambient glitches, fake diagnostics, card collisions, independent drift, springy ornamental movement, and transition stacks that make content wait.

## Responsive behavior

Desktop is the craft target. Mobile uses fewer rows, direct touch drag, first-tap selection/second-tap opening, no persistent selected-frame panel, centered balanced titles, and the same content hierarchy. Functional clarity outranks reproducing desktop density.
