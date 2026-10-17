# Resource pages

Media sources, franchises, risk families, and AI safety concepts each have an index and detail pages. Indexes link every record; the media-source index sorts A–Z, newest, or oldest and remembers the choice; detail pages show the first 12 matching scenes and expand to all of them in place.

## Sub-features

- `resources-index` links every snapshot record from `/sources`, `/franchises`, `/risk-families`, and `/concepts`.
- `resources-source-sort` sorts media sources by default, newest, or oldest and keeps the choice after reload. The shared control on this index and larger detail-page scene collections marks the selected option with orange text and a bordered paper background. The background retargets during rapid changes and snaps under reduced motion.
- `resources-expand` expands a detail page's scene collection from 12 to all scenes and focuses card 13.
- `resources-card` opens a scenario's dossier from its card.

## How to get to it (user POV)

- Choose `AI Risk Families`, `AI Safety Concepts`, or `Media Sources` in the header; franchises are linked from the media-source index, dossiers, and search.
- Choose a sort option above the media-source grid.
- Open any detail page with more than 12 scenes and choose `Show all N scenes`, then `View scenario →` on a card.

## Driving it with verify.ts

Preconditions:

- `verify.ts doctor --run=<id>` passes.
- At least one concept has more than 12 scenarios in the snapshot.
- Fresh browser state, so no sort preference is stored.

- **Indexes.** From `/about`, open `/sources`, `/risk-families`, and `/concepts` from the header with `openFromHeader` (the Menu sheet on mobile), and `/franchises` from the media-source index's `main a[href="/franchises"]` cross-link. On each, `[data-resource-list][data-resource-kind="<kind>"]` is visible, and the unique `main a[href^="/<route>/"]` detail links equal the snapshot records for that kind.
- **Sort.** On `/sources`, the list has `data-resource-sort="default"`. Click `[data-collection-sort-option="newest"]`; the attribute becomes `newest` and the first `li > a` links the snapshot's newest dated source. Storage holds `cultural-alignment:media-source-collection-sort:v1` = `newest`, and the scenario sort key is unchanged.
- **Persist.** Reload. The list is still `newest`, and the option has `data-state="on"`.
- **Expand.** Open the concept with the most scenes. `[data-scenario-collection] > li` counts 12, and `[data-scenario-collection-expand]` reads `Show all <count> scenes`. Click it; the count equals the snapshot count and card 13 contains the focused element. Clicking card 13's `/scenarios/<slug>` link opens `[data-scenario-dossier]`.
- **Proof.** Run `.agents/skills/verify-cultural-alignment/verify.ts drive .agents/skills/verify-cultural-alignment/journeys/resources.journey.ts --run=<id>`. Captures show each index, the sorted grid before and after reload, the collapsed and expanded collections, and the dossier opened from a card.

## Gotchas

- The media-source index groups sources under letter or decade headings; count unique detail links, not list items in one group.
- Header, footer, and cross-links point to `/sources` or `/franchises` without a slug; match `^/<route>/[^/]+$`.
- The source and scenario sort preferences use separate storage keys; changing one must not change the other.
- Fresh browser contexts start with the default sort; a reused profile may not.
