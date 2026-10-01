# Notion CMS conventions

Notion is the editorial source of truth for most site content. The application reads the generated repository snapshot, so publish Notion changes with `pnpm content:sync` rather than by editing generated content directly. See the [snapshot and sync contract](../content/README.md) for modes and requirements.

This is the reference for editorial rules. The [add-scenarios](../.agents/skills/add-scenarios/SKILL.md) and [audit-scenarios](../.agents/skills/audit-scenarios/SKILL.md) skills hold the procedures, and `pnpm content:audit` checks the mechanical rules below against the snapshot.

## Canonical databases

- [Cultural Alignment Data](https://app.notion.com/p/transitive-bs/Cultural-Alignment-Data-3c6edb27f124801f8c10edc3c80b4e10?source=copy_link) — root page
- [Scenarios](https://app.notion.com/p/3c6edb27f12480709d6dca256d247c80) — primary content table
- [Media Sources](https://app.notion.com/p/3caedb27f124804d9004c7b1b3057002)
- [Media Franchises](https://app.notion.com/p/3cdedb27f12480c3850fdadca165c684)
- [AI Risk Families](https://app.notion.com/p/3caedb27f124809684c3ef0a4e694c4c)
- [AI Safety Concepts](https://app.notion.com/p/3caedb27f124800a85cee51e4d74c596)

Data source IDs for API and MCP queries are in `notion.dataSources` of [the snapshot manifest](../content/snapshot/manifest.json); the property contracts the synchronizer enforces live in [sync.ts](../scripts/sync.ts).

## Scenarios

Treat Scenarios as the project's most important content table. A scenario earns its place when a visitor who recognizes the scene leaves able to name the AI-safety idea and say why the scene shows it.

| Property | Rule |
| --- | --- |
| `Example` (title) | The recognizable character, object, or quote plus an active verb: “Lacie Games Her Rating”, “HAL Resists Disconnection”. Target 30–40 characters or fewer. Concept vocabulary belongs in the analysis. |
| `Media source` | Exactly one source. |
| `Episode` | TV scenarios only: the episode title, optionally linked to an official or Wikipedia episode page. Leave it blank for movies. |
| `Date` | Episode air date for TV, release date for film. |
| `Scene` | See the writing rules below. |
| `Why the analogy works` | See the writing rules below. |
| `Caveats` | See the writing rules below. Shown as “Where the analogy breaks.” |
| `AI risk families` | Most scenarios have one or two, ordered strongest first. |
| `AI safety concepts` | At least one; most have two or three; five is a soft cap. Ordered strongest first. |
| `YouTube Clip` | Best effort. See clips below. |
| `Keywords` | Comma-separated search phrases; see the writing rules below. |
| `Tags` | Leave `featured` off unless the project owner directs otherwise. It controls homepage selection; the snapshot's legacy `featured` boolean is a separate fixture flag. |
| `Memes` | Ordered finalized meme files; see [meme attachments](#meme-attachments). |
| Page body | Exactly one representative still. See [images](#images). |

Never delete or trash a scenario listed in `FEATURED_SCENARIO_IDS` in [sync.ts](../scripts/sync.ts): those legacy fixture IDs must exist, and a missing one aborts every sync.

### Writing the analysis

The Dossier reads Scene → Why the analogy works → Caveats, with the primary concept named at the top. Each field does one job; keep them separate. Write each as one plain-text paragraph: the Dossier renders these fields as plain text, so bold, links, and Markdown characters appear literally.

- **Scene** describes one specific moment a fan would recognize, in one or two plain sentences. Lead with the concrete hinge (a quote, number, prop, or action): “Lacie engineers friendships and a wedding speech to raise her rating from 4.2 to 4.5.” No AI vocabulary and no interpretation; spoilers are fine.
- **Why the analogy works** names the mechanism so a reader who cannot define the concept still gets it: who plays the optimizer, what objective or proxy it pursues, who oversees it, and what goes wrong. Two or three sentences, ending on one crisp line (“The metric consumes the thing it was supposed to measure.”). It should make the primary concept recognizable; naming the term is optional.
- **Caveats** lead with the single most important disanalogy (human rather than software, deliberate rather than accidental, fiction rather than evidence) and add at most one more. One to three sentences about this scene only.
- **Keywords** add four to six search phrases that search does not already index: character and actor names, memorable quotes, numbers, props, and alternate phrasings. Search already indexes the title, source, franchise, taxonomy names, and all three analysis fields.

### Taxonomy

AI Risk Families and AI Safety Concepts are controlled vocabularies. Reuse existing entries; create a family or concept only when explicitly asked. Review the full list (names and descriptions are in [concepts.json](../content/snapshot/concepts.json) and [risk-families.json](../content/snapshot/risk-families.json)) before choosing, then keep only meaningful associations.

The first concept is the scenario's **primary concept**: the gallery panel and Dossier opening present it as “This scene is an example of …”, and the social image leads with it. Choose the idea the scene demonstrates most clearly. Broad concepts such as AI Control, Governance Failure, and Deployment Safety belong only when they are the actual point; `pnpm content:audit` reports how often each concept is attached versus primary.

### Clips

- Prefer a clip of the exact scene from an authoritative source (official studio or Movieclips-style channels) or a well-viewed upload. Source authority and view count are signals, not hard requirements.
- Use the scene itself: exclude parodies, livestreams, reactions, and videos with commentary over the scene.
- Verify the clip shows the claimed moment by sampling frames (`yt-dlp` and `ffmpeg` are installed) or reading its captions.
- Use a `youtube.com/watch?v=…` or `youtu.be/…` URL; other hosts fail the sync. When the scene starts partway through a longer video, add its start time as seconds or `1m35s` (`&t=95`); a `1:35` form is silently ignored. The player resets to that start.
- Leave the field blank if no suitable clip exists.

### Meme attachments

Scenario memes belong in the ordered `Memes` files property, separate from the representative page-body still. The [generation policy](../data/meme-review/GENERATION_POLICY.md) governs review and finalization. `pnpm memes:upload-notion --help` describes uploading a finalized export manifest: it requires `NOTION_TOKEN` even for its default read-only dry run, and appends attachments only with `--apply`. A subsequent normal `pnpm content:sync` imports them into the public snapshot; fast mode deliberately retains the previous attachments.

## Media sources

| Property | Rule |
| --- | --- |
| `Name` (title) | The work's common title. Add a disambiguator such as “(2005 film)” only when another source shares the title. |
| `Source Type` | `Movie` or `TV Show`. |
| `Release Date` | First release or premiere date. |
| `Description` | One or two plain sentences about the work's premise, written for this archive. |
| `IMDB`, `Rotten Tomatoes` | Canonical title URLs. |
| `YouTube Trailer` | Best effort. Prefer an official or otherwise authoritative upload; use view count as a secondary signal. |
| `Media Franchises` | Ordered; the first franchise defines a scenario's “More from” collection. |
| `Keywords` | Comma-separated creators, cast, and alternate titles. |
| Page body | Exactly one representative image, used as its preview. Prefer a wide image for consistency; a movie poster is acceptable even when portrait. |

Create a source only with at least one scenario planned for it; a source without scenarios produces an empty page.

## Media franchises

- Put exactly one representative image in the page body for use as its preview.
- Prefer a wide image, ideally roughly 16:9, that clearly represents the franchise.

## Images

These rules apply to every image in the CMS:

- Use an authentic frame from the work. Good sources are frames extracted from a verified clip, Clip.Cafe, and SHOT.CAFE. Look at the image before uploading it.
- Scenario stills: at least 1200 px wide, roughly 16:9 (letterboxed film frames are fine), recognizable, and relatively bright. Avoid frames dominated by darkness or overlaid text, logos, or unrelated graphics.
- Download the chosen image, then upload the local file to Notion. Never hotlink an external image.
- The synchronizer uses the first image block in the page body and ignores the rest. A non-empty image caption becomes the image's alt text, so leave captions empty; put any optional attribution in a separate text block.

## Scenario completion check

Before finishing a scenario, confirm that:

- the title, `Episode`, and `Date` follow the rules above;
- Scene, Why the analogy works, and Caveats each do their own job;
- risk families and safety concepts are relevant, selective, and ordered strongest-first, with a deliberate primary concept;
- a suitable YouTube clip was sought, with a start time when needed;
- one uploaded—not hotlinked—representative still is present; and
- the `featured` tag remains absent unless the project owner explicitly directed otherwise.
