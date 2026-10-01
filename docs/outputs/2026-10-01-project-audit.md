# Project audit: agent workflow, content, UX, and memes

Audited 2026-10-01 against commit `0fe74c0` and the live site. This records evidence and options; the owning docs hold current behavior. Counts come from the snapshot at that commit (487 scenarios, 270 sources).

## Changed alongside this audit

| Change | Why |
| --- | --- |
| `.agents/skills/add-scenarios` and `audit-scenarios`, with `.claude/skills` linked to `.agents/skills` | The most common editorial task, adding a source and its scenarios, had conventions but no procedure. Auditing had neither. Shared layout with Codex follows the owner's other repos. |
| The meme skill linked into `.agents/skills` | It lived under `docs/skills/`, where neither Claude Code nor Codex discovers skills. A symlink avoids moving 58 eval files and 13 script paths. |
| `docs/notion-cms.md` rewritten as the single editorial reference | It lacked the analysis fields, a writing rubric, source fields, clip URL rules, and three silent traps (below). |
| `pnpm content:audit` (`scripts/content-audit.ts`) | Repeatable check of the snapshot against the conventions, scoped by source or scenario. |
| `pnpm memes:riff` plus the meme skill's riff and taste references | A one-off meme workflow that bypasses review rounds. |
| Dossier opening names the primary concept | See [site UX](#site-ux). |
| `vitest.config.ts` excludes `.claude/**`, `.agents/**`, `docs/skills/**` | Run from the main checkout, vitest collected 139 test files, 82 of them from nested worktrees. |
| Meme-skill suite `testTimeout` raised to 30 s | Two raster suites timed out at 5 s under parallel load but passed alone. |
| Drift fixes in `ARCHITECTURE.md` and `content/README.md` | Related-source links and image overrides described behavior the code does not have. |

## Agent workflow findings

### High

1. **Silent authoring traps in Notion.** A non-empty image caption becomes alt text: 14 stills and 5 posters already carry attribution such as “Image source” as alt text. The analysis fields are stored as escaped Markdown but rendered as plain text, so formatting would appear literally. Deleting any of the 25 IDs in `FEATURED_SCENARIO_IDS` aborts every sync. All three are now documented and the first is audited. The fixture-ID abort should become a warning in `scripts/sync.ts`.
2. **The Notion contract is buried.** Property lists and parsers live in the 2,567-line `scripts/sync.ts`, which creates a Notion client at import, so `parseScenario`, `parseYouTubeVideo`, and `episode` are untested. Extract them into a side-effect-free `scripts/notion-contract.ts` with unit tests.
3. **Meme scripts mix live tools with one-offs.** `package.json` has 19 `memes:*` and 11 eval scripts; `GENERATION_POLICY.md` documents none. Round-specific one-offs are `prepare-round-02`, `assemble-round-02`, `check-layout-pass`, `finalize-reverts`, `assemble`, `archive-round`, and the `skill-ab*`, `skill-v4-impact*`, and `skill-v5-stroke-wrap*` families. Delete them (git keeps history), then list the live batch commands in the generation policy. Knip cannot flag these because every package script counts as an entry point.

### Medium

4. **Internal routes ship to production.** `https://cultural-alignment.com/admin/meme-review` returns a 9 MB page of every review round, including rejected ideas and notes; `/admin/meme-review/export` and `/prototypes/*` are also public. `PATCH /api/meme-feedback` has no environment guard, though Vercel's read-only filesystem likely makes writes fail. Gate these routes to development or behind an explicit environment flag.
5. **Meme history dominates search and size.** `data/meme-review` is about 16 MB of the 28 MB tracked tree; a grep for one scenario slug returns 48 files, 36 of them there. The root `ideas.json` and `feedback.json` are byte-identical copies of round 1, kept only as a legacy default in `lib/meme-review/store.ts`. Closed-round `parts/`, `asset-parts/`, `briefs/`, and `generation-plan.json` (about 4 MB) are read only by the one-off scripts. Drop the duplicates and archive the intermediates.
6. **Dead data path.** `relatedSourceIds` exists in the schema, validator, and catalog, but no Notion property feeds it and all 270 sources have an empty list. Either add a Notion relation or remove the field.
7. **Stale sync configuration.** The three `MISSING_IMAGE_OVERRIDES` in `scripts/sync.ts` target scenarios that now have real stills, and `IMAGE_BLOCK_OVERRIDES` is empty. Remove both.
8. **The README duplicates contributor docs.** It repeats the sync environment variables, Portless, and Playwright details from `CONTRIBUTING.md` and `content/README.md`, and its verification block builds twice. Trim it to the visitor-facing story and link to Contributing.
9. **Meme-skill evals are not in CI.** With the timeout fixed, add `pnpm test:meme-skill` to the build workflow, or state that it is deliberately local.

### Low

10. Split `scripts/` into `sync/` and `memes/` after the one-offs are gone; first move `meme-review-round-utils.ts` into `lib/meme-review`, because the public export route imports it from `scripts/`.
11. Per-source brainstorm files (`gattaca-*`, `moon-*`) were accumulating in `docs/outputs/`. The add-scenarios skill now keeps brainstorms in the conversation unless asked.
12. The local `.git` is 386 MiB, mostly `refs/codex/snapshots/*`. Deleting those refs and running `git gc` is a local cleanup.
13. Rename the snapshot's legacy `featured` boolean to `fixture` to retire the trap `ARCHITECTURE.md` warns about.
14. `.claude/launch.json` lets the desktop app preview `next dev` on a fixed port; it was used for this audit and left uncommitted.

## Content findings

From `pnpm content:audit`:

| Finding | Count | Notes |
| --- | --- | --- |
| More than five concepts | 41 | Only 31% of scenarios have the recommended two or three; 182 have five or more. |
| Three risk families | 117 | The convention says most need one or two. |
| Clips without a start time | 464 of 464 | Every clip starts at 0:00. The player already honors `t=`. |
| No clip | 23 | |
| Still under 1200 px | 49 | |
| Dark still | 25 | Mean luminance below 0.13. |
| Off-aspect still | 18 | Mostly 4:3 TV frames. |
| Caption used as alt text | 19 | |
| Title over 40 characters | 4 | Longest is 55. |
| TV scenario without episode | 1 | `the-answer-is-42` |
| Sources without scenarios | 2 | Undisambiguated duplicates of the BSG and Hitchhiker's sources that scenarios actually use. |
| Sources without trailers | 7 | |

**Filler concepts dilute discovery.** Deployment Safety is attached to 105 scenarios but is primary on one; Governance Failure (106) and AI Control (133) follow the same pattern. Concept pages and related-scenario overlap inherit that noise. A taxonomy-trimming pass with `audit-scenarios`, starting with the 41 over the cap, would sharpen both.

**Contamination.** The caveat of `the-kids-train-to-lose` ends with an unrelated Parks and Recreation joke about Ron Swanson. The editorial pass of `audit-scenarios` targets this class of error.

**Writing drift.** Early entries are tight (Lacie: a one-sentence scene, a two-sentence analogy, a one-sentence caveat). Recent ones (Moon) run longer, stack several disclaimers in Caveats, and repeat concept names in Keywords, which search already indexes. The rubric in `docs/notion-cms.md` now states the target.

## Site UX

The archive's thesis is “this scene is an example of this idea, because …”. The gallery panel and intro dialog say the first half; the Dossier, where visitors land from shared links, did not say it until the reader scrolled past the analysis to a small list of concept names.

**Done:** the Dossier opening names the primary concept, with the gallery's wording and the concept's one-sentence definition, beside the media and above the fold. It follows the media plate on mobile.

**Next, in rough order of value per effort:**

1. **Teach on concept pages.** Concept and risk-family cards show only source, year, and title, so the Goodhart's Law page is 37 titles. Add each scenario's one-line mapping to its card on taxonomy pages. Put it in that page's model rather than `GalleryScenario`, which the WebGL gallery ships for every scenario.
2. **Set clip start times.** A content-only fix: `t=` on each `YouTube Clip` lands the visitor on the scene.
3. **Tie the analysis to the concept.** Label section 02 with the primary concept, for example “Why it's Goodhart's Law”, instead of “AI safety analogy”.
4. **Show definitions in the taxonomy list.** Concept descriptions are already in the Dossier page model but appear only on hover.
5. **Complete the intro example.** The dialog pairs *Don't Look Up* with Governance Failure, one of the broad filler concepts, and omits the “because” line. A crisp pair (Lacie → Goodhart's Law) plus one line of mapping would state the thesis.
6. **Size lone memes up.** One meme renders as a roughly 140 px thumbnail under a full-size “Memes” heading. Scale up when there are only one or two.
7. **Plain eyebrow labels.** “Scenario artifacts”, “Source continuation”, and “Taxonomy neighbors” read as internal vocabulary beside clear headings.

