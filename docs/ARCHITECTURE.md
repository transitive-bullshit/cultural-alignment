# Architecture

This is the map for changing runtime boundaries, domain behavior, and feature ownership. [Product](PRODUCT.md) explains the audience and purpose; [MVP decisions](MVP.md) records the accepted direction; [Design](DESIGN.md) owns visible and interaction behavior.

## Runtime boundary

The public archive reads a validated, versioned snapshot from `content/snapshot`. Notion is the editorial source, reached only through an explicit synchronization operation. This keeps browsing and deployments independent of CMS availability and credentials while preserving a reviewable content history in Git. There is no application database.

Server Components request page models from the content catalog; client islands receive the data needed for interaction. A normal build needs no Notion or object-storage credentials. Public image delivery remains a network dependency, including image optimization and social-image rendering.

```text
Notion: scenarios, sources, franchises, risk families, concepts
        │ explicit content:sync; validate and stage
        ├── media processing ──► immutable public images + reusable media state
        ▼
content/snapshot + public/content/search-index.json
        │
        ▼
ContentCatalog
        ├── Server Component pages, metadata, sitemap, llms.txt
        └── page models for gallery, dossier, and search interactions
```

## Domain model

The five record types live in [schema.ts](../lib/content/schema.ts). Relationships use stable Notion page IDs; slugs are public addresses unique within a resource kind.

| Term | Meaning and relationships |
| --- | --- |
| Scenario | One recognizable scene and its authored AI analogy: what happens, why the analogy works, and its caveats. Belongs to one source, at least one risk family, and at least one safety concept. Requires a still; a clip, release date, and ordered meme attachments are optional. |
| Source | One movie or TV work, with optional poster and descriptive metadata. Owns ordered franchise memberships. Its `relatedSourceIds` field has no Notion property yet, so sync always writes an empty list. TV episode identity belongs to the scenario. |
| Franchise | A collection of sources with an authored description and required representative image. Scenarios belong indirectly through their source. |
| Risk family | A broad classification of AI risk, with short/full names, description, and citations. |
| Safety concept | A more specific idea used to explain the analogy, with short/long names, description, search keywords, and citations. |

A **Dossier** is the scenario-detail presentation, not a sixth record type. **Resource** means a source, franchise, risk family, or concept in catalog page models. Compact surfaces use short taxonomy names; taxonomy detail pages use full or long names.

`ContentImage` carries absolute HTTPS gallery/detail URLs, intrinsic dimensions, alt text, and a blur placeholder, with an optional focal point. Required images and optional posters share this contract. [validate.ts](../lib/content/validate.ts) checks schema, relational integrity, slug uniqueness, image presentation, and source/episode consistency before catalog construction. Routes can therefore consume resolved relationships without inventing content fallbacks.

## Ownership and entry points

| Change | Start here |
| --- | --- |
| Domain validation, relationships, page models | [lib/content](../lib/content): `schema.ts`, `validate.ts`, `catalog.ts`; `snapshot.ts` wires the checked-in data into the runtime |
| Route composition and metadata | [app](../app); [lib/site.ts](../lib/site.ts) owns deployment-origin resolution |
| Discovery and search | [scenario-discovery.ts](../lib/content/scenario-discovery.ts), [search-documents.ts](../lib/content/search-documents.ts), [search.ts](../lib/content/search.ts) |
| Gallery layout, input, rendering, state | [features/spatial-gallery](../features/spatial-gallery) |
| Dossier media, spoilers, memes, discovery presentation | [features/scenario-dossier](../features/scenario-dossier), [features/spoiler](../features/spoiler) |
| Shared scenario cards and collection sorting | [features/scenario-collection](../features/scenario-collection), [features/collection-sort](../features/collection-sort) |
| Resource pages and social cards | [features/content-navigation](../features/content-navigation), [lib/media](../lib/media) |
| Synchronization and media reuse | [scripts/sync.ts](../scripts/sync.ts); detailed contract in [content/README.md](../content/README.md) |
| Meme composition and publication | [creator skill](skills/ai-safety-meme-creator/SKILL.md), [meme-riff.ts](../scripts/meme-riff.ts) |

`ContentCatalog` is the domain boundary. Add relationship/filter behavior there and return a page model rather than joining raw IDs in routes or clients. Feature directories own presentation and interaction; route components compose them. This keeps different entry points consistent and makes domain behavior testable without rendering.

## Content behavior worth preserving

**Featured has a legacy trap.** Homepage selection and featured-first collection sorting use the Notion `Tags` value `featured`. The snapshot's separate `featured` boolean comes from historical fixture IDs and does not control these surfaces. Consume the catalog's projected `featured` value.

**Franchise order is meaningful.** The first authored franchise on a source defines a scenario's continuation collection; without one, continuation uses the same source. Related scenarios come from outside that collection and use deterministic taxonomy overlap, weighted toward concepts. This is a simple discovery heuristic, not an editorial popularity ranking. Keep its selection logic in `scenario-discovery.ts`.

**Collections share one card implementation.** Resource pages render the full result set in a continuous collection; dossier discovery renders bounded previews. Continuous default ordering is a stable featured-first partition; date sorts are explicit alternatives. Previews retain discovery order. Layout density and image treatment are separate inputs.

