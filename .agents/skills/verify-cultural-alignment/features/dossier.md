# Scenario dossier

A scenario page (`/scenarios/<slug>`) opens with a media plate, the title, source metadata, and the primary AI safety concept, then the analysis, taxonomy, memes, and discovery. Visitors play the YouTube clip on the plate, acknowledge a desktop spoiler warning, read concept descriptions on hover or focus, and copy the page link or the dossier as Markdown.

## Sub-features

- `dossier-opening` shows the title and links the scenario's first concept as its primary concept.
- `dossier-spoiler` shows a desktop spoiler warning that one click acknowledges for later visits; phones hide it.
- `dossier-clip` plays and pauses the YouTube clip from the media plate.
- `dossier-still` shows the composed still state for scenarios without video.
- `dossier-taxonomy` reveals a description card for risk-family and concept links.
- `dossier-copy-link` copies the current URL.
- `dossier-markdown` copies the dossier as Markdown.
- `dossier-memes` opens attached memes in a lightbox.

## How to get to it (user POV)

- Visit `/scenarios/<slug>` directly or from a shared link; this journey uses that entry.
- Open a frame from either gallery, a scenario result in search, or a scenario card on a resource page; the gallery, search, and resources journeys drive those entries.

## Driving it with verify.ts

Preconditions:

- `verify.ts doctor --run=<id>` passes, and the instance URL uses `localhost`.
- The snapshot has a scenario with video, memes, concepts, and risk families, and another without video.
- The context grants `clipboard-read` and `clipboard-write`.
- Network access to YouTube and the media origin.

- **Opening.** Load the scenario and wait for `[data-search-ready="true"]`. The H1 contains the title, and `[data-scenario-primary-concept]` names the scenario's first concept slug and links `/concepts/<slug>`.
- **Spoiler (desktop).** `[data-spoiler-warning]` has `data-state="warning"`. Click it; it passes through `noted` and disappears, and storage holds `cultural-alignment:spoiler-warning:v2`. After a reload it stays absent. On mobile it is hidden.
- **Clip.** Click `[data-scenario-still]`. `[data-scenario-media]` loses `data-showing-still`, `[data-scenario-media-progress]` becomes enabled, and its value advances. Hover the plate and click `[data-scenario-media-playback-control]`; `data-playing` is removed.
- **Taxonomy.** Hover `[data-scenario-taxonomy-item^="concept:"] [data-cursor-card-trigger]` (desktop) or focus its link (mobile). `[data-cursor-card-content]` appears with `role="tooltip"`.
- **Copy link.** Click `[data-copy-page-link]`. It reaches `data-state="success"` and the clipboard equals the page URL.
- **Copy Markdown.** Click `[data-copy-scenario-markdown]`. It reaches `data-state="success"`; the clipboard starts with `# <title>` and contains an absolute image and a YouTube link.
- **Memes.** Click the first `[data-scenario-meme-trigger]`. `[data-scenario-meme-lightbox]` opens with `[data-scenario-meme-image][data-loaded="true"]`, and Escape closes it.
- **Still only.** Load a scenario without video. `[data-scenario-media]` has no `data-interactive`, and `[data-scenario-media-still-label]` reads `Scene still`.
- **Proof.** Run `.agents/skills/verify-cultural-alignment/verify.ts drive .agents/skills/verify-cultural-alignment/journeys/dossier.journey.ts --run=<id>`. Evidence includes the clip progress record, a playing frame, the copied URL and Markdown, and the lightbox.

## Gotchas

- `data-playing` turns on when clicked, before YouTube plays. Only an enabled, advancing progress control proves playback.
- YouTube answers `This video is unavailable` for embeds on an IP-address origin such as `http://127.0.0.1:<port>`. Drive the `localhost` URL that `launch` prints.
- The spoiler warning renders on phones but CSS hides it; assert hidden, not absent.
- Assert the warning's absence after hydration (`[data-search-ready="true"]`); before hydration it is absent for every visitor.
- Absolute URLs in copied Markdown and metadata use the site origin (`http://localhost:3000` for a local build), not the instance port.
- The playback control fades while a clip plays; hover the plate before clicking it.
