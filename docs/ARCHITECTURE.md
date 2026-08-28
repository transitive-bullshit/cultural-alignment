# Architecture

## Runtime boundary

The application has no runtime CMS or database. Server Components read a validated local snapshot from `content/snapshot`; client islands receive small page-specific view models. A normal build is fully offline and never reads `NOTION_TOKEN`.

```text
Notion scenario data source
        │ relations to media sources, risk families, and safety concepts
        ▼
four-data-source import via explicit `pnpm content:sync`
        │ staged normalization + image processing + validation
        │ atomic replace
        ▼
content/snapshot + public/media/generated + public/content/search-index.json
        │
        ▼
ContentCatalog page models
        ├── Server Component routes
        ├── sitemap, robots, and llms.txt routes
        ├── spatial-gallery client island
        ├── scenario-media client island
        └── global-search client island
```

## Content contract

`lib/content/schema.ts` defines snapshot schema version 2 with four resources: scenario, media source, risk family, and safety concept. The scenario data source no longer embeds select labels for the other resource kinds. Its three relation properties resolve to complete records imported from their linked Notion data sources, and all relationships store stable Notion page IDs.

Media-source records carry an explicit movie/TV source type, optional description, release date, poster, external media links, and direct related-source IDs. Risk-family records carry short and full names, authored descriptions, Wikipedia links, and ordered citations with preprocessed titles and publisher/domain labels. Safety-concept records carry short and long names plus the same authored-description and citation structure. Scenario cards and other compact surfaces use short names; detail routes use full or long names.

`ContentImage` is the shared local-image contract for required scenario stills and optional source posters. Slugs are unique within a resource kind, media paths must remain local, and image dimensions, source-type/episode consistency, required scenario relations, canonical references, and relational integrity are validated before the catalog is created.

`lib/content/catalog.ts` is the domain seam. Routes ask it for gallery cards, scenario pages, resource pivots, static slugs, or search documents. Routes do not join raw IDs, invent fallbacks, or duplicate relationship/filter semantics. `lib/content/scenario-discovery.ts` owns the deterministic same-source and cross-source taxonomy-overlap heuristic used by scenario pages.

`features/scenario-collection` is the shared server-rendered presentation seam for scenario lists. Resource detail pages use its continuous layout for the full result set, while Dossier discovery uses its bounded preview layout. Layout density and image treatment are independent inputs so future filtering can change the item set without introducing another card implementation.

`lib/content/search-documents.ts` projects the local search corpus once during synchronization. The snapshot and public index copies remain byte-identical. `lib/content/search.ts` owns normalization, ranking, and per-kind grouping shared by the server-rendered `/search` route and lazy Command-K client; every indexed `href` must resolve through the catalog.

## Spatial gallery ownership

`features/spatial-gallery` owns the entire projected surface: deterministic layout, cyclic wrapping, input projection, inertia, screen-space deformation, pointer inversion, exact-slot selection, WebGL resources, transition proxy, and state capture/restoration. Route components choose only a content set and surface mode.

Desktop layout uses five lanes on one horizontal axis. Vertical wheel deltas drive field travel; horizontal-dominant fine-pointer deltas pass through so the browser can retain Back/Forward gestures. Cyclic modular assignment avoids mirrored seams and immediate horizontal duplicates while allowing the same scenario to occupy multiple distant slots. Hover identity belongs to a projected slot, not its scenario record. Pointer picking inverts the live shader deformation and adds a small nonvisual hit tolerance, so selection remains aligned while the field is moving.

The full archive keeps texture residency bounded to visible and near-visible cards. The content count is intentionally independent of decoded GPU texture count. Residency has a hard 64-texture ceiling, prioritizes the current center and incoming edge, and evicts lower-priority records by recency; teardown disposes listeners, materials, geometry, and resident textures.

Gallery history state is scoped by topology: the homepage has its own key, and `/scenarios` keys state by risk-family filter. Each entry records the continuous horizontal field position plus the selected item. Navigation captures it before opening a scenario; remounting after browser Back restores it before the intro coast can run.

## Server/client split

- Server: route composition, metadata, static parameter generation, catalog projection, filtering, and scenario discovery
- Client: WebGL, gesture handling, Command-K search, spoiler persistence, clipboard feedback, YouTube API state, custom playback/progress controls, and view-transition coordination

Every content detail route exports all known static parameters and disables unknown dynamic parameters. Missing or malformed slugs resolve through the application's not-found behavior.

Global search reads a generated local index covering all four resource kinds. Canonical metadata is resolved through one deployment-origin module. The catalog-derived sitemap contains the browse/index URLs plus every scenario, source, family, and concept detail URL; search queries are intentionally kept out of crawler discovery. `robots.txt` permits indexing outside the `/api` namespace, while `llms.txt` gives machine readers a compact project description and stable top-level entry points without duplicating every dossier.

## Synchronization boundary

`scripts/sync.ts` uses the official `@notionhq/client` against Notion API version `2026-03-11`. The configured root is database `3c6edb27-f124-8070-9d6d-ca256d247c80` and scenario data source `3c6edb27-f124-80f0-a929-000b1fb786d5`. The synchronizer verifies that root and the target of each media-source, risk-family, and safety-concept relation before importing all four data sources. `NOTION_TOKEN` is required for an explicit sync even if the sources are publicly viewable.

The synchronizer paginates data-source rows and relation property values, retrieves blocks, converts scenario prose to Markdown-compatible strings and resource descriptions to plain text, and joins records by Notion page ID. It resolves canonical-link metadata once per unique URL, stores citation titles and publisher/domain labels in the snapshot, and uses deterministic URL-derived titles when a remote source cannot be read. Build-time requests and redirects are bounded and restricted to an explicit set of reviewed publication hosts; complete PDFs are parsed locally for their XMP or document-info title. Existing metadata is reused for idempotence; `REFRESH_CITATIONS=1 pnpm content:sync` explicitly refreshes it. The synchronizer also downloads required scenario stills or curated YouTube-thumbnail fallbacks and, on a best-effort basis, the first image from each media-source page. Both image kinds use Sharp to create gallery/detail WebP variants; a missing source image leaves the optional poster empty rather than manufacturing one.

Schema v2 deliberately starts with a fresh slug baseline: the first v2 sync ignores v1 slug maps and regenerates every slug. Later syncs preserve the slug belonging to each surviving Notion page ID, allocate deterministic slugs for new IDs, and remove deleted IDs from the map so their former slugs may be reused. The sync manifest tracks scenario and source-image inputs and outputs so unchanged media can be reused and stale owned files can be pruned.

The sync manifest hashes source and derived media. Strict generated paths limit cleanup scope; failures leave the previous snapshot untouched.

`public/media/generated` remains ignored by Git and exists only in a hydrated local workspace. This keeps the runtime independent of Notion once the artifacts exist, but a clean checkout does not contain scenario stills or source posters and therefore cannot pass content validation or produce a complete deployable artifact. Resolving that packaging gap remains a deliberate follow-up; it must not be addressed by adding a runtime Notion dependency.

## Testing seams

Pure Vitest suites are reserved for validation, ranking, normalization, serialization, and the gallery's nontrivial geometry/state algorithms. Generated-artifact coherence is part of `content:validate`, not an editorial snapshot test. A small Playwright suite covers the critical gallery-to-dossier, local-search, persistence, and phone-layout journeys through URLs and stable state hooks. It does not assert rendered prose, synchronized titles, slugs, counts, or complete generated bodies. Exact cross-GPU pixels are deliberately not an automated oracle; fixed-size browser captures remain the visual evidence.
