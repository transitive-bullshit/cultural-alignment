---
name: audit-scenarios
description: Audit and critique existing scenarios and media sources against the Notion CMS conventions, then propose, and on approval apply, fixes in Notion. Use when asked to review, critique, or clean up scenarios, one source's scenarios, or the archive's content quality.
---

# Audit scenarios

Two passes over a scope: a mechanical pass that `pnpm content:audit` runs against the snapshot, and an editorial pass that judges each scenario against [Notion CMS conventions](../../../docs/notion-cms.md). Read the conventions first; they define every rule this skill applies.

## Steps

1. **Fix the scope.** One source (`--source <slug>`), named scenarios (`--scenario <slug>`, repeatable), or the whole archive. For the whole archive, the editorial pass covers every flagged scenario plus each featured one; state that scope in the report. When Notion has text edits newer than the last sync, refresh first with `pnpm content:sync --fast` (needs `NOTION_TOKEN` in `.env`; see [add-scenarios](../add-scenarios/SKILL.md#steps) for linking it into a worktree).

2. **Mechanical pass.** Run `pnpm content:audit` with the scope flags (`--json` for complete lists). `fix` findings break a stated convention. `review` findings need judgment: a dark still can still be the best frame, and a missing clip can be correct. Done when every finding in scope has a verdict.

3. **Editorial pass.** For each scenario in scope, read its record in `content/snapshot/scenarios.json` with concept and family names resolved, and judge it against the conventions' writing and taxonomy sections:
   - **Scene:** one recognizable moment led by its concrete hinge, free of interpretation and AI vocabulary.
   - **Why the analogy works:** names the mechanism and who plays each role, rather than restating the scene or name-dropping a concept, and lands on one crisp line.
   - **Caveats:** leads with the most important disanalogy and stays about this scene. Text about another work is contamination.
   - **Taxonomy:** the primary concept is what the scene most clearly shows; filler concepts and families that do not follow from the concepts come off.
   - **Title:** the recognizable action rather than concept jargon, within 40 characters.
   - **Accuracy:** names, numbers, chronology, and who does what. Check the clip or a primary source when unsure.

   Done when every scenario in scope is marked keep or carries proposed edits with exact replacement text. For a large scope, split by source across subagents that each receive the conventions and this rubric, then merge their findings.

4. **Report.** Group proposals as errors (wrong or contaminated text), convention fixes, then quality improvements. Give each the Notion link, current text, proposed text, and a one-line reason. Write long reports to `work/audits/<date>-<scope>.md` (ignored) and summarize in chat. Stop for approval.

5. **Apply approved edits.** Update pages with `notion-update-page` (`update_properties`). Relations are replaced wholesale, so pass the complete ordered array. Text and taxonomy edits publish with `pnpm content:sync --fast`; image changes need a normal sync. Then run `pnpm content:validate` and the same `content:audit` scope. Done when the approved findings are gone and the diff touches only the edited records. Commit as `Update <scope> scenarios from Notion`.

When a finding recurs because a convention is unclear or wrong, propose the wording change to `docs/notion-cms.md` and, for a mechanical rule, a matching check in `scripts/content-audit.ts`.
