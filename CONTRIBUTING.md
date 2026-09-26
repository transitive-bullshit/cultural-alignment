# Contributing

Code contributions, bug reports, and focused design-engineering improvements are welcome. The scenario collection is personally curated; public submissions and moderation are outside the product's current scope.

## Local development

Use Node.js 24 or newer and the pnpm version pinned in `package.json`.

```bash
pnpm install
pnpm dev
```

The app runs from the committed content snapshot; ordinary development, validation, and builds need no Notion or storage credentials. Synchronization and authoring setup are documented in [content/README.md](content/README.md).

`pnpm dev` starts Next.js through Portless. Use the printed URL: linked worktrees get branch subdomains, and the shared proxy may use HTTP or a custom port. On first run, follow Portless's terminal prompts for HTTPS setup. Find a running instance with `pnpm exec portless get cultural-alignment`, or use `PORTLESS=0 pnpm dev` to bypass the proxy.

`NEXT_PUBLIC_SITE_URL` overrides the inferred origin. Remove a stale local value when using Portless, or set it deliberately when testing metadata for another origin. A direct local server or build defaults to `http://localhost:3000`.

## Change workflow

Use [AGENTS.md](AGENTS.md) to choose the relevant project guide. Read [Architecture](docs/ARCHITECTURE.md) when changing boundaries, [Design](docs/DESIGN.md) for UI work, and the [snapshot contract](content/README.md) before changing synchronization or generated content. Next.js API changes require the relevant installed guide under `node_modules/next/dist/docs/`.

Use modern TypeScript, omit semicolons, and apply the repository's Oxc rules with `pnpm fix:format` and `pnpm fix:lint`. Follow the test-design conventions in [AGENTS.md](AGENTS.md#testing).

Choose checks for the changed behavior while iterating:

| Change | Focused verification |
| --- | --- |
| Documentation only | Check changed links, commands, and claims against their sources; run `pnpm exec oxfmt --check <changed-files>` |
| Pure logic | `pnpm test:unit path/to/file.test.ts` |
| App code | `pnpm test:checks` for formatting, lint, route types, TypeScript, and unit tests |
| Browser behavior | `pnpm test:e2e tests/e2e/relevant.spec.ts`, plus applicable [manual acceptance checks](docs/QA.md#current-acceptance-checks) |
| Snapshot or synchronization | `pnpm content:validate`, affected sync unit tests, and the [content contract](content/README.md) |
| Meme creator or evals | `pnpm test:meme-skill`; see the [evaluation guide](docs/skills/ai-safety-meme-creator/evals/EVALS.md) for live evals |

Before submitting application, configuration, or synchronized-content changes, run the full checks with one production build:

```bash
pnpm content:validate
pnpm test:checks
pnpm build
PLAYWRIGHT_SERVER=production pnpm test:e2e
```

This follows [CI](.github/workflows/build.yml). `pnpm test` is a shortcut for checks plus browser journeys and builds automatically; it does not include content validation. Documentation-only changes need the focused checks above. Report what ran and any failures or unavailable checks; dated passes in [QA](docs/QA.md) are evidence, not a current test result.

## Browser tests and previews

Run app journeys through `pnpm test:e2e` so Portless supplies the required URL and port. The suite starts and stops its own server and does not reuse `pnpm dev`.

- Default: build, then test a production server.
- `PLAYWRIGHT_SERVER=production`: reuse an existing production **build**. Rebuild after changing code or content.
- `PLAYWRIGHT_SERVER=development`: test a development server explicitly.
- Local runs use installed Google Chrome; CI installs Chromium. `PLAYWRIGHT_CHANNEL` selects another installed channel.
- Failure screenshots and traces are in ignored `test-results/playwright/`; CI also uploads its failure artifacts.

`pnpm build` deliberately uses webpack: clean-cache Turbopack builds stalled during the original integration work. Preserve that choice unless a focused investigation establishes that the problem is resolved.

The main suites exclude meme-skill evals and generated comparison reports. For report changes, generate the ignored HTML via the [archive evaluation workflow](docs/skills/ai-safety-meme-creator/evals/archive-ab/EVALS.md), then run `pnpm test:meme-skill:e2e`.

For manual UI review, check real media as well as the relevant journeys: many browser tests replace optimized images with a tiny fixture, and WebGL/trackpad behavior has [environment limitations](docs/QA.md#environment-limitations).

## Unused code audit

Run `pnpm dlx knip` for an optional unused-code audit; Knip is not a pinned project dependency. `knip.config.ts` supplies Portless placeholders only for config inspection, registers meme composer and fixture-generator entry points, and recognizes Next.js's `server-only` marker.

## Licensing

The code is MIT licensed. Authored structured snapshot data is CC0 1.0; by contributing data intended for that snapshot, you must have the right to dedicate it under those terms. Third-party imagery, titles, trademarks, and linked clips are not covered by that dedication.
