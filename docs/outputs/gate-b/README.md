# Feedback Gate B — interactive prototype

Status: approved and archived. The creator selected Dossier, approved the spatial-gallery direction through successive refinement passes, and authorized production work beyond the former gates on 2026-08-28.

## Former review routes

The `/prototypes` routes and rejected variant code were removed after approval. Their production replacements are `/`, `/scenarios`, `/scenarios/[slug]`, and the source, risk-family, and concept pivots. This directory preserves the fixed captures and transition recording as decision evidence only.

The user explicitly excluded deployment from this workstream, so these routes are served by the local production preview rather than a Vercel URL.

## Review artifacts

- `gallery-desktop-viewport-1440x900.jpg`
- `gallery-fast-shear-desktop-1440x900.jpg`
- `gallery-instance-hover-desktop-1440x900.jpg`
- `gallery-pointer-gap-desktop-1440x900.jpg`
- `gallery-intro-entry-desktop-1440x900.jpg`
- `gallery-mobile-viewport-390x844.jpg`
- `gallery-ultrawide-wrap-2560x900.jpg`
- `dossier-desktop-viewport-1440x900.jpg`
- `dossier-mobile-viewport-390x844.jpg`
- `dossier-no-video-mobile-viewport-390x844.jpg`
- `dossier-taxonomy-desktop.jpg`
- `dossier-video-paused-desktop-1440x900.jpg`
- `spoiler-hover-desktop-1440x900.jpg`
- `gallery-to-dossier-transition-frame.jpg`
- `gallery-to-dossier-transition.mp4` — retained as the initial Gate B continuity baseline; the refreshed frame above shows the corrected gallery geometry

## Implemented for this gate

- One-axis horizontal WebGL projected surface with vertical-wheel projection and pointer/touch drag; horizontal-dominant fine-pointer wheel gestures pass through for native browser history navigation
- Responsive direct wheel travel plus frame-rate-independent inertia, immediate reversal, damping, and horizontal selected-card recentering
- Five fixed desktop lanes and roughly eight visible columns at 1440px, using 25 fixture identities as a deterministic repeating surface pattern
- Seam-safe cyclic modular mapping that preserves repeated scenarios without placing matching records next to each other horizontally
- Absolute-speed clip-space deformation that compresses the five rows toward center and bends segmented cards progressively toward both edges, then returns the entire surface to level at rest
- A one-time, visibility-triggered 3.6-column entrance coast that launches 60% faster, reaches roughly 79% deformation, settles in roughly 1.1s, cancels immediately on interaction, and remains stationary under reduced motion
- A stable instanced slot pool whose recycling boundary stays beyond complete card exit while allowing the same scenario to remain visible in multiple places, including both sides of wide viewports
- One surface animation loop, one shared segmented geometry, one backing batch, 25 texture batches, and one selected-corner batch instead of per-copy animation loops and materials
- Asymmetric hover damping: vividness and scale arrive in roughly 130–170ms while the existing 260–290ms release remains intact
- Proportional selected-corner geometry that is 11–18% smaller at the current desktop card scale
- Per-instance hover activity: only the exact projected slot becomes vivid and receives orange brackets; repeated copies remain dim, and moving into a gap clears the visual selection
- Warp-synchronized pointer picking inverts the live shader displacement for hover and pointer-down, then re-resolves a stationary pointer each frame as inertia settles
- An additional 0.08 world units of nonvisual hit tolerance—roughly 8–10 desktop pixels—around each exact warped instance without changing card spacing or geometry
- Stable focal-point cover crop and click-versus-drag classification backed by unit tests
- Paper-washed peripheral scenes, hovered-instance vividness, orange corner brackets without the former selected-card plus, and orange crosshair cursor
- The WebGL surface is intentionally removed from the tab order; the scenario metadata link remains the keyboard-accessible action
- First-tap-select and second-tap-open mobile behavior
- DOM transition proxy that carries the selected WebGL frame into the Dossier media plate
- Whole-circle, versioned spoiler dismissal with an explicit spinning warning, expanding hover/focus fill, and reduced-motion treatment
- Grid-governed Dossier H1 wrapping with no character cap or forced mid-word break, including balanced centered mobile type
- Dossier opening limited to media and title identity, with H1 before a vertical left-× source list; matching source/episode movie labels collapse to one row
- Viewport-centered desktop header copy, section 02 as the sole prominent reading panel, and identical reserved border/padding geometry across sections 01–03
- Viewport-triggered stagger and hover/focus text scramble
- Click-anywhere YouTube play/pause that preserves the mounted player and playback position, retained Play clip/Return to still controls, contextual media cursor, and composed no-video state
- Consistent `Play clip`, `Pause clip`, and `Resume clip` terminology across the media cursor and explicit controls
- Floating Play/Pause label suppression over the explicit playback and Return-to-still controls while preserving the crosshair and whole-frame target
- Still-only scene labeling, a themed accessible progress scrubber with elapsed/duration display, focused-surface ±10-second seeking, native one-second slider keys, and a once-mounted YouTube player across still/video state changes

