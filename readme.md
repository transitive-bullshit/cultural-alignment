# Cultural Alignment <!-- omit from toc -->

> Familiar stories for unfamiliar AI problems.

Cultural Alignment is an open-source, exploratory archive that explains AI safety and alignment concepts through scenes from film and television. The homepage begins with recognition: find a scene you know, open its dossier, and then follow the analogy into the technical ideas it illuminates—and the places where it breaks.

[![Build Status](https://github.com/transitive-bullshit/cultural-alignment/actions/workflows/build.yml/badge.svg)](https://github.com/transitive-bullshit/cultural-alignment/actions/workflows/build.yml) [![Code style enforced by Oxc](https://img.shields.io/badge/code_style-oxc-brightgreen.svg)](https://oxc.rs)

## What is here

- A horizontally infinite, velocity-deformed WebGL gallery
- Curated scenarios from films and television series
- Scenario dossiers with clips, authored analysis, caveats, and taxonomy
- AI-risk-family and AI-safety-concept pivots backed by authored Notion records
- Local, offline-buildable content generated from a one-way Notion sync
- Cross-resource search across scenarios, sources, risk families, and concepts

## Local development

Requires Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

The app reads only sync-generated local files under `content/snapshot`, `public/content/search-index.json`, and `public/media/generated`. Normal development and production builds do not need Notion credentials once those artifacts have been hydrated. Snapshot JSON is repository content, while `public/media/generated` is deliberately ignored and local. A clean checkout therefore lacks scenario stills and source posters; the unresolved generated-media packaging limitation is recorded in [QA](docs/QA.md#release-packaging-follow-ups).

Set `NEXT_PUBLIC_SITE_URL` to the canonical deployment origin when it cannot be inferred from Vercel; local builds default to `http://localhost:3000`.

### Local production preview

```bash
pnpm build
pnpm start
```

### Verification

```bash
pnpm test
pnpm content:validate
pnpm build
```

Use `pnpm fix:format` and `pnpm fix:lint` to apply the repository's Oxc rules.

Local Playwright journeys use an installed Google Chrome. CI installs its own Chromium before running `pnpm test`.

## Content synchronization

Notion is the editorial source; the repository snapshot is the public runtime source of truth. To refresh it, provide the integration token through the all-caps environment variable—even if the source is publicly viewable—and run the explicit one-way command:

```bash
NOTION_TOKEN=secret_… pnpm content:sync
```

The synchronizer imports the scenario data source plus the media-source, risk-family, and safety-concept data sources connected by its three relations. Records and foreign keys use stable Notion page IDs. It fetches citation titles and publisher/domain labels ahead of time from reviewed publication hosts, including full PDF metadata when available, stages and validates the complete schema-v2 snapshot, locally processes required scenario images and optional source posters, generates the search index, and replaces outputs atomically.

The first schema-v2 sync intentionally regenerates every slug. After that baseline, title and metadata edits retain the slug associated with each surviving page ID; deleting a record removes its mapping and releases its slug for reuse. Repeating a sync with unchanged source data is idempotent because citation metadata is reused by URL; set `REFRESH_CITATIONS=1` on the sync command to fetch every citation again. Never put `NOTION_TOKEN` in a committed environment file.

## Route map

- `/` — featured scenario gallery
- `/scenarios` — complete gallery with risk-family filtering
- `/scenarios/[slug]` — scenario dossier
- `/risk-families` and `/risk-families/[slug]` — risk-family index and pivots
- `/concepts` and `/concepts/[slug]` — concept index and pivots
- `/sources` and `/sources/[slug]` — source index and pivots
- `/search` — full cross-resource search
- `/about` and `/privacy` — project background and privacy policy
- `/sitemap.xml` and `/robots.txt` — generated discovery endpoints for every static index/detail content URL; `/search` is intentionally excluded

The historical design-review artifacts live under `docs/outputs/gate-b`; they are not production navigation.

## Project notes

- [Product context](docs/PRODUCT.md)
- [MVP scope](docs/MVP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN.md)
- [QA record](docs/QA.md)
- [Implementation history and completion checklist](docs/outputs/cultural-alignment-mvp-implementation-plan.md)
- [Contributing](CONTRIBUTING.md)

## License

Code is [MIT licensed](license) © [Travis Fischer](https://transitivebullsh.it).

The authored structured snapshot data is released under [CC0 1.0](content/LICENSE). Third-party imagery, titles, trademarks, and linked clips remain subject to their respective rights.
