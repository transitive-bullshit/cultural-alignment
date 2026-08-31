# Architecture

## Runtime boundary

The application has no runtime CMS, database, or object-storage credentials. Server Components read a validated local snapshot from `content/snapshot`; client islands receive small page-specific view models. A normal build is offline with respect to Notion and the S3-compatible control plane and never reads their credentials. Image delivery is a separate public data-plane concern: absolute image URLs and dimensions are already present in the snapshot.

```text
Notion scenario and resource data sources
        │ scenario relations to sources/taxonomies; source relations to franchises
        ▼
five-data-source import via explicit `pnpm content:sync`
        │ staged normalization + image processing
        ├── authenticated GET/conditional PUT ──────► R2 media state
        ├──────── content-addressed HEAD/PUT ────────► public S3/R2 variants
        │ validation
        │ atomic replace
        ▼
content/snapshot + public/content/search-index.json
        │ image URLs + dimensions point to public media
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

`lib/content/schema.ts` defines snapshot schema version 3 with five resources: scenario, media source, media franchise, risk family, and safety concept. The scenario data source no longer embeds select labels for the other resource kinds. Its three relation properties resolve to complete records imported from their linked Notion data sources, while each media source keeps its authored franchise relation order. All relationships store stable Notion page IDs.

Media-source records carry an explicit movie/TV source type, optional description, release date, poster, external media links, ordered franchise IDs, and direct related-source IDs. Franchise records carry an authored name, description, search keywords, required representative image, and optional IMDb link. Risk-family records carry short and full names, authored descriptions, Wikipedia links, and ordered citations with preprocessed titles and publisher/domain labels. Safety-concept records carry short and long names plus the same authored-description and citation structure. Scenario cards and other compact surfaces use short names; detail routes use full or long names.

`ContentImage` is the shared remote-image contract for required scenario stills and franchise images plus optional source posters. Each gallery/detail source is an absolute HTTPS URL produced by the synchronizer, and intrinsic dimensions and alt text travel with it. Slugs are unique within a resource kind; image URL shape, dimensions, source-type/episode consistency, required scenario relations, canonical references, and relational integrity are validated before the catalog is created.

`lib/content/catalog.ts` is the domain seam. Routes ask it for gallery cards, scenario pages, resource pivots, static slugs, or search documents. Routes do not join raw IDs, invent fallbacks, or duplicate relationship/filter semantics. `lib/content/scenario-discovery.ts` owns deterministic continuation previews scoped to the first authored franchise when available, same-source previews otherwise, and cross-scope taxonomy-overlap suggestions.

`features/scenario-collection` is the shared server-rendered presentation seam for scenario lists. Resource detail pages use its continuous layout for the full result set, while Dossier discovery uses its bounded preview layout. Layout density and image treatment are independent inputs so future filtering can change the item set without introducing another card implementation.

`lib/content/search-documents.ts` projects the local search corpus once during synchronization. The snapshot and public index copies remain byte-identical. `lib/content/search.ts` owns normalization, ranking, and per-kind grouping for the lazy Command-K client; every indexed `href` must resolve through the catalog.

## Spatial gallery ownership

`features/spatial-gallery` owns the entire projected surface: deterministic layout, cyclic wrapping, input projection, inertia, screen-space deformation, pointer inversion, exact-slot selection, WebGL resources, transition proxy, and state capture/restoration. Route components choose only a content set and surface mode.

Desktop layout uses five lanes on one horizontal axis. Vertical wheel deltas drive field travel; horizontal-dominant fine-pointer deltas pass through so the browser can retain Back/Forward gestures. Cyclic modular assignment avoids mirrored seams and immediate horizontal duplicates while allowing the same scenario to occupy multiple distant slots. Hover identity belongs to a projected slot, not its scenario record. Pointer picking inverts the live shader deformation and adds a small nonvisual hit tolerance, so selection remains aligned while the field is moving.

The full archive retains every successfully loaded full-image source for the lifetime of the mounted gallery. Visible cards load first, the incoming edge follows scroll direction, and idle callbacks optimistically fill the remaining cache with bounded request concurrency. GPU uploads and material bindings are managed separately: the highest-priority 128 full textures may remain bound on mobile and 256 on desktop. An offscreen GPU eviction keeps its loaded image source, so foreground rebinding requires neither another network request nor a blurred fallback. Teardown disposes listeners, materials, geometry, and all retained textures.

Gallery history state is scoped by topology: the homepage has its own key, and `/scenarios` keys state by risk-family filter. Each entry records the continuous horizontal field position plus the selected item. Navigation captures it before opening a scenario; remounting after browser Back restores it before the intro coast can run.

## Server/client split

- Server: route composition, metadata, static parameter generation, catalog projection, filtering, and scenario discovery
- Client: WebGL, gesture handling, Command-K search, spoiler persistence, clipboard feedback, YouTube API state, custom playback/progress controls, and view-transition coordination

Every content detail route exports all known static parameters and disables unknown dynamic parameters. Missing or malformed slugs resolve through the application's not-found behavior.

Global search reads a generated local index covering all five resource kinds. It has no dedicated URL: queries and ranking remain inside the client-side command palette. Canonical metadata is resolved through one deployment-origin module, whose production origin is [cultural-alignment.com](https://cultural-alignment.com). The catalog-derived sitemap contains the browse/index URLs plus every scenario, source, franchise, family, and concept detail URL. `robots.txt` permits indexing outside the `/api` namespace, while `llms.txt` gives machine readers a compact project description and stable top-level entry points without duplicating every dossier.

Next.js image optimization allowlists the public media origins represented by the checked-in snapshot; it does not read S3 configuration. Before spatial-gallery data crosses the server/client boundary, its mapper uses the stable `getImageProps` API to derive one same-origin `w=640&q=75` optimizer URL for each texture. Three.js, the navigation transition proxy, and the no-WebGL fallback all reuse that URL. On Vercel, compatible ordinary `<Image>` requests and WebGL textures therefore share image-transformation cache keys, while R2 remains the immutable upstream origin. Browser gallery traffic does not access R2 directly or depend on bucket CORS.

## Synchronization boundary

`scripts/sync.ts` loads the ignored root `.env` through dotenvx, then uses the official `@notionhq/client` against Notion API version `2026-03-11`. Values already present in the calling process environment take precedence, so the same entry point works in CI without exposing sync configuration to Next.js. The configured root is database `3c6edb27-f124-8070-9d6d-ca256d247c80` and scenario data source `3c6edb27-f124-80f0-a929-000b1fb786d5`. The synchronizer verifies all five database/data-source contracts and the targets of the media-source, franchise, risk-family, and safety-concept relations before importing them. `NOTION_TOKEN` is required for an explicit sync even if the sources are publicly viewable. S3-compatible access key, secret, API endpoint, media bucket, and public media URL variables are also sync-only requirements. The optional `S3_STATE_BUCKET_NAME` defaults to `S3_BUCKET_NAME`; setting it keeps descriptors in a separate bucket. The entry point is a small CLI: `--force` re-downloads and reprocesses every selected image, while `-h`, `-help`, and `--help` print usage without requiring credentials.

The synchronizer paginates data-source rows and relation property values, retrieves blocks, converts scenario prose to Markdown-compatible strings and resource descriptions to plain text, and joins records by Notion page ID. Record-level parsing, citation assembly, and media failures are collected instead of short-circuiting their batches; bold warnings identify the record by title and Notion ID, and a final per-resource summary reports successful and errored counts. Each scenario, media-source, and franchise image batch also reports how many images changed and uploaded at least one derived variant versus how many resolved entirely to already-synced objects. Any record error still fails the atomic sync after the remaining records have been attempted, preserving the previously generated snapshot and search index. It resolves canonical-link metadata once per unique URL, stores citation titles and publisher/domain labels in the snapshot, and uses deterministic URL-derived titles when a remote source cannot be read. Build-time requests and redirects are bounded and restricted to an explicit set of reviewed publication hosts; complete PDFs are parsed locally for their XMP or document-info title. Existing metadata is reused for idempotence; `REFRESH_CITATIONS=1 pnpm content:sync` explicitly refreshes it. The synchronizer downloads required scenario stills or curated YouTube-thumbnail fallbacks, the first image from each franchise page, and, on a best-effort basis, the first image from each media-source page. All three image kinds use Sharp to create gallery/detail WebP variants plus a succinct 8-pixel WebP blur placeholder. Conventional Next.js images receive that inline placeholder from the snapshot. The spatial-gallery mapper also carries the same placeholder into its WebGL client payload, but the canvas only decodes placeholders for the prioritized nearby window. A full texture immediately replaces and disposes its placeholder, retains its loaded source until gallery teardown, and participates in the device-specific GPU binding window; late callbacks are discarded. A missing source image leaves the optional poster empty rather than manufacturing one; a missing scenario or franchise image fails the sync.

Each derived WebP is hashed before publication. Its object key combines the resource identity, variant name, and SHA-256 content hash, so the key changes only when those generated bytes change. An authenticated S3 `HEAD` checks that immutable variant key first. A hit reuses the object without upload; a 404 triggers `PUT` with `image/webp` and `Cache-Control: public, max-age=31536000, immutable`; authentication and transport failures remain fatal. The snapshot stores the separately configured `S3_PUBLIC_URL` plus those object keys, not the authenticated `S3_API_ENDPOINT`. Cloudflare R2 does not implement per-object public-read ACLs, so public access is enabled at the bucket's managed `r2.dev` hostname or custom domain instead.

Reusable media state lives in one small JSON descriptor per Notion record at `media/state/{collection}/{compact-page-id}.json`. Descriptors use `S3_STATE_BUCKET_NAME` when set and otherwise share `S3_BUCKET_NAME` with the immutable variants. The normal read is one authenticated `GET`; an image descriptor's JSON body carries the descriptor schema, page and pipeline markers, selected-source identity, hashes, variant keys, dimensions, caption, and blur placeholder. Optional source records without a poster use a compact `absent` state, so they also skip repeat block scans. Descriptor `HEAD` and custom metadata are deliberately not part of this path. Descriptor writes use `Cache-Control: private, no-store`, which controls caching but does not restrict access. If the shared media bucket has a public delivery origin, descriptor paths may be publicly addressable unless that delivery layer denies the `media/state/` prefix; operators who need storage-level separation can set a distinct state bucket. When both the page edit marker and media pipeline version match, the synchronizer reuses the descriptor immediately, skipping block traversal, source download, and Sharp. When the page changed, it traverses the image blocks and compares the selected block ID plus block edit time; external and configured fallback sources also include their stable URL identity. A matching source reuses the variants and refreshes presentation metadata without downloading the image. This intentionally keeps the invalidation model simple and does not add a minute-rounded settling protocol.

On a cache miss, changed source, pipeline change, or `--force`, the source is downloaded and Sharp recreates gallery, detail, and blur output. The immutable variants are published first; only then is the stable descriptor created with `If-None-Match: *` or replaced with `If-Match` against the ETag returned by its authenticated `GET`. Force bypasses all descriptor/source reuse, but identical output hashes may still resolve to already-existing variant objects.

Schema v2 established the current slug baseline: it ignored v1 slug maps and regenerated every slug. Later syncs preserve the slug belonging to each surviving Notion page ID, allocate deterministic slugs for new IDs, and remove deleted IDs from the map so their former slugs may be reused. Manifest schema v3 moved reusable media state out of the checked file and into R2 descriptors. The current manifest schema v4 adds the franchise data-source contract, record count, and stable slug map while retaining the v3 contract, snapshot counts, and fixture IDs without media entries.

The historical v2-to-v3 transition was seeded safely. When a v2 manifest and missing descriptor are encountered, the synchronizer scans the current image selection and may validate and reuse the matching legacy variant entry. It writes that record's descriptor before a staged current manifest can replace the snapshot. Consequently, a failed migration run leaves the old manifest available for retry rather than committing the new manifest before its reusable state exists in R2. Reading a v3 manifest similarly preserves its existing slug maps and initializes the franchise map for v4 allocation.

Remote writes happen before the staged snapshot is committed. A failed sync can leave an unreferenced content-addressed object, but it leaves the previous snapshot untouched and cannot overwrite a referenced object with different bytes. Normal sync does not delete remote objects because an older deployment or rollback may still reference them; any future garbage collection needs a retention window across deployed snapshots.

`public/media/generated` is removed from the generated-output contract. The versioned snapshot and search index remain in Git, while generated image bytes remain in public object storage. Changing `S3_PUBLIC_URL` from the temporary managed R2 hostname to a custom asset domain does not change object keys or re-upload unchanged bytes; the next explicit sync rewrites the public URLs in the snapshot.

## Testing seams

Pure Vitest suites are reserved for validation, ranking, normalization, serialization, descriptor parsing and binding, storage-key construction, descriptor GET/conditional-PUT behavior, immutable-variant HEAD/PUT branching, and the gallery's nontrivial geometry/state algorithms. Snapshot/manifest coherence is part of `content:validate`; it checks counts, slugs, fixture IDs, baked image presentation fields, and the host-agnostic content-addressed owner path for every media URL without requiring S3 credentials or network access. A small Playwright suite covers the critical gallery-to-dossier, local-search, persistence, and phone-layout journeys through URLs and stable state hooks. It does not assert rendered prose, synchronized titles, slugs, counts, or complete generated bodies. Exact cross-GPU pixels are deliberately not an automated oracle; fixed-size browser captures remain the visual evidence.
