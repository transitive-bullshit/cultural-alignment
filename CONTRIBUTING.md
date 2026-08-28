# Contributing

Code contributions, bug reports, and focused design-engineering improvements are welcome. The editorial scenario collection remains personally curated by the project owner; a public submission/moderation workflow is outside the MVP.

## Setup

```bash
pnpm install
pnpm dev
```

Before opening a change, run:

```bash
pnpm test
pnpm content:validate
pnpm build
```

Use modern TypeScript, omit semicolons, format with `pnpm fix:format`, and lint with `pnpm fix:lint`. Read `AGENTS.md` and the relevant guide under `node_modules/next/dist/docs/` before changing Next.js 16 framework APIs. Local browser journeys expect an installed Google Chrome; CI installs Chromium separately.

## Boundaries

- Keep runtime code independent of Notion and other hosted data services.
- Add content behavior through `lib/content/catalog.ts`, not ad hoc route joins.
- Keep spatial-field internals behind the gallery's small public interface.
- Preserve stable Notion IDs and generated paths in synchronization changes.
- Regenerate `content/snapshot`, `public/content/search-index.json`, and `public/media/generated` only through `pnpm content:sync`; review and commit their complete atomic diff together.
- Do not commit credentials, temporary Notion asset URLs, or hand-edited files inside any generated target.
- Avoid reopening the approved gallery/Dossier direction in unrelated changes.

The code is MIT licensed. Authored structured snapshot data is CC0 1.0; by contributing data intended for that snapshot, you must have the right to dedicate it under those terms. Third-party imagery, titles, trademarks, and linked clips are not covered by that dedication.
