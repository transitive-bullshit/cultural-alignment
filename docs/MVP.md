# MVP decisions and history

The MVP is implemented and the site is deployed. This document preserves accepted direction and the reasons to keep it; it is not an execution checklist. [Product](PRODUCT.md) owns current capabilities and scope, [Design](DESIGN.md) owns current interaction details, and [Architecture](ARCHITECTURE.md) owns implementation boundaries.

## What the MVP proved

A recognition-first elastic gallery can invite a broad audience into unfamiliar AI-safety concepts. A scenario dossier can hold a clip, a useful analogy, and an honest caveat without becoming a conventional educational dashboard. This remains the test for new product work.

## Accepted decisions

| Decision | Why it matters |
| --- | --- |
| **Dossier scenario layout**, selected 2026-08-27 | Media and identity establish recognition; the reading order is scene, analogy, caveats, with the analogy emphasized. Preserve that hierarchy when adding material. |
| **One horizontal projected gallery**, adapted from the Photoyoshi reference | One elastic surface supports exploration and precise selection. Five rows remain the desktop default; current density controls and responsive behavior are described in Design. |
| **Cyclic wrapping and exact projected-copy selection** | The same scenario may appear more than once on a wide screen. Only the interacted-with copy should become vivid or drive the transition; mirroring and record-wide hover break that illusion. |
| **Warm paper, charcoal, orange interaction accents, condensed display type** | Scene imagery supplies variety within a continuous page ground. The rejected split-background treatment and category-rainbow cards undermine that shared visual identity. |
| **Restrained motion with a purposeful entrance** | The interruptible coast demonstrates the gallery’s material. Selection and navigation expose content; decorative motion should not delay reading. Reduced-motion paths retain function. |
| **Full snapshot at an explicit sync boundary** | The curated collection can evolve without a request-time CMS dependency. The original small fixture set was a prototype stage, not a permanent product limit. |
| **Desktop craft with functional mobile behavior** | The MVP invests in a distinctive experience while retaining direct-touch, keyboard, and no-WebGL paths. Full accessibility and low-power parity were not claimed as completed. |

## Decisions that supersede the original plan

- Screening Room, Threshold, and the original prototype picker were removed after Dossier was selected. [Gate B captures](outputs/gate-b/README.md) remain decision evidence. The current `/prototypes/homepage` and `/prototypes/social-image` routes are separate later experiments.
- The creator brought Notion synchronization and full-content expansion into the same implementation run. Historical references to ten or 25 scenarios describe prototype stages; use the current manifest for collection size.
- On 2026-08-28 the creator authorized work past the former feedback gates. Those gates are complete and do not require a new pause when making routine changes.
- Deployment and analytics were excluded from the original workstream; the site is now deployed and `app/layout.tsx` includes Vercel Web Analytics. The old exclusion is historical.

## Prior investigations worth reusing

- [Command-K evaluation](outputs/command-k-search-evaluation.md): recall depends on indexed metadata; precomputing document embeddings alone does not solve query embedding. The current search remains local and deterministic. The proposed engine alternatives were research, not an adopted migration.
- [Notion image identity](outputs/notion-image-identity-research.md): page-only edits caused repeated downloads of unchanged bytes, motivating per-record media descriptors. Its implemented-decision section supersedes the explored timestamp-settling protocol. The [current sync contract](../content/README.md) owns operational behavior.
- [Blank first-load investigation](BLANK-FIRST-LOAD-INVESTIGATION.md): a truncated document reproduced the header-only symptom, but the production cause remains unconfirmed. Use its evidence before changing WebGL or proxy configuration.
- [QA history](QA.md): records media migration, social-image tracing/caching, and browser verification limits. Dated counts and pass results are evidence for those revisions only. [Contributing](../CONTRIBUTING.md#browser-tests-and-previews) explains the retained webpack build fallback.

The [original implementation plan](outputs/cultural-alignment-mvp-implementation-plan.md) retains the detailed sequence and overrides. Consult it to understand a past choice, not to discover pending work.
