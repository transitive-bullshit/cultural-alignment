# Contributing

Code contributions, bug reports, and focused design-engineering improvements are welcome. The scenario collection is personally curated; public submissions and moderation are outside the product's current scope.

## Local development

Use Node.js 24 or newer and the pnpm version pinned in `package.json`.

```bash
pnpm install
pnpm dev
```

The app runs from the committed content snapshot; ordinary development, validation, and builds need no Notion or storage credentials. Synchronization and authoring setup are documented in [content/README.md](content/README.md).

Keep scratch files and retired-code backups in ignored `work/`; TypeScript and the main unit suite exclude it.

`pnpm dev` starts Next.js through Portless. Use the printed URL: linked worktrees get branch subdomains, and the shared proxy may use HTTP or a custom port. On first run, follow Portless's terminal prompts for HTTPS setup. Find a running instance with `pnpm exec portless get cultural-alignment`, or use `PORTLESS=0 pnpm dev` to bypass the proxy.

`NEXT_PUBLIC_SITE_URL` overrides the inferred origin. Remove a stale local value when using Portless, or set it deliberately when testing metadata for another origin. A direct local server or build defaults to `http://localhost:3000`.

## Change workflow

When starting new work or resuming after a merged PR, establish the checkout's revision before treating its docs as current:

```bash
git fetch origin
git status --short --branch
git log -1 --oneline
git log --oneline HEAD..origin/main
```

For new work based on current main, preserve local edits, switch to `main`, and run `git pull --ff-only` before creating the task branch. Existing task branches may intentionally have an older base; compare relevant files with `origin/main` before diagnosing documentation drift. Remote-tracking refs reflect the last fetch, and each worktree has its own checkout.

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
| Meme composer or evals | `pnpm test:meme-skill`; see the [evaluation guide](docs/skills/ai-safety-meme-creator/evals/EVALS.md) |

Before submitting application, configuration, or synchronized-content changes, run the full checks with one production build:

```bash
pnpm content:validate
pnpm test:checks
pnpm build
PLAYWRIGHT_SERVER=production pnpm test:e2e
```

This follows [CI](.github/workflows/build.yml). `pnpm test` is a shortcut for checks plus browser journeys and builds automatically; it does not include content validation. Documentation-only changes need the focused checks above. Report what ran and any failures or unavailable checks; dated passes in [QA](docs/QA.md) are evidence, not a current test result.

## CI autofix

[Codex CI autofix](.github/workflows/codex-autofix.yml) follows failed CI runs for open, current PRs from trusted collaborators on branches in this repository. It reads failure logs, reproduces the checks, and opens a repair PR targeting the failing branch. Review and merge the repair, then rerun the original PR's CI. Forks, obsolete commits, non-PR branches, and autofix branches are skipped.

The Codex job has read permissions and receives `OPENAI_API_KEY` only through the official action's protected proxy. A separate job publishes the patch and explicitly dispatches CI because `GITHUB_TOKEN` pushes do not trigger workflows. Workflow and agent-instruction changes are rejected. Repairs are never automatically approved or merged.

Repository setup requires the Actions secret `OPENAI_API_KEY` and GitHub's “Allow Actions to create and approve pull requests” setting. API usage is billed to that key. Disable autofix from the workflow's Actions page when needed.

## Browser tests and previews

Run app journeys through `pnpm test:e2e` so Portless supplies the required URL and port. The suite starts and stops its own server and does not reuse `pnpm dev`.

- Default: build, then test a production server.
- `PLAYWRIGHT_SERVER=production`: reuse an existing production **build**. Rebuild after changing code or content.
- `PLAYWRIGHT_SERVER=development`: test a development server explicitly.
- Local runs use installed Google Chrome; CI installs Chromium. `PLAYWRIGHT_CHANNEL` selects another installed channel.
- Failure screenshots and traces are in ignored `test-results/playwright/`; CI also uploads its failure artifacts.

`pnpm build` deliberately uses webpack: clean-cache Turbopack builds stalled during the original integration work. Preserve that choice unless a focused investigation establishes that the problem is resolved.

The main suites exclude the opt-in meme composer suite, `pnpm test:meme-skill`.

For manual UI review, check real media as well as the relevant journeys: many browser tests replace optimized images with a tiny fixture, and WebGL/trackpad behavior has [environment limitations](docs/QA.md#environment-limitations).

### Desktop previews in a fresh worktree

For Claude desktop's preview tool, copy the [launch starter](docs/examples/claude-preview.launch.json) into the worktree only when it has no local configuration:

```bash
mkdir -p .claude
cp -n docs/examples/claude-preview.launch.json .claude/launch.json
```

The ignored local configuration supplies `next-dev` and `next-prod`. Both bypass Portless; use the URL printed by the preview. If a port is occupied, change both its `--port` argument and `port` field. Run `pnpm build` before starting `next-prod`, and rebuild after source changes. Next.js keeps dev output in `.next/dev` separately from the production build. Stop previews owned by the task when finished; keep any pre-existing configuration.

Use the [visual-review skill](.agents/skills/visual-review/SKILL.md) for capture, review, and publication; it includes copyable spec examples. Other environments can use the Portless or direct-server commands above.

## Unused code audit

Run `pnpm dlx knip` for an optional unused-code audit; Knip is not a pinned project dependency. `knip.config.ts` supplies Portless placeholders only for config inspection, registers meme composer and fixture-generator entry points, and recognizes Next.js's `server-only` marker.

## Licensing

The code is MIT licensed. Authored structured snapshot data is CC0 1.0; by contributing data intended for that snapshot, you must have the right to dedicate it under those terms. Third-party imagery, titles, trademarks, and linked clips are not covered by that dedication.
