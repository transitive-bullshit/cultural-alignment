---
name: add-scenarios
description: Add a movie or TV show and new scenarios to the Notion CMS, publish the snapshot, then generate local meme candidates for human review. Use when asked to add a media source, add scenarios or scenes from a work, or brainstorm scenarios for one.
---

# Add scenarios

A scenario is one recognizable scene plus its authored AI-safety analogy. Every field rule lives in [Notion CMS conventions](../../../docs/notion-cms.md); read it before step 2. This is the procedure.

Notion writes go through the Notion MCP tools. Data source IDs are in `notion.dataSources` of `content/snapshot/manifest.json`; address a data source as `collection://<dataSourceId>`, and relate pages by URL (`https://app.notion.com/p/<id without dashes>`).

## Steps

1. **Check what exists.** Look the work up in `content/snapshot/sources.json`, then query the Media Sources data source in Notion for pages not yet synced. List the source's existing scenarios the same way (snapshot `sourceId`, then Notion `Media source`). Done when you know whether the source and its franchise exist and which scenes are already covered.

2. **Brainstorm.** Skip when the user has already named the scenes. Otherwise research the work from primary material (official clips, screenplay, episode guides, creator interviews) and propose three to five candidates. For each, draft Scene, Why the analogy works, and Caveats; choose risk families and concepts strongest-first from the full vocabulary in `content/snapshot/`; and add a still brief, a clip lead, and the closest existing archive scenarios. Close with a short list of directions to avoid: tempting mappings the scene does not support. Favor scenes whose primary concept is thinly covered (`pnpm content:audit` lists concept usage). Recommend the strongest picks and stop for the user's choice. Done when the user has chosen.

3. **Gather media** in the session scratchpad or the ignored `work/` directory.
   - **Clip:** find a YouTube upload of the exact scene and verify it by sampling frames: `yt-dlp -f 'bv*[height<=720]' -o clip.mp4 <url>`, then `ffmpeg -i clip.mp4 -vf fps=1/5 frame-%03d.jpg`, and look at them. Record the start time when the scene begins partway in.
   - **Still:** extract the hinge moment from a 1080p download (`ffmpeg -ss <seconds> -i clip.mp4 -frames:v 1 still.png`) or take an authentic frame from Clip.Cafe or SHOT.CAFE. Check its size with `ffprobe` and look at it.
   - **New source:** an official trailer URL and a poster or wide key image.

   Done when every chosen scenario has a viewed still that meets the image rules and either a verified clip URL or a noted reason for having none.

4. **Write to Notion.** Fetch each target data source first for the current schema. Upload each image with `notion-create-file-upload`, POST the file to the returned `upload_url` with `curl -F file=@<path>` plus every returned upload header, and use the response's `markdown_source` as the page content, with an empty caption. Create a new source before its scenarios, then create the scenarios under the Scenarios data source with every property the conventions table lists. Relation arrays keep their order, so pass them strongest-first. Leave `Tags` empty. Done when every page exists.

5. **Read back.** Fetch every created page and walk the [scenario completion check](../../../docs/notion-cms.md#scenario-completion-check): properties as submitted, relation order intact, and exactly one Notion-hosted image in the body. Fix and fetch again until every page passes.

6. **Publish.** Sync reads credentials from the root `.env`. A linked worktree lacks that ignored file; link the main checkout's copy with `ln -s "$(git rev-parse --path-format=absolute --git-common-dir)/../.env" .env`.

   ```bash
   pnpm content:sync
   pnpm content:validate
   pnpm content:audit --source <source-slug>
   ```

   New records need the normal sync, not `--fast`. Done when the sync reports zero record errors, validation passes, the audit shows no `fix` findings for the new scenarios, and `git diff --stat` touches only the snapshot, the search index, and the expected records. Report unrelated record changes rather than reverting them: they are someone's Notion edits. Run the synchronized-content checks in [Contributing](../../../CONTRIBUTING.md#change-workflow), then commit as `Add <Source> scenarios from Notion`.

7. **Generate meme candidates.** After the scenarios are added and published, always run the [meme creator](../../../docs/skills/ai-safety-meme-creator/SKILL.md) and its [batch review workflow](../../../docs/skills/ai-safety-meme-creator/references/batch-review.md) for every added scenario. Use its authored analogy, concepts, caveats, and scene visuals to guide distinct jokes; inspect existing memes to avoid duplicates. The scenario still and media source are useful starting points, not required meme imagery. Keep candidates in ignored `work/` and present the entire addition as one temporary local HTML review, grouped by media source and then scenario. Done when every added scenario has viewable candidates or a specific generation blocker, and the review supports likes, dislikes, individual text feedback, and copying candidate data or selected results back into this chat. Candidate generation never changes scenario fields, the page-body still, or Notion `Memes`; a scenario remains complete even if the owner chooses no memes.

## Hand-off

Report each created page's Notion link and site path (`/scenarios/<slug>` from the snapshot), the sync and audit results, any field left blank with the reason, and the local meme review link with candidate counts or blockers. Wait for copied review results and the owner's requested next action: refine candidates, upload explicitly approved candidates, or keep the scenarios without memes. A like is a preference, not upload authorization. Keep the scenario brainstorm in the conversation; save it under `docs/outputs/` only when the user asks.
