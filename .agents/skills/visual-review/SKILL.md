---
name: visual-review
description: Show the owner annotated before/after screenshots of a visual or UX change, with a feedback box per change they can export, before it merges. Use after any change to how the site looks or behaves, and to present visual candidates to choose from.
---

# Visual review

The owner reviews visual work on one page: production before, this branch after, the exact change outlined, and a feedback box per change whose contents copy back as Markdown. `pnpm review:visual` captures the screenshots and builds that page; publish it as an artifact.

## Steps

1. **Serve the after state.** Use [Contributing's preview setup](../../../CONTRIBUTING.md#desktop-previews-in-a-fresh-worktree), then load each changed route once so it compiles. Production, `https://cultural-alignment.com`, is the default before state. For an exact commit baseline or a dev/production comparison, serve that revision locally and set the origins explicitly.

2. **Capture.** Write `work/reviews/<date>/capture.json` and run `pnpm review:visual capture <path>`. Cover every changed surface at `desktop` and `mobile`. Scroll each shot to the change and outline exactly what changed with `highlights` on stable `data-*` selectors. Render candidates that exist only locally (one edit, one capture each, then restore the file) with `"sides": ["after"]`. For a follow-up round, the useful before is the branch's previous state: point both origins at the local server, restore the old file, capture `"sides": ["before"]`, then reapply the change and capture `"sides": ["after"]`. Look at every screenshot. Done when each change is visible and outlined in its after shot, with no loading state or overlay hiding it.

3. **Build.** Write `review.json` beside it and run `pnpm review:visual build <path>` (pass `--out=<name>.html` when another review already lives in that folder). Give each independent change its own section, and say in its summary what changed and what deliberately did not. Use `choices` for picks, and a `table` with a flag column for data edits such as Notion changes.

4. **Publish.** Publish `review.html` as an artifact and share the link. The page saves drafts locally, and **Copy feedback** produces Markdown the owner pastes back. Apply that feedback, recapture, and republish the same file path so the link stays stable.

## Audits

A design audit ends in implemented fixes, not a list of problems. Critique the surface, implement every supported fix (settled owner preferences in DESIGN.md are not findings), and review each one as its own before/after section titled by its outcome. Fixes ship by default and the owner comments by exception, so open the page with a findings `table` whose flag column is "Hold".

## Starter specs

Copy the paired [capture](../../../docs/examples/visual-review/capture.json) and [review](../../../docs/examples/visual-review/review.json) starters into one ignored review folder:

```bash
mkdir -p work/reviews/my-change
cp docs/examples/visual-review/*.json work/reviews/my-change/
pnpm review:visual capture work/reviews/my-change/capture.json
pnpm review:visual build work/reviews/my-change/review.json
```

Before capture, edit the origins to the running servers and replace the routes and highlight selectors with the changed surfaces. Before build, replace the review copy with the actual outcomes. Keep desktop/mobile coverage and matching shot IDs between the files. Output paths are relative to each spec; `capture` merges into `shots.json` for partial recaptures.

The schemas and defaults in [visual-review.ts](../../../scripts/visual-review.ts) own the formats. Captures reduce motion and dismiss the spoiler warning and gallery intro; `storage` overrides those defaults. Use `steps` for interactions after scrolling, `sides` for one-sided candidates, `choices` for picks, and `table` for data edits.