**Search is local.** Synchronization writes matching snapshot/public search documents for all five resource kinds. The lazy Command-K palette loads the public index; normalization, ranking, and grouping belong to `lib/content/search.ts`. Every indexed URL must resolve through the catalog. Search has no dedicated query route.

## Server/client split and routes

The server owns content projection, filtering, discovery, metadata, and static parameters. The client owns WebGL, gestures, local preferences, the command palette, clipboard feedback, YouTube playback controls, and navigation transitions. Keep content decisions on the server and pass small resolved models across the boundary.

Content detail pages enumerate known slugs and disable unknown dynamic parameters. `/scenarios` and its risk-family paths are pre-rendered; legacy `?family=` URLs permanently redirect to `/scenarios/family/[slug]`. Public pre-rendered page segments remain reusable in the client Router Cache for one hour, configured in [next.config.ts](../next.config.ts); administrative/API routes retain separate behavior.

[lib/site.ts](../lib/site.ts) resolves the origin used by canonical metadata, sitemap, and machine-facing links. The sitemap derives public resource URLs from the catalog. `llms.txt` supplies a compact project description and entry points.

## Spatial gallery invariants

`features/spatial-gallery` owns the projected surface from deterministic layout through rendering and restoration. Route components choose the content set; they do not coordinate its geometry.

- **One horizontal axis.** Vertical wheel deltas move the field. Horizontal-dominant fine-pointer deltas pass through to preserve browser Back/Forward gestures. Cyclic modular assignment avoids mirrored seams and immediate duplicates while permitting distant copies of one scenario.
- **Selection identifies a projected slot.** A scenario can appear more than once. Hover, the transition proxy, and pointer picking must target the exact projection. Picking inverts the live shader deformation so visible and interactive geometry stay aligned during motion.
- **Density changes preserve the field.** The versioned frame-size preference applies to both homepage and archive; only the archive exposes its control. Camera zoom scales frames and gaps together. A maximum-capacity field changes its active lane window instead of rebuilding item assignments. Pointer changes interpolate; keyboard and reduced-motion changes snap. See `gallery-sizing.ts`, `gallery-lane-motion.ts`, and `gallery-item-size-preference.ts` before changing this behavior.
- **Loaded images and GPU residency are separate.** Successfully loaded full-image sources live until gallery teardown. A bounded prioritized set remains bound to GPU textures; eviction preserves the source so returning cards need no repeat download or blurred fallback. `texture-residency.ts` owns the priority policy; teardown releases resources and stale callbacks are discarded.
- **Back restores exploration.** History stores continuous field position and selection, keyed separately for the homepage and each archive risk-family filter. Capture before navigation; restore before the intro coast. See `history-state.ts` and `selection.ts`.

These constraints preserve visual continuity while allowing input, density, and resource management to evolve independently. [Design](DESIGN.md) owns appearance and motion behavior; [QA](QA.md) records browser evidence and known limitations.

## Media delivery and social images

[next.config.ts](../next.config.ts) derives the image allowlist from snapshot URLs, without storage configuration. The gallery's [mapper](../features/spatial-gallery/gallery-items.ts) uses `getImageProps` to produce one shared optimizer URL for WebGL, the transition proxy, and the no-WebGL fallback. This shares transformation cache keys with compatible ordinary Next images and keeps gallery browser traffic independent of R2 CORS. Preserve that common URL path when changing texture resolution.

Social-image routes use Takumi, Sharp, and bundled fonts. [social-image.ts](../lib/media/social-image.ts) fetches public detail images and crops them before rendering to preserve focal framing. Deployment needs both Takumi package externalizations and the Barlow font trace in `next.config.ts`; these are required runtime assets, not build cleanup candidates. Read [font provenance](../assets/fonts/README.md) before replacing assets and [QA](QA.md#takumi-social-image-migration-2026-09-14) for the migration evidence.

## Synchronization boundary

`content:sync` is an explicit one-way editorial operation. It validates all five Notion contracts, resolves relationships and citations, processes media, and validates staged output before replacing the snapshot and public search index together. Surviving Notion IDs preserve their public slugs. Normal development consumes the checked-in snapshot.

Image bytes are immutable, content-addressed objects; reusable media state lives separately in per-record descriptors. Remote publication precedes local replacement. A failed sync preserves the previous snapshot but may leave unreferenced remote objects. Normal sync retains old objects because existing deployments and rollbacks can still reference them.

Read [the content contract](../content/README.md) before synchronization, schema/manifest changes, media reuse changes, or generated-output edits. It owns modes, credentials, media invalidation, migration compatibility, and verification. Read [Notion conventions](notion-cms.md) before changing editorial content.

## Meme authoring boundary

Memes are authored outside the app. The [creator skill](skills/ai-safety-meme-creator/SKILL.md)'s deterministic composer renders them locally; `pnpm memes:riff export` and `pnpm memes:upload-notion` attach a chosen image to a scenario's Notion `Memes` property, and a normal content sync publishes it. The app only displays snapshot memes. The round-based review tool and its history were retired on 2026-10-01; git history keeps them.

## Verification seams

Use pure tests for domain validation, ranking, serialization, storage protocols, and nontrivial gallery algorithms. Use browser journeys for navigation, state restoration, search, and filters. Generated-output coherence belongs to `content:validate`; exact cross-GPU pixels require visual review. [Contributing](../CONTRIBUTING.md) owns commands and change-specific checks; [QA](QA.md) owns dated evidence and environment limitations.
