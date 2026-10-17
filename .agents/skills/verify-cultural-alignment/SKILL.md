---
name: verify-cultural-alignment
description: Launch an isolated Cultural Alignment production server, check it, drive real browser journeys through the gallery, dossiers, search, resource pages, and social images with Playwright, and keep screenshot, ARIA, clipboard, and response evidence. Use to prove a site change works in the running app before reporting it done or handing it to visual-review.
---

# Verify Cultural Alignment

The product surface is the public Next.js site: a WebGL scenario gallery, scenario dossiers, Command-K search, resource indexes and detail pages, and generated social images. This skill proves behavior on a production build served on a private port, driven by Playwright in installed Google Chrome with real media and no mocks. [`verify.ts`](verify.ts) owns every step; [the feature map](features/README.md) holds the recipe for each feature.

Use `pnpm test:e2e` for the regression suite (it mocks images and often WebGL), and the [visual-review skill](../visual-review/SKILL.md) for the owner's before/after review. This skill is the agent's own proof that a change works.

Run every command from the repository root. Prerequisites: `pnpm install` and Google Chrome. Without Chrome, run `pnpm exec playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Media and YouTube load over the network; no Notion or storage credentials are needed.

## Launch

```bash
.agents/skills/verify-cultural-alignment/verify.ts launch
```

- Builds with `pnpm build` (about 20 seconds) when build inputs changed since the last verification build, otherwise reuses `.next`. Inputs are the working tree, except `.agents/`, `docs/`, `tests/`, and `*.md` files, plus `NEXT_PUBLIC_*` and `VERCEL_*` settings from the environment or `.env*` files. `--rebuild` forces a build.
- Starts `next start` on a free port bound to 127.0.0.1 and waits until it is usable: `/` serves the site header and gallery markup, and `/content/search-index.json` responds. It then prints the `run` ID, the `url` (always `http://localhost:<port>`), and the `evidence` directory. A nonzero exit means the server is not ready; the message says why and how to stop what started.
- Pass `--run=<id>` to every later command whenever another agent may be using this checkout.
- `--dev` starts `next dev` instead, for repeated edits without rebuilding. Next.js allows one dev server per checkout, so launch refuses when `.next/dev/lock` names a live server that this skill did not start: that is the owner's session; do not drive or stop it. `next dev` may also rewrite the managed block in `AGENTS.md`; check `git status` afterward.

## Doctor

```bash
.agents/skills/verify-cultural-alignment/verify.ts doctor --run=<id>
```

A read-only check of whether the instance is worth driving. Run it first whenever anything looks off; `drive` also runs it and refuses to continue after a failure.

| Check | Fails when | Fix |
| --- | --- | --- |
| `process` | The server process group is gone | Read `evidence/<run>/server.log`, then `stop` and relaunch |
| `port` | Another process holds the port | `stop`, then relaunch |
| `http` | `/` lacks the header or gallery, or search index is missing | Read `server.log` |
| `build` | `.next` was rebuilt under the server (`pnpm build`, default `pnpm test:e2e`) | `stop`, then relaunch |
| `source` | Build inputs changed since the build | `stop`, then relaunch to verify current code |
| `content` | `/scenarios` does not link every scenario in `content/snapshot/scenarios.json` | Rebuild; if it persists, it is a finding |

## Drive

```bash
.agents/skills/verify-cultural-alignment/verify.ts drive .agents/skills/verify-cultural-alignment/journeys/gallery.journey.ts --run=<id>
```

- Each journey file holds Playwright tests that use the evidence fixture. Every test runs in a `desktop` (1440×900) and a `mobile` (390×844, touch, 2×) project with fresh browser state. Narrow a run with `-- --project=desktop` or `-- --grep "<test title>"`. Several journey files can share one drive.
- The shipped journeys under `journeys/` cover the mapped features. To prove a specific change, add an ad-hoc journey in ignored `work/verify/journeys/<change>.journey.ts`:

  ```ts
  import {
    expect,
    test
  } from '../../../.agents/skills/verify-cultural-alignment/journeys/fixtures'

  test('the change does what it claims', async ({ page, evidence }) => {
    await page.goto('/concepts')
    await evidence.capture('before the action')
    // Act as a visitor would, then assert and capture the result.
  })
  ```

- Locate elements by role, accessible name, or the `data-*` hooks named in the feature files, never by coordinates or CSS module class names. The WebGL gallery is the exception: its frames exist only on the canvas, so the gallery journey probes canvas points until `data-selected-scenario-id` appears.
- Derive targets from `content/snapshot/*.json`, as the shipped journeys do, instead of fixed titles, slugs, or counts.
- `--headed` opens a visible Chrome window on the owner's screen; use it only when asked.

