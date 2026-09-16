## Documentation

- [README](readme.md): local development, content-sync setup, and public routes.
- [Contributing](CONTRIBUTING.md): change boundaries and verification before submitting work.
- [Architecture](docs/ARCHITECTURE.md): runtime/catalog seams, gallery ownership, synchronization, and meme-review persistence; read before changing those boundaries.
- [Product](docs/PRODUCT.md): audience, purpose, and current capabilities; read when changing product behavior or scope.
- [MVP scope](docs/MVP.md): accepted design decisions and original implementation scope; read when revisiting those decisions.
- [Design system](docs/DESIGN.md): built visual, interaction, and responsive behavior; read before UI changes.
- [QA record](docs/QA.md): acceptance checks, dated verification evidence, and environment limitations; read when validating changes.
- [Content snapshot](content/README.md): generated-output ownership and data licensing; read before synchronization or dataset changes.
- [Notion CMS conventions](docs/notion-cms.md): editorial source-of-truth, scenario curation, media selection, and taxonomy rules; read before changing content in Notion.
- [Meme policy](data/meme-review/GENERATION_POLICY.md) and [creator skill](docs/skills/ai-safety-meme-creator/SKILL.md): batch history/finalization rules and composition workflow; read for meme generation, review, or publication work.
- [Social-image fonts](assets/fonts/README.md): bundled font provenance and licensing; read when changing social-image assets.

## Conventions

- use `pnpm`
- use modern typescript
- no semicolons
- oxfmt for formatting (`pnpm fix:format`)
- oxlint for linting (`pnpm fix:lint`)
- let display text wrap within its grid or box geometry; reserve character-based width measures (`ch`/`em`) for deliberate prose reading lengths

## Testing

- browser-test critical cross-layer journeys through URLs, state, landmarks, and stable data hooks
- unit-test complex math, ranking, normalization, validation, parsing, and serialization
- keep editorial copy and synchronized titles, slugs, counts, and full outputs out of test expectations; derive content invariants from current inputs
- keep rendered HTML prose out of assertions

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
