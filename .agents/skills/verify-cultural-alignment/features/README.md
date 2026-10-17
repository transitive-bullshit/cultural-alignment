# Cultural Alignment verification map

This directory is the maintained source for verifying what visitors can do on the Cultural Alignment site. Read this index before driving the app, then use the matching feature file as the recipe. A proof that drives one convenient entry point is incomplete when the feature lists others.

## Baseline preconditions

- Launch with `.agents/skills/verify-cultural-alignment/verify.ts launch` and note the printed run ID and `http://localhost:<port>` URL.
- Require `verify.ts doctor --run=<id>` to pass: it confirms the process, port ownership, the served build, a build that matches the working tree, and a `/scenarios` index that links every snapshot scenario.
- Content comes from the committed snapshot in `content/snapshot/`. Derive titles, slugs, and counts from it at run time.
- Gallery stills, posters, memes, and YouTube clips load from the network. Without network access, media steps are unverified, not passed.
- Never drive a server that this skill did not launch, including the owner's `pnpm dev`.

## Driving conventions

- Drive journeys with `verify.ts drive <journey.ts> --run=<id>`. Each test runs in `desktop` (1440×900) and `mobile` (390×844, touch) projects with fresh browser state.
- Prefer roles, accessible names, and `data-*` hooks. The WebGL gallery's frames exist only on the canvas; probe canvas points and read `data-selected-scenario-id`.
- A fresh visitor sees the gallery introduction and the desktop spoiler warning. Go through them as a visitor would instead of seeding storage.
- Wait on state hooks, not sleeps: `data-gallery-inertia-burst` (`settled` or `skipped`), `data-search-ready="true"`, and `data-state` on intro, spoiler, and copy controls.

## Proof and skip reporting

- Capture the action and its result with `evidence.capture`, and record side effects (clipboard, storage, responses) with `evidence.record` or `evidence.file`.
- UI proof includes a screenshot and an ARIA snapshot with the URL recorded in `steps.json`.
- Mutation-like proof includes a second view: reload for persisted preferences, Back for restored gallery state, clipboard reads for copy actions.
- Name the feature ID, project, and entry point for each claim.
- Report an unreachable step with the attempted command and the unmet precondition. Do not report an entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, followed by exactly four H2 sections in this order:

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify.ts` starts with `Preconditions:` and pairs each user action with the exact Playwright call or command and its observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Scenario gallery](./gallery.md) covers the homepage and archive galleries, the introduction, WebGL selection and opening, Back restoration, risk-family chips, and the server-rendered index.
- [Scenario dossier](./dossier.md) covers the opening, spoiler warning, clip playback, taxonomy cards, copy actions, memes, and the still-only state.
- [Global search](./search.md) covers opening from the header and the shortcut, on-demand index loading, empty states, and navigation to all five resource types.
- [Resource pages](./resources.md) covers the four resource indexes, source sorting and its persistence, and expanding a detail page's scene collection.
- [Social images and crawler files](./social-images.md) covers Open Graph images for all five detail families, the sitemap, robots, and `llms.txt`.
