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

Use modern TypeScript, omit semicolons, format with `pnpm fix:format`, and lint with `pnpm fix:lint`. Read `AGENTS.md` and the relevant in-repository Next.js 16 guide before changing framework APIs.

## Boundaries

- Keep runtime code independent of Notion and other hosted data services.
- Add content behavior through `lib/content/catalog.ts`, not ad hoc route joins.
- Keep spatial-field internals behind the gallery's small public interface.
- Preserve stable Notion IDs and generated paths in synchronization changes.
- Do not commit credentials, temporary Notion asset URLs, or hand-edited files inside generated media directories.
- Avoid reopening the approved gallery/Dossier direction in unrelated changes.

The code is MIT licensed. Exported snapshot data is CC0 1.0; by contributing content intended for that snapshot, you must have the right to dedicate it under those terms.
