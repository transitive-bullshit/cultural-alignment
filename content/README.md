# Snapshot and synchronization

Notion is the editorial source; `content/snapshot/` is the public app’s read-only runtime source. `pnpm content:sync` owns that directory and `public/content/search-index.json` as one generated change. Edit editorial content in Notion or change the synchronizer, then regenerate and review the complete diff together. Keep credentials and temporary Notion asset URLs out of generated output.

Normal app development, validation, and builds use the committed snapshot without Notion or storage credentials. Public media delivery is still a network dependency. See [Architecture](../docs/ARCHITECTURE.md) for consumers and [CMS conventions](../docs/notion-cms.md) before editorial changes.

## Run a sync

The entry point loads the ignored root `.env` with dotenvx; existing process environment values take precedence. Every sync mode requires `NOTION_TOKEN`, including for publicly visible Notion sources. Normal and forced syncs also require `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_API_ENDPOINT`, `S3_BUCKET_NAME`, and `S3_PUBLIC_URL`.

| Command | Use when | Media behavior |
| --- | --- | --- |
| `pnpm content:sync` | Default, including new records or changed images | Inspect reusable state; download/process changed selections; publish missing variants |
| `pnpm content:sync --fast` | Existing records have only text, taxonomy, or other non-media changes | Reuse previous snapshot media by stable ID; no image inspection, Sharp, or storage traffic |
| `pnpm content:sync --force` | Media reuse appears stale or a full byte refresh is required | Re-download and process every selected image; identical generated hashes still deduplicate |
| `pnpm content:sync --help` | Inspect CLI usage | No credentials required |

Fast mode assumes all media is unchanged, including ordered meme attachments and intentional missing posters. Generated alt text follows current record titles; custom/caption-authored alt text stays unchanged. It fails when a current scenario, source, or franchise lacks a previous snapshot record; run a normal sync for new records or attachments. Fast and force are mutually exclusive.