## Verification

- Exact desktop gallery viewport: 1440×900
- The prior responsive mobile gallery capture remains at 390×844; this refinement pass was intentionally desktop-only
- No horizontal overflow in gallery, Dossier, source pivot, or no-video state
- Vertical wheel-to-horizontal travel, horizontal mobile drag, pointer recentering, and immediate reversal verified; native desktop history swipe is released in event routing and horizontal overscroll policy
- Five fixed y lanes, zero deformation at rest, the same absolute-speed warp under forward/reverse travel, and complete repeated coverage verified at 1440×900
- Every lane contains all 25 scenarios with no matching horizontal neighbors, including across the recycling seam
- Screenshot regression verifies one hovered copy is materially more vivid than its repeated copy; moving into a field gap leaves no vivid card or orange brackets
- Resting and peak-warp pointer checks verify blank-space clearing, stationary-pointer tracking, and clicked-instance navigation to the matching Dossier
- The stronger entrance sequence was checked at first-visible, peak-shear, and settled frames; pointer interaction and reduced motion cancel its positional travel
- The 2560×900 stress capture shows simultaneous repeated scenarios, all five rows, and selected brackets inside the lower safe area; temporal seam continuity and two-sided duplication are also unit-tested
- Repeated five-pass forward/reverse seam stress completed without blank edges, runtime errors, or disappearing partial cards
- Gallery-to-Dossier shared media transition recaptured mid-flight with the corrected selected-frame geometry
- Detail H1 computed as `max-width: none` and `overflow-wrap: normal`; mobile is centered, long-title/no-video states do not overflow
- Full-frame video activation, API-backed pause/resume without iframe remount, and Return to still verified
- Whole-circle spoiler hover fill, dismissal, and reload persistence verified
- Source identity verified against the working Black Mirror pivot
- Formatting, lint, typecheck, 63 unit tests, 179-scenario/358-asset content validation, and the 160-page Next.js production build pass

The project build script uses Next.js 16.3.3's documented `--webpack` build fallback. Turbopack development remains enabled; two clean-cache production attempts reproduced an idle Turbopack compiler hang in the local environment, while the webpack production build completed deterministically.

Physical touch/trackpad feel remains a creator-review item for this gate; the gesture paths and first-tap/second-tap logic are implemented, but the in-app QA browser does not emulate a coarse touch pointer.

Native Back/Forward swipe routing is covered by axis-classification tests and desktop overscroll inspection, but still needs one physical macOS trackpad feel-check because automated wheel events cannot reproduce browser-owned history gestures faithfully.

## Historical prototype limits

- The archived field used 25 deterministic featured fixtures; production browse now supports all 179 records with capped texture residency.
- The no-WebGL fallback is recognizable and keyboard-accessible but intentionally does not reproduce WebGL dragging.
- Resource destinations, cross-resource search, Browser Back restoration, production promotion, and rejected-variant removal are now complete.
