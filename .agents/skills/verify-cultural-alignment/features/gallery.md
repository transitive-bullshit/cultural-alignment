# Scenario gallery

The homepage opens a curated WebGL gallery behind an introduction dialog, and `/scenarios` shows every scenario with risk-family chips. Visitors hover or tap a frame to select it, open its dossier, and return with Back to the same selection; without JavaScript, each gallery is a server-rendered index of links.

## Sub-features

- `gallery-intro` shows the introduction on first visit and dismisses it with Explore or Escape.
- `gallery-select` selects the frame under the pointer (desktop hover, first touch tap) and shows its title.
- `gallery-open` opens the selected frame's dossier with a desktop click or a second touch tap.
- `gallery-back` restores the selection after Back; the homepage shows its introduction again on later entries.
- `gallery-archive` shows every snapshot scenario on `/scenarios` with one chip per risk family.
- `gallery-index` serves every gallery scenario as a link without JavaScript.
- `gallery-keyboard` reveals the index when Tab focus reaches it and opens a scenario with Enter.

## How to get to it (user POV)

- Visit `/` for the featured gallery, or choose `Scenarios` in the header for `/scenarios`.
- On desktop, move the pointer over a frame, then click it. On a phone, tap a frame once to select it and again to open it.
- On the archive, choose a risk-family chip in the toolbar.
- Keyboard users Tab into the scenario index, which the canvas hides until it has focus, and press Enter.

## Driving it with verify.ts

Preconditions:

- `verify.ts doctor --run=<id>` passes.
- Fresh browser state, so the introduction is visible.

- **Introduction.** Load `/`. `page.locator('[data-gallery-intro-dialog]')` is visible. Explore with `page.locator('[data-gallery-intro-dismiss]').click()`; `[data-gallery-intro]` reaches `data-state="dismissed"` and storage holds `cultural-alignment:gallery-intro:v1` = `acknowledged`.
- **Settle.** Wait for `[data-spatial-gallery="browse"] canvas` to have `data-gallery-inertia-burst` of `settled` or `skipped` before selecting.
- **Select.** Hover (desktop) or tap (mobile) down the canvas centre line until `[data-spatial-gallery="browse"]` has `data-selected-scenario-id`. The homepage card `[data-words-context-card]` (desktop) or `[data-mobile-selected-scenario]` (mobile) names the snapshot scenario with that ID.
- **Open.** Click the same point (desktop) or tap it again after about 800 ms (mobile). The URL becomes `/scenarios/<slug>` and `[data-scenario-dossier]` shows an H1 with the scenario title.
- **Back.** `page.goBack()`. `/` shows the introduction again; after Explore, `data-selected-scenario-id` equals the opened scenario and the card names it again.
- **Archive.** Load `/about` and open `/scenarios` from the header with the `openFromHeader` fixture (the Menu sheet on mobile), then press Escape on the introduction. The H1 is `All scenarios`, `data-gallery-item-count` equals the snapshot scenario count, and `[data-scenario-family-filters] a[href^="/risk-families/"]` has one chip per risk family. Clicking a chip opens `[data-resource-detail="risk-family"]`.
- **Keyboard (desktop).** On `/scenarios`, wait for the introduction's `data-state="visible"`, press Escape, and wait for `dismissed`; then Tab until focus is inside `[data-scenario-index]`. The index widens past 200 px over the canvas; Enter opens the focused `/scenarios/<slug>` with `[data-scenario-dossier]` visible.
- **No JavaScript.** With `javaScriptEnabled: false`, `/` and `/scenarios` show an H1 and `[data-scenario-index] a[href^="/scenarios/"]` counts equal `data-gallery-item-count`.
- **Proof.** Run `.agents/skills/verify-cultural-alignment/verify.ts drive .agents/skills/verify-cultural-alignment/journeys/gallery.journey.ts --run=<id>`. Captures show the introduction, the bracketed selected frame, the dossier, the re-shown introduction, the restored card, the archive and chip destination, and the keyboard-revealed index.

## Gotchas

- The canvas centre can fall between rows, especially on phones; probe several heights instead of assuming a frame is there.
- Selecting before the dismissal burst settles can select one frame and press another.
- A touch selection recentres the frame horizontally, so tapping immediately can miss it.
- The homepage has no selected-frame panel; `[data-selected-scenario-metadata]` exists only on `/scenarios`.
- Back to `/` shows the introduction again by design. Only the explicit close button (`[data-gallery-intro-close]`) suppresses it permanently, and that also suppresses it on `/scenarios`.
- Backdrop dismissal, the explicit close button, and the homepage's hidden `Open selected scenario` button are not driven here; `tests/e2e/mvp.spec.ts` covers the close button.
- `tests/e2e` mocks images and disables WebGL 2; verification does neither, so gallery screenshots show real stills and vary by GPU.