## Memes

**State.** 144 scenarios carry 267 memes. The 203 from review rounds 1–5 were screenshots of the HTML preview renderer (1440 × 900, Barlow Condensed with a drop shadow, relying on a locally installed font). The other 64 were added by hand and match the deterministic composer's style (Impact with a stroke). The rounds are complete: every finalized idea is published.

**Riff workflow (built).** `pnpm memes:riff prepare <slug>` stages the still and a composer fixture, reusing round-5 protected regions for 152 scenarios. The agent writes three or four intents from the supplied reference, composes them in about 9 s each, and presents the previews. `pnpm memes:riff export` then turns the pick into the manifest `memes:upload-notion` already accepts, and a normal sync publishes it. A trial on `lacie-games-her-rating` composed “MODEL AFTER RLHF / PRACTICING ITS 4.5 SMILE” and “YOU'RE ABSOLUTELY RIGHT!” without covering the face or rating; nothing was uploaded.

**Ideas.**

- Pick one house style. The composer is headless and deterministic; the round renderer needs a dev server, Playwright, and a locally installed font.
- Composer gaps: output is fixed at 1200 × 800, which crops about 16% of a 16:9 still; setup-payoff always splits top and bottom, with no stacked-at-one-edge option; fixtures must carry a placeholder `feedback_sources` entry.
- More frames: 464 scenarios have clips, so `prepare` could take `--frame-at <time>` and extract a frame with `yt-dlp` and `ffmpeg`.
- Reference-first entry: paste a tweet and let local search suggest the three best-matching scenarios before riffing.
- Keep taste current: append picks and rejections to `references/taste.md`, or to a `riffs.jsonl` log if volume grows.
- Freeze rounds 1–5 as an archive, as in finding 5.

## Follow-up decisions

The owner reviewed this audit the same day and resolved findings 3–5:

- `/admin/meme-review`, its feedback API, `lib/meme-review`, and `/prototypes/*` were removed from the app rather than gated.
- Review rounds 1–5, round-one idea parts, the round scripts, the archive A/B and Codex-runner evals, and their reports were deleted. A backup lives in the main checkout's ignored `work/backups/2026-10-01-meme-review/`; git history before that date has every file.
- The composer is the single meme style going forward. Protected regions still matching current stills moved to `docs/skills/ai-safety-meme-creator/protected-regions.json` for the riff workflow.
- Clip start times are not worth pursuing, and title length stays a guide rather than a rule.
