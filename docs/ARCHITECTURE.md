# Architecture

## Runtime boundary

The application has no runtime CMS or database. Server Components read a validated, committed snapshot from `content/snapshot`; client islands receive small page-specific view models. A normal build is fully offline and never reads `NOTION_TOKEN`.

```text
Notion editorial database
        │ explicit `pnpm content:sync`
        ▼
staged normalization + image processing + validation
        │ atomic replace
        ▼
content/snapshot + public/media + public/content/search-index.json
        │
        ▼
ContentCatalog page models
        ├── Server Component routes
        ├── spatial-gallery client island
        ├── scenario-media client island
        └── global-search client island
```

## Content contract

`lib/content/schema.ts` defines snapshot schema version 1 with four resources: scenario, source, risk family, and concept. Relationships store stable Notion IDs. Slugs are unique within a resource kind, media paths must remain local, and image dimensions and relational integrity are validated before the catalog is created.

`lib/content/catalog.ts` is the domain seam. Routes ask it for gallery cards, scenario pages, resource pivots, static slugs, or search documents. Routes do not join raw IDs, invent fallbacks, or duplicate sort/filter semantics.

## Spatial gallery ownership

`features/spatial-gallery` owns the entire projected surface: deterministic layout, cyclic wrapping, input projection, inertia, screen-space deformation, pointer inversion, exact-slot selection, WebGL resources, transition proxy, and state capture/restoration. Route components choose only a content set and surface mode.

The full archive keeps texture residency bounded to visible and near-visible cards. The content count is intentionally independent of decoded GPU texture count. Residency has a hard 64-texture ceiling, prioritizes the current center and incoming edge, and evicts lower-priority records by recency; teardown disposes listeners, materials, geometry, and resident textures.

Gallery history state is scoped per gallery URL and records the continuous horizontal field position plus the selected item. Navigation captures it before opening a scenario; remounting after browser Back restores it before the intro coast can run.

## Server/client split

- Server: route composition, metadata, static parameter generation, catalog projection, filter/sort parsing
- Client: WebGL, gesture handling, Command-K search, spoiler persistence, YouTube API state, progress/seek controls, and view-transition coordination

Every content detail route exports all known static parameters and disables unknown dynamic parameters. Missing or malformed slugs resolve through the application's not-found behavior.

Canonical metadata is resolved through one deployment-origin module. The generated sitemap contains the five browse/index URLs plus every scenario, source, family, and concept detail URL; search queries are intentionally kept out of crawler discovery.

## Synchronization boundary

`scripts/sync.ts` uses `@notionhq/client` and the fixed Example Scenarios data source. It paginates rows, retrieves blocks, converts rich text to Markdown- compatible plain strings, downloads source images, creates gallery/detail WebP variants with Sharp, preserves slugs by stable Notion ID, generates search documents, validates the staged tree, and replaces generated targets only after success.

The sync manifest hashes source and derived media. Strict generated paths limit cleanup scope; failures leave the previous snapshot untouched.

## Testing seams

Pure Vitest suites cover schema/catalog invariants, stable sorting, relationship projection, field math, hit testing, media crop behavior, video state, and source metadata. Browser journeys cover URLs, interaction, Back restoration, and persistent dismissal. Exact cross-GPU pixels are deliberately not an automated oracle; fixed-size browser captures remain the visual evidence.