After syncing, run `pnpm content:validate` and review the snapshot/search-index diff. For changes to sync logic, also verify an unchanged second sync produces byte-identical output when credentials are available. Ordinary code or documentation changes do not require a sync. Use [Contributing](../CONTRIBUTING.md#change-workflow) for application checks.

## Ownership and contracts

- [Snapshot schema](../lib/content/schema.ts): schema version 3, covering scenarios, sources, franchises, risk families, and safety concepts. Relationships use stable Notion page IDs; slugs are route identities unique within each resource kind.
- [Sync manifest](../scripts/sync-manifest.ts): version 4, holding the five Notion source contracts, current counts, fixture IDs, and stable slug maps. It contains no reusable media entries. The actual configured database/data-source IDs and property contracts live in [sync.ts](../scripts/sync.ts).
- [Validation](../scripts/content-validate.ts): checks schema and relationship integrity, manifest coherence, image presentation fields, and content-addressed owner paths without network or storage credentials.
- Search projection lives in [search-documents.ts](../lib/content/search-documents.ts). `content/snapshot/search-documents.json` and `public/content/search-index.json` must remain byte-identical, with catalog-resolvable URLs.
- `ContentImage` carries absolute public HTTPS gallery/detail URLs, intrinsic dimensions, alt text, a blur placeholder, and an optional focal point. Scenario stills and franchise images are required; source posters are optional. Ordered scenario memes use the same image contract.
- Generated WebP bytes live in public object storage, not Git or `public/media/generated/`. Mutable reuse descriptors live in the configured state bucket.

Surviving page IDs keep their slugs. New IDs receive deterministic slugs; deleting an ID releases its old slug for reuse. A title edit therefore does not imply a URL change. The snapshot’s legacy `featured` boolean comes from historical fixture IDs; homepage selection and featured-first sorting use the Notion `Tags` value `featured` through the catalog.

## Import and publication behavior

The synchronizer checks all five data-source/property contracts, paginates rows and relation values, and resolves relationships by page ID. Scenario prose becomes Markdown-compatible strings; resource descriptions become plain text. Citation metadata is resolved during sync, with bounded requests to reviewed publication hosts and deterministic URL-derived titles when retrieval fails. Existing metadata is reused; `REFRESH_CITATIONS=1 pnpm content:sync` explicitly refreshes it.

Image selection follows the authored Notion media rules, including configured scenario overrides or YouTube-thumbnail fallbacks. Sharp produces gallery/detail WebP variants and a small blur placeholder. A missing optional source poster stays absent; a missing scenario or franchise image fails the sync. Scenario `Memes` files are imported in order and have separate bundle descriptors under `media/state/scenario-memes/`.

Record errors are collected and reported with titles and Notion IDs so a run can expose multiple problems. Any record error prevents publication of the staged local output. Remote objects and descriptors are written before staged validation/replacement: a failed run can leave unreferenced remote objects, but the previous local snapshot/search index stays intact. Review and commit both generated targets together.

## Media reuse and storage boundaries

`S3_API_ENDPOINT` is for authenticated storage operations. `S3_PUBLIC_URL` is the unauthenticated delivery origin written into the snapshot. `S3_STATE_BUCKET_NAME` optionally separates mutable descriptors from `S3_BUCKET_NAME`; otherwise both use the media bucket. Credentials need read/write access to the configured buckets. R2 public delivery is configured at the bucket/custom-domain level, without per-object public-read ACLs.

The current protocol is implemented by [media-descriptor.ts](../scripts/media-descriptor.ts), [media-reuse.ts](../scripts/media-reuse.ts), [meme-media-descriptor.ts](../scripts/meme-media-descriptor.ts), and [media-storage.ts](../scripts/media-storage.ts):

1. Read `media/state/{collection}/{compact-page-id}.json` with one authenticated `GET` and validate its record/pipeline binding. The JSON body owns reuse state; descriptor `HEAD` and custom metadata are not part of this path.
2. Reuse immediately when page and pipeline markers match. This skips block traversal, downloads, Sharp, and variant requests. An optional source without a poster stores an explicit `absent` descriptor.
3. When the page changed, inspect its current image selection. Matching block ID/edit time and pipeline allow reuse; external/fallback sources also compare their stable URL identity. Presentation metadata may update without processing image bytes.
4. On a miss, changed source, pipeline change, or force, download and process. Hash each generated variant and use a key containing its owner, variant, and SHA-256 hash. Authenticated `HEAD` reuses existing objects; only a 404 permits `PUT`. Transport/authentication errors remain fatal.
5. Publish immutable variants before conditionally creating the descriptor (`If-None-Match: *`) or replacing the version read (`If-Match` with its ETag).

Variant responses use `image/webp` and `Cache-Control: public, max-age=31536000, immutable`. Descriptors use `private, no-store`, which is cache policy, not access control: if the shared media bucket is publicly delivered, descriptor paths may also be public. Use a distinct private state bucket or deny the `media/state/` delivery prefix when separation is required.

Page/block markers are a pragmatic invalidation hint, not proof of byte identity. The [image-identity investigation](../docs/outputs/notion-image-identity-research.md) records timestamp limitations and why a more complex settling protocol was not adopted. Use force for an explicit full refresh; rotating signed Notion URLs are not stable image identities.

Normal sync never deletes remote objects: older deployments or rollbacks may still reference them. Changing the public media domain rewrites snapshot URLs on the next normal or forced sync without changing keys or re-uploading identical bytes; fast mode retains existing URLs. Any future garbage collection needs retention across deployed snapshots.

Legacy migrations remain in code for older checkouts: schema v2 established the slug baseline; v2 media entries can seed descriptors before local replacement; v3 manifest reads preserve slug maps while initializing the v4 franchise map. Test these compatibility paths when changing manifest parsing or publication order.

## License

The authored structured snapshot and derived public search index are dedicated under [CC0 1.0](LICENSE). Third-party film/television imagery, titles, trademarks, linked clips, and other third-party material remain subject to their owners’ rights.
