# QA record

## Automated commands

Run from the repository root:

```bash
pnpm test
pnpm content:validate
pnpm build
```

Final integration pass on 2026-08-28:

- Oxfmt: 96 files
- Oxlint: pass
- generated-route types and TypeScript: pass
- Vitest: 15 files, 95 tests
- Playwright: 8/8 journeys in 17.3 seconds inside the final full suite (10.0 seconds standalone)
- content validation: 179 scenarios and 358 generated media assets
- production build: 388 static/SSG pages generated

`pnpm test` combines Oxfmt checking, Oxlint, generated-route type checking, the TypeScript compiler, unit tests, and browser journeys. The production build uses Next.js 16's documented webpack fallback because clean-cache Turbopack builds reproducibly stalled in this local environment.

## Content baseline

- Snapshot schema: version 1
- Scenarios: 179
- Sources: 129
- Risk families: 5
- Used concepts: 65
- Local gallery/detail assets: 358
- Featured scenarios: 25
- Two established-state syncs: byte-identical JSON and media hashes

## Review matrix

Desktop craft:

- Chromium: 1440×900 and 1920×1080
- Safari: 1440×900 and 1920×1080
- Mouse wheel and high-resolution trackpad
- Standard and Retina density

Functional responsive:

- Phone: 390×844
- One tablet viewport
- Touch drag/tap, orientation change, direct URL, and browser Back

## Manual checks

- No blank edge or visible copy pop during fast travel and reversal
- Left/right deformation opposes correctly and settles completely flat
- Exact projected copy alone receives vividness and brackets
- Pointer picking remains aligned during peak deformation
- Filter/sort changes update URL and never show excluded cards transiently
- Scenario navigation and browser Back restore field position and selection
- Whole-frame video activation, pause/resume, seeking, and Return to still
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
- Direct mobile filter URLs keep the selected family fully visible while both release-sort controls remain available.
- The long “K-2SO is Reprogrammed” H1 fits its 566 px desktop grid column without a character cap, forced break, or horizontal overflow.
- Search layering hides the gallery crosshair over the portalled dialog and returns grouped, working destinations.
- Risk-family pivots, the designed 404, the missing-video state, and mobile Dossier hierarchy were visually reviewed in the production build.

## Performance baseline

- Featured page: 25 gallery images observed, 934,914 bytes of committed WebP media.
- Full gallery initial settled view: 68 gallery requests observed, 2,775,750 bytes of committed WebP media; decoded residency is hard-capped at 64.
- Estimated raw RGBA residency at that ceiling: about 132 MB before browser/GPU bookkeeping.
- Complete optional media corpus: 7,307,468 bytes of gallery WebP and 21,585,068 bytes of detail WebP; it is not eagerly requested or uploaded.
- Built client static directory: 2.4 MB. Search index: 207,262 bytes.
- Rapid travel, reversal, hover, filter changes, and gallery/detail/Back cycles remained visually responsive on the primary Chrome review machine; exact frame-time instrumentation was not available through the review browser.

## Known environment limitations

- Automated wheel events cannot reproduce browser-owned macOS trackpad history swipes faithfully; final native Back/Forward feel requires one physical trackpad check.
- Exact WebGL screenshots vary by GPU and are reviewed manually rather than used as pixel-diff test oracles.
- React Three Fiber currently emits a non-blocking upstream `THREE.Clock` deprecation warning; application code does not construct `THREE.Clock`.
- Deployment and a Vercel preview are intentionally owned by the creator.
