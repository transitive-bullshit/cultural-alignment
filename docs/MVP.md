# MVP scope

## Product proof

The MVP proves that a recognition-first, elastic gallery can invite a broad audience into unfamiliar AI-safety concepts, and that a scenario dossier can hold a clip, a useful analogy, and an honest caveat without becoming a conventional educational dashboard.

## Included

- A versioned, one-time scene-to-concept dialog shared by the full-viewport featured gallery and filterable `/scenarios` route
- The complete synchronized snapshot: 179 scenarios, 129 sources, five risk families, and 65 used concepts
- The selected Dossier scenario-detail direction
- Risk-family filtering reflected in the URL
- Gallery-state restoration after navigating into a scenario and pressing Back
- Video, missing-video, spoiler-dismissal, and text-scramble states
- Functional source, risk-family, and concept indexes and pivots, plus best-effort scenario discovery
- Cross-resource local search
- Canonical metadata, a designed not-found state, robots policy, and a 385-entry sitemap
- Deterministic one-way synchronization through the official Notion API
- Desktop visual craft with functional mobile behavior

## Explicitly excluded

- Deployment and domain configuration within the original MVP implementation run
- Analytics, popularity ranking, ratings, or personalization
- Community submissions and editorial moderation
- Dark mode and a final naming/wordmark system
- Full mobile visual parity, comprehensive assistive-technology parity, and a low-power rendering mode
- Custom video controls beyond the branded shell, progress, seeking, and play/pause behavior already present
- Guided learning paths or a permanent related-scenario ranking rule

## Locked decisions

- **Direction:** The creator selected Dossier on 2026-08-27. Screening Room, Threshold, the prototype picker, and all rejected routes were removed; only fixed review captures remain as historical evidence.
- **Visual system:** Warm paper, charcoal type, electric-orange interaction accents, Barlow Condensed display type, Geist reading type, Geist Mono metadata, and a single continuous page ground are locked.
- **Gallery:** The field is a dense five-row, one-axis horizontal projection. Vertical wheel input advances it; horizontal-dominant fine-pointer gestures remain browser-owned. Cyclic modular wrapping permits simultaneous copies without mirroring or edge pops. Velocity bends the left edge upward and right edge downward, then settles flat. Only the exact hovered projection becomes vivid, with proportional orange corners and a crosshair cursor; the canvas itself is not a keyboard focus target.
- **Dossier:** Layout columns—not character counts—govern title wrapping. The opening holds media and identity; the reading sequence is Scene, Why this analogy works, and Where the analogy breaks, with only the second panel prominent. Source metadata is a vertical left-× list: source is actionable, episode/year are inert, and a redundant movie-style episode row is omitted.
- **Media and spoilers:** The whole media plate toggles play/pause, custom controls use consistent “clip” language, the player instance stays mounted when returning to the still while playback resets to the configured clip start, and the floating action label yields to foreground controls. The spoiler warning pairs an explanatory archive note with an empty-center circular seal; the whole surface acknowledges, briefly confirms, and dismisses without a separate close icon, and persistence is versioned.
- **Motion and text:** A finite, interruptible entrance coast demonstrates the gallery material and is disabled by reduced motion. Taxonomy links scramble on entry and hover/focus. The spoiler warning is the only spinning-text element. The selected gallery frame alone receives the emphasized transition into the Dossier.

The creator pulled the Notion synchronizer and full-content expansion into the same implementation run. References to ten or 25 scenarios in the historical plan describe prototype stages; the implemented local MVP exposes the complete synchronized archive. Repository packaging history is recorded in [`QA.md`](QA.md#remote-media-migration-status).

The creator explicitly authorized implementation to continue past the former feedback gates on 2026-08-28. Deployment remained outside that implementation run and was completed afterward at [cultural-alignment.com](https://cultural-alignment.com).

The detailed execution history and acceptance checklist remain in [`docs/outputs/cultural-alignment-mvp-implementation-plan.md`](outputs/cultural-alignment-mvp-implementation-plan.md).
