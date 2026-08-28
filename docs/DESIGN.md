# Design system

This records the built and selected Dossier system, not an aspirational theme.

## Visual character

The site is a speculative cultural archive without literal institutional or investigative fiction. Its ground is warm paper, its typography is charcoal, and electric orange is reserved for interaction and orientation. Scene imagery provides the color; taxonomy does not turn the gallery into a category rainbow.

Primary roles:

- Display: Barlow Condensed, heavy and tightly tracked
- Reading: Geist, neutral and comfortable at long measures
- Metadata: Geist Mono, compact uppercase labels
- Ground: pale warm paper and subtle grid/rule lines
- Accent: electric orange for crosshairs, selected brackets, active fills, and focused links

## Gallery

The desktop gallery is a dense five-row projected surface on one horizontal axis. Vertical wheel movement advances the surface; horizontal-dominant trackpad gestures remain browser-owned. At rest, rows are level. Speed reveals the material: left-edge cards shear upward and right-edge cards shear downward, with deformation increasing toward the edges.

Wrapping is cyclic, not mirrored. Offscreen copies overlap beyond the viewport so partially visible cards never pop. A scenario may appear twice on a wide screen, but only the exact hovered projection becomes vivid and receives orange brackets.

Hover arrival is deliberately snappier than release. The one-time entrance coast briefly exposes the deformation, then settles; user input interrupts it. Selected metadata remains stable and subordinate to the image field.

## Dossier

The opening view pairs a cinematic media plate with a grid-owned title and vertical source metadata. The title has no character-width cap; its layout column governs balanced, complete-word wrapping. The reading order is fixed: Scene, Why this analogy works, Where the analogy breaks. Only the second panel is prominent, while all three reserve identical geometry.

Risk families and concepts form the dossier footer. Their links scramble once as they enter and again on deliberate hover/focus. This effect is not used for body copy or ambient decoration.

## Media and spoilers

The full media plate is a play/pause target. A small contextual cursor reads Play clip or Pause clip and disappears over foreground controls. The player stays mounted when returning to the still, preserving state; the custom timeline supports scrubbing and focused keyboard seeking. Missing video is an intentional composed state.

The spoiler warning is the sole spinning-text element. Its full circular surface is dismissible, an orange fill expands on hover/focus, and a versioned local-storage value prevents a dismissed-state hydration flash.

## Motion grammar

- Explore: elastic, continuous, interruptible
- Select: fast, exact, and locally vivid
- Navigate: one confident media-led transition
- Read: mostly still, with restrained entry/hover text effects

Avoid scanlines, ambient glitches, fake diagnostics, card collisions, independent drift, springy ornamental movement, and transition stacks that make content wait.

## Responsive behavior

Desktop is the craft target. Mobile uses fewer rows, direct touch drag, first-tap selection/second-tap opening, centered balanced titles, and the same content hierarchy. Functional clarity outranks reproducing desktop density.