## Evidence

Everything lands in `work/verify/evidence/<run>/`, which is git-ignored and is never deleted by `stop`:

- `server.log`, plus `build.log` when the launch built
- `<NN>-<journeys>/report.json`: the Playwright result for that drive
- `<NN>-<journeys>/playwright/`: a `trace.zip` and final screenshot per test; open a trace with `pnpm exec playwright show-trace <path>`
- `<NN>-<journeys>/<project>/<test>/`: numbered captures (`.png` and `.aria.yml`), records (`.json`), produced files (`.md`, `.webp`, `.xml`), and `steps.json` with the outcome, the URL for each step, and every console error, failed request, and HTTP error seen. Problems a journey declared with `evidence.expectProblems` are listed apart under `expectedProblems` with their reason

The fixture in [`journeys/fixtures.ts`](journeys/fixtures.ts) provides `evidence.capture(label, { target?, fullPage? })`, `evidence.record(label, data)`, `evidence.file(label, extension, body)`, and `evidence.expectProblems(pattern, reason)` for problems a step causes on purpose (matched against the problem's kind and failing URL, never the page URL), plus `exploreFromGalleryIntro`, `readLocalStorage`, and the app's `storageKeys`.

Proof standards:

- Exercise the visitor's path: URLs, clicks, taps, keys, and Back. Never seed localStorage or call app internals to reach a state. Reading storage after a user action is valid proof of a side effect.
- Capture the action and its result, not just the final screen.
- Verify side effects alongside the screen: clipboard text, persisted preferences, URLs, response headers and bytes, and restored selection after Back. Assert them; a value that is only recorded proves nothing.
- Do not mock images, WebGL, routes, or YouTube. Those are real boundaries for visitors. If one is unreachable, report the step as unverified rather than stubbing it.
- Assert the downstream effect when the UI flips a flag optimistically. For example, `data-playing` changes on click, but only an advancing clip time proves playback.
- Known noise in `steps.json` problems: `/_vercel/insights/script.js` 404s (Vercel Analytics exists only on Vercel), the `THREE.Clock` deprecation warning, aborted YouTube `qoe` stats requests, and CSS preload warnings. Treat anything else as a finding.
- Report the run ID, the journeys and projects driven, pass or fail per test, the evidence path, and what remains unverified: Safari, physical trackpads, and real GPUs ([QA environment limitations](../../../docs/QA.md#environment-limitations)). Inspect WebGL screenshots instead of pixel-diffing them.

## Cleanup

```bash
.agents/skills/verify-cultural-alignment/verify.ts stop --run=<id>
```

`stop` signals only the process group that `launch` started, and only while that group still runs Next.js. It removes `work/verify/instances/<run>/`, never touching the evidence or `.next`. Without `--run` it stops the only running instance; `--all` stops every instance recorded in this checkout. Run it after failed attempts too. `list` shows recorded instances and their state. Delete old evidence by hand (`rm -rf work/verify/evidence/<run>`) once it is no longer needed.

## Isolation

Each launch gets its own port, and several production instances can share one build. Concurrent production launches in one checkout take turns: each waits for the launch lock, then reuses the build the previous one registered. `launch` refuses to rebuild while a production verification server from this checkout, or any other Next.js process using this checkout, is running, because a rebuild replaces `.next` under it. A `--dev` instance does not block it: `next dev` serves from `.next/dev`, which `next build` leaves alone. It reads process working directories from `/proc` or `lsof`; when it cannot read one, it treats that Next.js process as using this checkout and refuses. To verify different code in parallel, use a separate worktree. While an instance is up, do not run `pnpm build` or a default `pnpm test:e2e`; `PLAYWRIGHT_SERVER=production pnpm test:e2e` reuses the build and is safe.

## Files

| File | Role |
| --- | --- |
| [`verify.ts`](verify.ts) | Executable CLI: `launch`, `doctor`, `drive`, `list`, `stop` |
| [`playwright.config.ts`](playwright.config.ts) | Verification projects and evidence output; used only through `drive` |
| [`journeys/fixtures.ts`](journeys/fixtures.ts) | Evidence fixture and shared helpers |
| `journeys/*.journey.ts` | One runnable journey per mapped feature |
| [`features/`](features/README.md) | The maintained feature map |

When the app changes intentionally and a journey breaks, update the journey and its feature file together. Add a feature file and journey for each new user-facing feature.
