# Cultural Alignment <!-- omit from toc -->

> Familiar stories for unfamiliar AI problems.

Cultural Alignment is an open-source, exploratory archive that explains AI safety and alignment concepts through scenes from film and television. The homepage begins with recognition: find a scene you know, open its dossier, and then follow the analogy into the technical ideas it illuminates—and the places where it breaks.

[![Build Status](https://github.com/transitive-bullshit/cultural-alignment/actions/workflows/build.yml/badge.svg)](https://github.com/transitive-bullshit/cultural-alignment/actions/workflows/build.yml) [![Code style enforced by Oxc](https://img.shields.io/badge/code_style-oxc-brightgreen.svg)](https://oxc.rs)

## What is here

- A horizontally infinite, velocity-deformed WebGL gallery
- 179 curated scenarios from 129 films and television series
- Scenario dossiers with clips, authored analysis, caveats, and taxonomy
- Five AI-risk-family pivots and 65 AI-safety-concept pivots
- Local, offline-buildable content generated from a one-way Notion sync
- Cross-resource search across scenarios, sources, risk families, and concepts

## Local development

Requires Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

The app reads only sync-generated local files under `content/snapshot`, `public/content/search-index.json`, and `public/media/generated`. Normal development and production builds do not need Notion credentials. These three outputs form one generated release artifact and are intended to be committed together. The current generated-media packaging follow-up is recorded in [QA](docs/QA.md#release-packaging-follow-ups).

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

The synchronizer uses the official Notion client, a fixed data-source ID, stable Notion page IDs, preserved slug tombstones, staged validation, and atomic replacement. Repeating a sync with unchanged source data is idempotent. Never put `NOTION_TOKEN` in a committed environment file.

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
