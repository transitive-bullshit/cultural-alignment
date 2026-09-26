# QA record

Use [Contributing](../CONTRIBUTING.md#change-workflow) for commands and check selection. The acceptance checks below guide validation of the changed behavior. The [historical evidence](#historical-evidence) records past runs; its counts, timings, captures, and failures do not establish the current state. Obtain current content counts with `pnpm content:validate` and test coverage from the test runner.

The canonical production deployment is [cultural-alignment.com](https://cultural-alignment.com).

## Current acceptance checks

### UI and navigation

Use [Design](DESIGN.md) for intended behavior and the relevant journeys under `tests/e2e/` for executable coverage. Inspect real media at desktop and phone widths when changing layout or image rendering; many journeys mock optimized images.

- Gallery travel and reversal: no blank edge or visible copy pop; opposing deformation settles flat; picking, vividness, and brackets stay on the exact projected copy.
- Gallery navigation: family filters update the URL without transient excluded cards; scenario navigation and browser Back restore position and selection; route cycles do not duplicate the canvas/frame loop or grow texture use without bounds.
- Scenario media: whole-frame play/pause, seeking, Return to still, idle chrome, and the composed missing-video state behave as described in Design.
- Persistence: spoiler dismissal survives navigation and reload; test first-visit behavior with fresh browser state when changing the introduction or spoiler flow.
- Routes and search: all five resource types open working destinations; direct valid URLs refresh; malformed slugs reach not-found; shared scenario collections retain all results and bounded Dossier previews.
- Resource details: authored names, references, optional metadata, poster layout, and plural parent breadcrumbs remain correct. Episodes appear only for TV scenarios with a non-empty episode, including copied Markdown.
- Responsive layout: long current titles wrap within their grid; one-column mobile layouts have no horizontal overflow; search overlays hide the gallery crosshair.
- Social images: all five detail-route families expose matching Open Graph/Twitter URLs and return the expected format, dimensions, and cache headers; inspect long names and missing-image fallbacks visually.

### Content and synchronization

Use the [snapshot contract](../content/README.md) for generated-output ownership, sync modes, and storage/reuse rules. Exercise the affected contract when changing synchronization; a live sync reads Notion, and normal/forced modes can publish media.

- Validate the complete generated diff, including search and manifest output. An unchanged second sync should be byte-identical.
- Verify the relevant reuse path: unchanged media avoids block traversal, downloads, processing, and variant uploads; absent optional posters remain reusable; changed media preserves content-addressed deduplication.
- Check public URL/dimension/alt-text records and any origin changes. Public delivery and cache directives do not replace descriptor access control.
- Confirm a clean checkout validates and builds from the committed snapshot without storage credentials or local generated image files. Gallery network inspection should show bounded same-origin image-optimizer requests.

## Environment limitations

- Automated wheel events cannot reproduce browser-owned macOS trackpad history swipes. Native Back/Forward feel needs a physical trackpad check.
- WebGL screenshots vary by GPU; inspect them manually instead of treating pixel differences as test oracles.
- Earlier review recorded a non-blocking upstream `THREE.Clock` deprecation warning from React Three Fiber; application code does not construct `THREE.Clock`.
- The 2026-09-25 full run hit a gallery-intro timing assertion and skipped its four serial successors; the isolated single-worker rerun passed. Preserve that distinction when diagnosing a similar failure.

Broader device coverage remains a manual follow-up: Safari desktop, large/Retina Chrome, and a physical tablet including orientation changes. For the reported header-only first load, consult the [dated investigation](BLANK-FIRST-LOAD-INVESTIGATION.md); its infrastructure attribution remains provisional.

## Historical evidence

Append dated verification evidence here when it adds a useful result or limitation. Preserve the original environment, scope, and failures; do not update old counts to match current content. Selected prototype captures are indexed in [Gate B](outputs/gate-b/README.md); other paths under `test-results/` are ignored local artifacts and may not exist in a fresh checkout.

### Citation and source-layout integration, 2026-08-29

- Oxfmt: 118 files
- Oxlint: pass
- generated-route types and TypeScript: pass
- Vitest: 17 files, 85 focused tests
- Playwright: 9/9 critical journeys in 9.9 seconds
- content validation: 310 scenarios, 203 sources, 5 risk families, 66 concepts, and 1,024 generated media assets in the pre-migration local baseline
- unchanged second sync: byte-identical citation snapshots, manifest, and search index
- production build: 597 static/SSG pages generated

### Gallery integration evidence (undated)

#### Review coverage

- Chrome production preview at 1440×900 desktop and 390×844 phone
- 2560×900 Chrome wrap/duplication stress capture
- Mouse wheel, pointer travel/reversal, hover picking, selection, direct URLs, and browser Back
- Mobile-width drag/tap, filter controls, Dossier reading, spoiler, and video states
- Nine automated Chromium journeys covering gallery/Dossier state, Markdown copy and media controls, generated search, spoiler persistence, filtering, resource metadata and breadcrumbs, episode rules, and mobile containment

#### Observations

- Chrome production preview checked at 1440×900 and 390×844.
- Fast vertical-wheel travel produced the intended opposing edge shear and returned to a level surface without a blank seam or visible copy pop.
- Exact filtered-gallery selection and continuous position restored after scenario navigation and browser Back.
- Direct mobile filter URLs keep the selected family and result count fully visible.
- The long “K-2SO is Reprogrammed” H1 fits its 566 px desktop grid column without a character cap, forced break, or horizontal overflow.
- Search layering hides the gallery crosshair over the portalled dialog and returns grouped, working destinations.
- Risk-family pivots, the designed 404, the missing-video state, and mobile Dossier hierarchy were visually reviewed in the production build.

#### Performance baseline

- Featured page: 25 gallery images observed, 934,914 bytes of generated WebP media.
- Full gallery idle settling eventually requests and retains every optimized gallery image source, while foreground and scroll-direction candidates preempt background work.
- GPU uploads and material bindings are capped separately at 128 full textures on mobile and 256 on desktop. Evicted uploads retain their loaded image source and can return to the foreground without another request or blurred placeholder.
- Complete scenario media corpus: 12,618,402 bytes of gallery WebP and 35,605,396 bytes of detail WebP in the pre-migration baseline; the public object-storage variants are neither eagerly requested nor simultaneously GPU-resident.
- Optional source posters: 30,994,486 bytes of gallery WebP and 97,268,040 bytes of detail WebP across 202 sources; Zootopia is the one posterless record.
- Built client static directory: 2.5 MB. Search index: 441,862 bytes.
- Rapid travel, reversal, hover, filter changes, and gallery/detail/Back cycles remained visually responsive on the primary Chrome review machine; exact frame-time instrumentation was not available through the review browser.

### Remote-media migration, 2026-08-29

- The authenticated migration completed on 2026-08-29: 330 scenarios and 207 source posters produced 537 image records and 1,074 content-addressed WebP objects. Every snapshot URL is remote HTTPS, and `public/media/generated` is absent.
- Public R2 delivery returns `image/webp` with immutable caching, and its optional read-only CORS policy responds with `Access-Control-Allow-Origin: *`. The application gallery itself uses same-origin Next Image Optimization and does not depend on CORS.
- Generated image bytes are not part of the Git-tracked release artifact. The checked-in snapshot retains their public URLs and intrinsic dimensions; R2 descriptors retain the reusable content-addressed media state.

### Takumi social-image migration, 2026-09-14

- Scenario, source, and franchise image handlers use Takumi with explicit WebP quality 80 and matching `image/webp` metadata, at 1200×630.
- Local Barlow Condensed WOFF embedding and Takumi’s bundled Geist remove the dependency on Next.js’s private font files. Integration follows the [Takumi migration guide](https://takumi.kane.tw/docs/comparison-to-satori#migrate-from-nextog).
- Shared Sharp preparation applies cover cropping and normalized focal positions before rendering. Synthetic horizontal and vertical color-band tests verify both edges and center framing.
- Formatting, lint, generated route types, TypeScript, and 381 unit tests passed. The full 17-journey browser suite passed before adding scenario social-image coverage; the final focused production run passed all three social-image journeys, including response MIME, decoded format/dimensions, and Open Graph/Twitter URLs.
- Content validation passed; the production build generated 812 pages. All three image-route deployment traces include the native Takumi addon and local Barlow font; both `takumi-js` and `@takumi-rs/core` are externalized.
- Local visual review compared the original PNG renderer with WebP for two scenarios (including the longest current title), a source, a franchise, and a missing-poster fallback. Image-backed samples decreased from 489,626–1,421,852 bytes to 40,486–99,802 bytes (91–97% smaller); the fallback decreased from 24,789 to 7,316 bytes. These are sample measurements, not fixed content expectations. Local captures are under ignored `test-results/social-image-migration/`.

### Social-image response caching, 2026-09-16

- Scenario, source, and franchise image responses keep browsers on revalidation, cache at downstream CDNs for one day with a seven-day stale-while-revalidate window, and cache at Vercel for one year per deployment.
- Focused formatting, lint, generated route types, TypeScript, and three unit tests passed. The production build generated 820 pages; all 18 production browser journeys passed; and local production requests confirmed all three image-route families preserve the configured `Cache-Control`, `CDN-Cache-Control`, and `Vercel-CDN-Cache-Control` headers.

### Pre-rendered scenario archives, 2026-09-16

- `/scenarios` and all five `/scenarios/family/[slug]` variants render during the build with deployment-lifetime server caching. Existing valid `?family=` URLs permanently redirect to the corresponding filtered path.
- Static page segments use a one-hour client Router Cache stale time. Request-time routes retain their default client-cache behavior.
- Formatting, lint, generated route types, TypeScript, and four focused unit tests passed. The production build generated 825 pages and classified all six scenario archives as static or SSG; local production responses reported `x-nextjs-prerender: 1` and `x-nextjs-stale-time: 3600`; and all 18 production browser journeys passed.

### Detail-page copy links, 2026-09-16

- Formatting, lint, TypeScript, content validation, and the production build passed (825 generated pages). All 21 browser journeys passed, including copying the complete current URL across all five detail routes at 1440 px and 390 px, keyboard activation, permission failure and retry, repeat-click timer renewal, and reduced motion.
- The unit suite passed 378 tests and failed the existing sitemap expectation: the expected set omits the five `/scenarios/family/[slug]` paths already emitted by `app/sitemap.ts`. Neither sitemap file is changed by this work.
- Desktop (1440×900) and mobile (390×844) captures, including the checkmark state, are in ignored `test-results/copy-link-preview/`.

### Sitemap test repair, 2026-09-16

- The sitemap expectation now derives filtered scenario archive URLs from the current risk-family catalog, preserving complete route coverage and duplicate detection without fixed content slugs or counts.
- `pnpm test:checks` passed formatting, lint, generated route types, TypeScript, and all 379 unit tests. `pnpm content:validate` and `pnpm build` passed (825 generated pages).
- `PLAYWRIGHT_SERVER=production pnpm test:e2e` passed all 21 browser journeys in 31.1 seconds with no retries, using local Google Chrome and the Portless production server.

### Taxonomy social images, 2026-09-25

- Risk-family and concept detail routes publish Takumi WebP cards using their full descriptive catalog names, the shared orange target icon, and the paper-grid visual system. The handlers reuse the existing quality 80 and three shared cache headers.
- Formatting, lint, generated route types, TypeScript, all 379 unit tests, content validation, and the production build passed. Both new deployment traces include the local Barlow WOFF and native renderer.
- All five production social-image browser journeys passed, checking Open Graph and Twitter URLs, response cache headers, MIME, and decoded 1200×630 WebP dimensions. The full browser run passed 22 tests, failed one unrelated gallery-intro timing assertion, and skipped its four serial successors; all five gallery-intro tests passed on an isolated single-worker rerun.
- Local visual review confirmed complete wrapping for the longest current concept and risk-family names. Example renders are under ignored `test-results/taxonomy-social-images/`.
