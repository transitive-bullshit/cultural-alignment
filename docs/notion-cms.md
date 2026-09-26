# Notion CMS conventions

Notion is the editorial source of truth for most site content. The application reads the generated repository snapshot, so publish Notion changes with `pnpm content:sync` rather than by editing generated content directly. See the [snapshot and sync contract](../content/README.md) for modes and requirements.

## Canonical databases

- [Cultural Alignment Data](https://app.notion.com/p/transitive-bs/Cultural-Alignment-Data-3c6edb27f124801f8c10edc3c80b4e10?source=copy_link) — root page
- [Scenarios](https://app.notion.com/p/3c6edb27f12480709d6dca256d247c80) — primary content table
- [Media Sources](https://app.notion.com/p/3caedb27f124804d9004c7b1b3057002)
- [Media Franchises](https://app.notion.com/p/3cdedb27f12480c3850fdadca165c684)
- [AI Risk Families](https://app.notion.com/p/3caedb27f124809684c3ef0a4e694c4c)
- [AI Safety Concepts](https://app.notion.com/p/3caedb27f124800a85cee51e4d74c596)

## Scenarios

Treat Scenarios as the project's most important content table.

- Keep `Example`, the scenario name, concise. Target 30–40 characters or fewer.
- Set `Episode` for TV scenarios. Leave it blank for movies.
- Relate every scenario to the most relevant existing AI risk families and AI safety concepts. Consider the full taxonomy, then keep only meaningful associations.
- Order both relation fields from strongest and most specific match to weakest match.
- Most scenarios should have one or two AI risk families.
- Every scenario must have at least one AI safety concept. Most should have two or three; five is a soft cap.
- Make a best-effort attempt to add a `YouTube Clip`. Prefer a clip of the exact scene from an authoritative source or a well-viewed upload. Source authority and view count are signals, not hard requirements. Leave the field blank if no suitable clip exists.
- Use the scene itself: exclude parodies, livestreams, reactions, and videos with commentary over the scene.
- Leave the `featured` value out of `Tags` on new scenarios unless directed by the project owner. That tag controls homepage selection; the snapshot's legacy `featured` boolean is a separate fixture flag.
- Put exactly one representative still image in the page body. Prefer a recognizable, relatively bright frame at least 1200 px wide with a roughly 16:9 aspect ratio. Avoid images dominated by darkness or overlaid text, logos, or unrelated graphics.

### Meme attachments

Scenario memes belong in the ordered `Memes` files property, separate from the representative page-body still. The [generation policy](../data/meme-review/GENERATION_POLICY.md) governs review and finalization. `pnpm memes:upload-notion --help` describes uploading a finalized export manifest: it requires `NOTION_TOKEN` even for its default read-only dry run, and appends attachments only with `--apply`. A subsequent normal `pnpm content:sync` imports them into the public snapshot; fast mode deliberately retains the previous attachments.

## Media sources

- Make a best-effort attempt to add a `YouTube Trailer`. Prefer an official or otherwise authoritative upload; use view count as a secondary quality signal.
- Put exactly one representative image in the page body for use as its preview. Prefer a wide image for consistency. A movie poster is acceptable even when it is portrait-oriented.

## Media franchises

- Put exactly one representative image in the page body for use as its preview.
- Prefer a wide image, ideally roughly 16:9, that clearly represents the franchise.

## Images

These rules apply to every image in the CMS:

- Download the chosen image, then upload the local file to Notion. Never hotlink an external image.
- Prefer high-resolution, recognizable, clean source material.
- Attribution may be added to the page when useful, but it is optional.

## Taxonomy guardrail

AI Risk Families and AI Safety Concepts are controlled vocabularies. Reuse existing entries during normal scenario work. Create a new family or concept only when explicitly asked.

## Scenario completion check

Before finishing a scenario, confirm that:

- the name and movie/TV episode fields follow the rules above;
- risk families and safety concepts are relevant, selective, and ordered strongest-first;
- at least one safety concept is present;
- a suitable YouTube clip was sought;
- one uploaded—not hotlinked—representative still is present; and
- the `featured` tag remains absent unless the project owner explicitly directed otherwise.
