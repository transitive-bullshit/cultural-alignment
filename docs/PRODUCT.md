# Product

Cultural Alignment is an independent, open-source web archive that makes AI safety, risk, and alignment concepts accessible through familiar pop-culture analogies. The experience is the leading product value; learning is its payoff. Success means the creator is proud of the artifact, rather than meeting a traffic or attention target.

## Audience and learning loop

The primary visitor is culture-literate and already uses AI, but cannot yet define concepts such as Goodhart’s law. Technical AI early adopters who appreciate science fiction and design craft are a secondary audience.

The loop is **recognize a scene → open its dossier → understand the analogy and its limits → explore related culture or concepts**. Technical terminology follows recognition. A scene need not depict literal AI: popular stories act as a shared simulation library for unfamiliar problems. Every mapping is an authored analogy, not evidence or prediction.

A scenario therefore needs three distinct pieces: what happens in the scene, why the analogy works, and where it breaks. Familiarity opens the door; honest caveats make the learning useful.

## Current experience

- The homepage introduces the premise over a gallery of scenarios carrying the Notion `featured` tag. `/scenarios` exposes the complete archive and URL-addressable risk-family filters.
- A scenario Dossier combines a still, an optional YouTube clip, source/franchise identity, the authored analysis, taxonomy, optional memes, and onward discovery. Continuation follows its source’s first authored franchise, or the source itself; related scenarios use deterministic taxonomy overlap outside that scope.
- Source, franchise, risk-family, and safety-concept indexes and detail pages provide relational entry points. Global header/Command-K search covers all five resource types locally.
- Public pages include share metadata, social images, a sitemap, and machine-reader entry points. The site is deployed at [cultural-alignment.com](https://cultural-alignment.com), with Vercel Web Analytics included in the app shell.
- Internal meme authoring supports generation, versioned review, finalization, and publication back through Notion. It is a separate authoring workflow, not a public contribution surface.

The [architecture](ARCHITECTURE.md) defines the domain and runtime boundaries; the [design system](DESIGN.md) defines the built interactions. Current content counts come from [the manifest](../content/snapshot/manifest.json), checked by `pnpm content:validate`.

## Editorial and technical intent

The creator personally curates the collection. Notion is the editorial source, and explicit one-way synchronization publishes a versioned snapshot. The public app reads that snapshot without a runtime CMS or application database. Images are delivered from public object storage; their URLs and presentation fields travel with the snapshot. This keeps browsing independent of editorial-service availability and credentials.

The code is MIT licensed and authored structured data is CC0. Third-party imagery, titles, trademarks, and clips are outside that data dedication; see the [snapshot contract and license](../content/README.md).

## Commitments and scope

The public artifact should feel bold, playful, intelligent, authored, visually strange, and easy to explore. The selected direction is a speculative cultural archive with light visual fiction. Alien narration, broadcast/transmission framing, investigation framing, forced quizzes, and institutional authority do not belong to that direction. “Dossier” names the scenario layout, not a detective narrative.

Desktop is the visual craft target. Mobile remains usable with direct touch and lower gallery density. Primary controls retain DOM keyboard paths, reduced motion is respected, and a recognizable no-WebGL fallback exists. Full assistive-technology parity, full mobile visual parity, and a dedicated low-power renderer remain follow-up work.

Popularity ranking, personalization, public submissions/moderation, dark mode, guided learning paths, and response/agency material are outside the current scope. Richer risk-family editorial pages and consistent in-page taxonomy artwork are possible extensions; the existing pivots work without that artwork. The current taxonomy social images are already implemented.

Favor a few deeply crafted surfaces over broad, shallow completeness. Spectacle must expose content, and exploration should invite learning without becoming a conventional educational dashboard. For the reasons behind the selected gallery and Dossier direction, read [MVP decisions](MVP.md).
