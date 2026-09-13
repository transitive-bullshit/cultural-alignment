# MVP scope

This records the accepted MVP direction and its implementation boundaries. Current capabilities are described in [Product](PRODUCT.md), with resource counts maintained in the [sync manifest](../content/snapshot/manifest.json).

## Product proof

The MVP proves that a recognition-first, elastic gallery can invite a broad audience into unfamiliar AI-safety concepts, and that a scenario dossier can hold a clip, a useful analogy, and an honest caveat without becoming a conventional educational dashboard.

## Included

- A versioned scene-to-concept dialog shared by the featured gallery and filterable `/scenarios` route, with route-specific dismissal behavior described in [Design](DESIGN.md#homepage-entry)
- The complete synchronized snapshot
- The selected Dossier scenario-detail direction
- Risk-family filtering reflected in the URL
- Gallery-state restoration after navigating into a scenario and pressing Back
- Video, missing-video, spoiler-dismissal, and text-scramble states
- Functional source, franchise, risk-family, and concept indexes and pivots, plus deterministic scenario discovery
- Cross-resource local search
- Canonical metadata, a designed not-found state, robots policy, and a catalog-derived sitemap
- Deterministic one-way synchronization through the official Notion API
- Desktop visual craft with functional mobile behavior

## Remaining exclusions

- Popularity ranking, public ratings, or personalization
- Community submissions and editorial moderation
- Dark mode and a final naming/wordmark system
- Full mobile visual parity, comprehensive assistive-technology parity, and a low-power rendering mode
- Custom video controls beyond the branded shell, progress, seeking, and play/pause behavior already present
- Guided learning paths or a permanent related-scenario ranking rule

## Locked decisions

- **Direction:** The creator selected Dossier on 2026-08-27. Screening Room, Threshold, and the original prototype picker were removed; their fixed review captures remain as historical evidence. The current `/prototypes/homepage` and `/prototypes/social-image` routes are separate later experiments.
- **Visual system:** Warm paper, charcoal type, electric-orange interaction accents, Barlow Condensed display type, Geist reading type, Geist Mono metadata, and a single continuous page ground are locked.
- **Gallery:** The field is a one-axis horizontal projection with a five-row desktop default and adjustable frame density. Vertical wheel input advances it; horizontal-dominant fine-pointer gestures remain browser-owned. Cyclic modular wrapping permits simultaneous copies without mirroring or edge pops. Velocity bends the left edge upward and right edge downward, then settles flat. Only the exact hovered projection becomes vivid, with proportional orange corners and a crosshair cursor; the canvas itself is not a keyboard focus target.
- **Dossier:** Layout columns—not character counts—govern title wrapping. The opening holds media and identity; the reading sequence is scene, analogy, and caveats, with only the second panel prominent. Source metadata is a vertical left-× list: source/franchise links are actionable, episode/year are inert, and movies omit the episode row.
- **Media and spoilers:** The whole media plate toggles play/pause, custom controls use consistent “clip” language, the player instance stays mounted when returning to the still while playback resets to the configured clip start, and the floating action label yields to foreground controls. The spoiler warning pairs an explanatory archive note with an empty-center circular seal; the whole surface acknowledges, briefly confirms, and dismisses without a separate close icon, and persistence is versioned.
- **Motion and text:** A finite, interruptible entrance coast demonstrates the gallery material and is disabled by reduced motion. Taxonomy links scramble on entry and hover/focus. The spoiler warning is the only spinning-text element. The selected gallery frame alone receives the emphasized transition into the Dossier.

The creator pulled the Notion synchronizer and full-content expansion into the same implementation run. References to ten or 25 scenarios in the historical plan describe prototype stages; the implemented local MVP exposes the complete synchronized archive. Repository packaging history is recorded in [`QA.md`](QA.md#remote-media-migration-status).

The creator explicitly authorized implementation to continue past the former feedback gates on 2026-08-28. Deployment and analytics were outside the original implementation scope; the site is now deployed at [cultural-alignment.com](https://cultural-alignment.com), and `app/layout.tsx` includes Vercel Web Analytics.

The detailed execution history and acceptance checklist remain in [`docs/outputs/cultural-alignment-mvp-implementation-plan.md`](outputs/cultural-alignment-mvp-implementation-plan.md).
