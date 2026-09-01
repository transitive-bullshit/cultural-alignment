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

Every route uses the same header component: a larger Barlow Condensed wordmark on the left, persistent global navigation in the center, and Search on the right. The four archive indexes remain directly visible on desktop, while Project discloses About and Privacy. Desktop destinations use a muted-paper background hover, and the gallery crosshair yields to the browser’s native pointer throughout the navigation surface. At `900px` and below, Search remains visible and a labeled Menu toggle opens the same six destinations in a right-side sheet. Header and footer share one navigation source and one wordmark component; only “Alignment” scrambles once on viewport entry and again on deliberate fine-pointer hover. Reduced-motion visitors receive stable copy, and keyboard focus does not trigger decorative motion. The Command-K palette opens without motion and uses highlighted text matches.

A shared footer closes every non-gallery page with archive navigation, project and policy links, the public Notion source, and GitHub/X profiles. Footer links use the same electric-orange interaction treatment as the rest of the archive.

## Homepage entry

The homepage opens with the Signal Loader: a dark explanatory layer that introduces the scene-to-pattern-to-risk loop while the complete scenario gallery prepares underneath it. Readiness changes the status rail but never dismisses the layer. The visitor enters deliberately through the high-contrast “Explore the archive” action; its short upward exit reveals the already-loaded gallery and transfers focus into that surface. While the introduction is present, the underlying header and gallery remain inert. `/scenarios` presents the same complete gallery and initial framing with risk-family filters added above it; there is no featured subset or alternate gallery mode.

## Gallery

The desktop gallery is a density-adjustable projected surface on one horizontal axis. Its 100% default preserves the original five-row composition; the `/scenarios` toolbar offers a restrained 70–200% frame-size control that steps through every fully fitting row count between seven and two while scaling the horizontal and vertical spacing in lockstep. Pointer dragging uses short, interruptible interpolation, including row entrances and exits at density thresholds; keyboard and reduced-motion changes remain immediate. The preference is versioned in local storage and applies to the homepage gallery without exposing the archive-only control there. Vertical wheel movement advances the surface; horizontal-dominant trackpad gestures remain browser-owned. At rest, rows are level. Speed reveals the material: left-edge cards shear upward and right-edge cards shear downward, with deformation increasing toward the edges.

Wrapping is cyclic, not mirrored. The deterministic pattern avoids matching horizontal neighbors, including across its seam. Offscreen copies overlap beyond the viewport so partially visible cards never pop. A scenario may appear twice on a wide screen, but only the exact hovered projection becomes vivid and receives orange brackets; moving into a gap clears emphasis instead of selecting another copy.

Hover arrival is deliberately snappier than release. Selected corner brackets scale with the card and replace the rejected adjacent-plus treatment. A small nonvisual hit halo adds pointer tolerance without changing visible spacing. The one-time entrance coast begins fast enough to expose the opposing edge deformation, then settles; user input interrupts it.

Explicit header and lower-chrome safe areas keep cards and brackets on-screen. On desktop, the lower-left selected-frame panel remains stable and contains the keyboard-accessible scenario action. At `680px` and below the visual panel is removed, its canvas space is reclaimed, and an assistive selected-scenario link preserves keyboard and screen-reader access. Touch guidance explains the two-tap select/open model. The WebGL canvas itself is not focusable. On fine pointers, the gallery uses the orange crosshair cursor throughout.

## Dossier

The opening view pairs a cinematic media plate with a grid-owned title and vertical source metadata. The approved title scale is the current, smaller Dossier setting: `clamp(68px, 7.35vw, 120px)` on desktop and `clamp(55px, 17vw, 78px)` on mobile. It has no character-width cap; its layout column governs balanced, complete-word wrapping. The title precedes a vertical, left-× metadata list: source is actionable, episode and year are inert, and an episode label identical to the source title is omitted for movie-style records. The desktop header phrase is centered to the viewport independently of the identity and navigation widths.

The reading order is fixed: Scene, Why this analogy works, Where the analogy breaks. Only the second panel is prominent, while all three reserve identical geometry.

A quiet Copy as Markdown action sits directly below the source metadata in the narrative column. It copies semantic headings, linked metadata, the authored analysis, an absolute Markdown still image, and a timestamped YouTube link when available, then reports short-lived clipboard success or failure.

Risk families and concepts close the dossier reading section. Each taxonomy heading links to its full index, while the individual taxonomy links scramble once as they enter and again on deliberate fine-pointer hover. On the risk-family and concept indexes, deliberate fine-pointer hover scrambles only the hovered record title; descriptions, counts, and layout stay still. A hidden original copy owns the text wrapping and block size, while the scrambled copy renders as a layout-independent overlay. Same-source and cross-source discovery sections follow, with the latter using visible shared taxonomy as context. At wide desktop sizes each section uses three restrained cards; below that breakpoint it shows two. Related-scenario stills use the gallery's washed grayscale treatment until fine-pointer hover or keyboard focus, while same-source stills stay in color. The same richer card is shared by source, risk-family, and concept detail pages, where a continuous collection renders every matching scenario in a responsive three-, two-, or one-column grid. Display headings wrap within their layout boxes rather than arbitrary character-width caps. Scrambling is not used for body copy or ambient decoration.

## Media and spoilers

The full media plate is a play/pause target. Its initial poster state uses a large central play mark, and its keyboard focus ring sits outside the media bounds instead of covering the image. A branded play/pause pointer and contextual label replace the gallery-style crosshair and disappear over the progress control. Explicit controls use Play clip, Pause clip, and Resume clip consistently. The “Scene still” label is reserved for scenarios without video. The player instance stays mounted when returning to the still, while playback resets to the configured clip start. The custom timeline supports scrubbing and focused keyboard seeking. While a clip plays, custom chrome fades after 2.8 seconds without interaction when the plate is not hovered; hover, pointer or keyboard activity, scrubbing, and control focus restore it immediately, and paused or still states keep it visible. YouTube does not expose a supported top-chrome-only configuration, so its native controls remain disabled rather than mixing two incomplete control surfaces. Missing video is an intentional composed state.

The spoiler warning is the sole spinning-text element and appears on desktop Dossiers only; mobile-layout and touch-first devices omit it. A compact archive note carries the explanatory copy and overlaps an empty-center circular seal whose orbit repeats “Spoiler warning” three times with dot separators. On fine-pointer hover or keyboard focus, the orbit fades out and one centered white “I’m okay with spoilers” message fills the orange seal. The full note-and-seal surface acknowledges the warning—there is no separate close icon—then turns orange, briefly confirms “Spoilers noted,” retracts, and fades. A versioned local-storage value prevents a dismissed-state hydration flash.

## Motion grammar

- Explore: elastic, continuous, interruptible
- Select: fast, exact, and locally vivid
- Navigate: one confident media-led transition; a short-lived DOM proxy carries the selected WebGL frame into the Dossier media plate
- Read: mostly still, with restrained entry/hover text effects

Avoid scanlines, ambient glitches, fake diagnostics, card collisions, independent drift, springy ornamental movement, and transition stacks that make content wait.

## Responsive behavior

Desktop is the craft target. Mobile uses fewer rows—including one fully framed row on short landscape surfaces—direct touch drag, first-tap selection/second-tap opening, no persistent selected-frame panel, centered balanced titles, and the same content hierarchy. Functional clarity outranks reproducing desktop density.
