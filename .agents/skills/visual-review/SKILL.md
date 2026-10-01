---
name: visual-review
description: Show the owner annotated before/after screenshots of a visual or UX change, with a feedback box per change they can export, before it merges. Use after any change to how the site looks or behaves, and to present visual candidates to choose from.
---

# Visual review

The owner reviews visual work on one page: production before, this branch after, the exact change outlined, and a feedback box per change whose contents copy back as Markdown. `pnpm review:visual` captures the screenshots and builds that page; publish it as an artifact.

## Steps

1. **Serve the after state.** Start the branch locally (the desktop app's `next-dev` preview, or `PORTLESS=0 pnpm exec next dev --port 3017`) and load each changed route once so it compiles. Production, `https://cultural-alignment.com`, is the before state because it tracks `main`.

2. **Capture.** Write `work/reviews/<date>/capture.json` and run `pnpm review:visual capture <path>`. Cover every changed surface at `desktop` and `mobile`. Scroll each shot to the change and outline exactly what changed with `highlights` on stable `data-*` selectors. Render candidates that exist only locally (one edit, one capture each, then restore the file) with `"sides": ["after"]`. For a follow-up round, the useful before is the branch's previous state: point both origins at the local server, restore the old file, capture `"sides": ["before"]`, then reapply the change and capture `"sides": ["after"]`. Look at every screenshot. Done when each change is visible and outlined in its after shot, with no loading state or overlay hiding it.

3. **Build.** Write `review.json` beside it and run `pnpm review:visual build <path>`. Give each independent change its own section, and say in its summary what changed and what deliberately did not. Use `choices` for picks, and a `table` with a flag column for data edits such as Notion changes.

4. **Publish.** Publish `review.html` as an artifact and share the link. The page saves drafts locally, and **Copy feedback** produces Markdown the owner pastes back. Apply that feedback, recapture, and republish the same file path so the link stays stable.

## Spec formats

`capture.json`: `before` and `after` origins, `out` (shot directory relative to the spec), and `shots[]`, each with `id`, `path`, `viewport` (`desktop` 1440 × 900, `mobile` 390 × 844, or `{width, height}`), and optional `sides`, `scrollTo` + `scrollOffset`, `waitFor`, `storage` (localStorage entries), and `highlights[]` (`selector`, `label`, `side`: `after` by default, `limit`). Captures run with reduced motion, dismiss the spoiler warning, hide the Next.js dev indicator, and merge into `shots.json`, so specs can be captured in parts.

`review.json`: `title` (a short name for the round), `intro`, `shots` (the shot directory), and `changes[]` with `id`, `title`, `summary`, and any of `compare[]` (`shot`, `label`, optional `beforeLabel`/`afterLabel` when the before side is not production), `shots[]` (`shot`, `label`, `side`), `choices[]` (`id`, `label`, `detail`, `shot`), and `table` (`columns`, `rows[]` of `id` and `cells`, `flagLabel`). The schemas in [visual-review.ts](../../../scripts/visual-review.ts) are authoritative.
