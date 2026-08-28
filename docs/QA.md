# QA record

## Automated commands

Run from the repository root:

```bash
pnpm test
pnpm content:validate
pnpm build
```

Final integration pass on 2026-08-28:

- Oxfmt: 111 files
- Oxlint: pass
- generated-route types and TypeScript: pass
- Vitest: 15 files, 57 focused tests
- Playwright: 4/4 critical journeys in 18.5 seconds
- content validation: 310 scenarios and 620 generated media assets
- production build: 597 static/SSG pages generated

`pnpm test` combines Oxfmt checking, Oxlint, generated-route type checking, the TypeScript compiler, unit tests, and browser journeys. The production build uses Next.js 16's documented webpack fallback because clean-cache Turbopack builds reproducibly stalled in this local environment.

## Content baseline

- Snapshot schema: version 1
- Scenarios: 310
- Sources: 203
- Risk families: 5
- Used concepts: 66
- Local gallery/detail assets: 620
- Featured scenarios: 25
- Two established-state syncs: byte-identical JSON and media hashes

## Completed review coverage

- Chrome production preview at 1440×900 desktop and 390×844 phone
- 2560×900 Chrome wrap/duplication stress capture
- Mouse wheel, pointer travel/reversal, hover picking, selection, direct URLs, and browser Back
- Mobile-width drag/tap, filter controls, Dossier reading, spoiler, and video states
- Four automated Chromium journeys covering gallery/Dossier state, Markdown copy and media controls, generated search, spoiler persistence, filtering, and mobile containment

## Creator follow-up coverage

- Physical macOS high-resolution trackpad Back/Forward feel
- Safari desktop at 1440×900 and 1920×1080
- Chrome desktop at 1920×1080 and Retina density
- One physical tablet, including touch orientation change

## Manual checks

- No blank edge or visible copy pop during fast travel and reversal
- Left/right deformation opposes correctly and settles completely flat
- Exact projected copy alone receives vividness and brackets
- Pointer picking remains aligned during peak deformation
- Family-filter changes update the URL and never show excluded cards transiently
- Scenario navigation and browser Back restore field position and selection
- Whole-frame video activation, pause/resume, seeking, and Return to still
- Playing chrome hides after idle, returns on hover/input, and remains visible while paused
- Shared scenario collections render all resource results, retain bounded Dossier previews, and collapse to one column without mobile overflow
- Missing-video scenario remains composed
- Spoiler dismissal persists across navigation and reload
- Search results for all four resource types open existing URLs
- Direct valid URLs refresh; malformed slugs reach not-found
- No duplicate canvas/frame loop or growing texture count after route cycles
- No mobile horizontal overflow

## Existing visual evidence

The selected prototype evidence is under `docs/outputs/gate-b`, including 1440×900 gallery/Dossier captures, 2560×900 wrap stress, mobile captures, fast-shear and exact-instance-hover states, spoiler/media states, and a gallery-to-Dossier transition recording.

## Final integration observations

- Chrome production preview checked at 1440×900 and 390×844.
- Fast vertical-wheel travel produced the intended opposing edge shear and returned to a level surface without a blank seam or visible copy pop.
- Exact filtered-gallery selection and continuous position restored after scenario navigation and browser Back.
- Direct mobile filter URLs keep the selected family and result count fully visible.
- The long “K-2SO is Reprogrammed” H1 fits its 566 px desktop grid column without a character cap, forced break, or horizontal overflow.
- Search layering hides the gallery crosshair over the portalled dialog and returns grouped, working destinations.
- Risk-family pivots, the designed 404, the missing-video state, and mobile Dossier hierarchy were visually reviewed in the production build.

## Performance baseline

- Featured page: 25 gallery images observed, 934,914 bytes of generated WebP media.
- Full gallery initial settled view: 68 gallery requests observed, 2,775,750 bytes of generated WebP media; decoded residency is hard-capped at 64.
- Estimated raw RGBA residency at that ceiling: about 132 MB before browser/GPU bookkeeping.
- Complete optional media corpus: 12,618,402 bytes of gallery WebP and 35,605,396 bytes of detail WebP; these are intended to ship as static assets but are neither eagerly requested nor simultaneously GPU-resident.
- Built client static directory: 2.4 MB. Search index: 350,399 bytes.
- Rapid travel, reversal, hover, filter changes, and gallery/detail/Back cycles remained visually responsive on the primary Chrome review machine; exact frame-time instrumentation was not available through the review browser.

## Release packaging follow-ups

- `public/media/generated` contains the 620 synchronized files locally but is currently ignored by Git, so a clean GitHub checkout will not contain scenario stills and `pnpm content:validate` will fail. The product decision is to keep builds independent of Notion: remove the ignore and commit the generated assets, or establish an explicit artifact-producing build step before deployment. Do not solve this by adding a runtime Notion dependency.
- The configured pre-commit hook invokes `npx lint-staged`, but `lint-staged` is not a project dependency. Add the development dependency or update the hook before relying on it in a fresh or offline checkout.

## Known content limitations

- All 203 source records currently have `kind: "unknown"` and no authored descriptions or external links.
- All 66 concept descriptions use the same functional index copy rather than authored concept definitions.
- Risk-family and concept artwork remains a separate follow-up; current relational pivots intentionally use no placeholder art.

## Known environment limitations

- Automated wheel events cannot reproduce browser-owned macOS trackpad history swipes faithfully; final native Back/Forward feel requires one physical trackpad check.
- Exact WebGL screenshots vary by GPU and are reviewed manually rather than used as pixel-diff test oracles.
- React Three Fiber currently emits a non-blocking upstream `THREE.Clock` deprecation warning; application code does not construct `THREE.Clock`.
- Deployment and a Vercel preview are intentionally owned by the creator after the release-packaging item above is resolved.
