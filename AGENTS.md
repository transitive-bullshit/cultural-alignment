# Working in Cultural Alignment

Cultural Alignment helps visitors recognize an AI-safety idea through a familiar film or TV scene, then read the analogy and its limits. Preserve that recognition-first exploration and the authored Dossier direction. This is a personally curated archive, not a community submission product.

The public Next.js app reads a committed content snapshot; Notion editing and synchronization are separate workflows. Normal app development needs no CMS or storage credentials.

## Find the context for your task

Start with [Contributing](CONTRIBUTING.md) for setup and verification. Read [Architecture](docs/ARCHITECTURE.md) for domain objects, relationships, code ownership, and boundary changes. Then load only the relevant references:

| Task | Read |
| --- | --- |
| Product behavior or scope | [Product](docs/PRODUCT.md); [MVP decisions](docs/MVP.md) when revisiting an accepted direction |
| UI or interaction changes | [Design](docs/DESIGN.md); [QA](docs/QA.md) for visual and device checks; [visual-review](.agents/skills/visual-review/SKILL.md) skill |
| Sync, generated data, or media storage | [Snapshot and sync contract](content/README.md) |
| Editorial work in Notion | [CMS conventions](docs/notion-cms.md) |
| Add a media source or scenarios | [add-scenarios](.agents/skills/add-scenarios/SKILL.md) skill |
| Audit or critique existing content | [audit-scenarios](.agents/skills/audit-scenarios/SKILL.md) skill (`pnpm content:audit`) |
| Make, riff on, or publish a meme | [ai-safety-meme-creator](docs/skills/ai-safety-meme-creator/SKILL.md) skill |
| Social-image assets | [Font provenance](assets/fonts/README.md) and Architecture's social-image boundary |
| Header-only first load | [Investigation](docs/BLANK-FIRST-LOAD-INVESTIGATION.md) before changing the renderer or delivery setup |

Project skills live in `.agents/skills/`; `.claude/skills` links there so Claude Code and Codex share them, and the meme skill is linked in from `docs/skills/`. When a recurring task gains a trap or a better recipe, update its skill.

The top-level [README](readme.md) serves human visitors. Keep agent workflow guidance in these documents. Current contracts live in the linked docs and code; dated QA runs, `docs/outputs/` plans, and skill proposals preserve evidence and alternatives, not an outstanding task list. Update the owning document when behavior changes rather than adding another overlapping guide.

## Conventions

- Use `pnpm`, modern TypeScript, and no semicolons.
- Use Oxfmt (`pnpm fix:format`) and Oxlint (`pnpm fix:lint`); configuration and exact script definitions live in the repository.
- Let display text wrap within its grid or box geometry; reserve character-based width measures (`ch`/`em`) for deliberate prose reading lengths.
- Before merging a change to how the site looks or behaves, show the owner annotated before/after screenshots with the visual-review skill.

## Testing

- Browser-test critical cross-layer journeys through URLs, state, landmarks, and stable data hooks.
- Unit-test complex math, ranking, normalization, validation, parsing, and serialization.
- Derive content invariants from current inputs. Keep editorial prose, synchronized titles/slugs/counts, and full generated outputs out of fixed expectations.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
