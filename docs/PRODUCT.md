# Product

## Platform

web

## Stack

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and Three.js/WebGL, with Vercel as the intended hosting target. No application database.

## Users

The primary visitor is culture-literate and already uses AI, but cannot yet define concepts such as Goodhart's law. They should recognize a familiar film or television scene, become curious about its connection to AI, and explore from there. Technical AI early adopters who appreciate science fiction and strong design craft are an important secondary audience.

## Product Purpose

Create an independent, open-source exploratory website that makes AI safety, risk, and alignment concepts more accessible through familiar pop-culture analogies. The experience is the leading product value; learning is its payoff. Success is ultimately the creator being proud of the resulting artifact, not traffic or external attention.

## Positioning

The project treats popular stories as a shared simulation library for unfamiliar AI problems. It accepts any useful cultural analogy, including scenes that do not depict literal AI. Each mapping is presented as an authored analogy rather than evidence or prediction, with an explanation of why it works and where it breaks.

## Operating Context

The project is personally curated and published through the creator's public persona and GitHub account. Notion is the editorial source. An explicit one-way synchronization command uses the official Notion API and `NOTION_TOKEN`—regardless of the source's public visibility—to create a normalized, read-only snapshot containing content and local image assets. The application builds and runs exclusively from that snapshot.

The source code uses the MIT license. The authored structured dataset uses CC0; that dedication does not cover third-party film and television imagery, titles, trademarks, or linked clips.

## Capabilities and Constraints

- Core resource models: scenario, source, AI risk family, and AI safety concept.
- Recognition-first homepage gallery showing 25 scenarios selected by stable Notion page ID.
- All-scenarios gallery using the same underlying gallery module, with risk-family filtering.
- Global Command-K/header search across all four resource types.
- Scenario pages present scene media, source identity, explanation, caveats, taxonomy, spoiler handling, more from the same source, and best-effort related scenarios through the Dossier layout. Clips use a YouTube iframe inside branded play/pause, progress, seeking, and return-to-still controls.
- Source, risk-family, and concept pages act as functional relational pivots. Risk families are the first candidates for richer editorial treatment later.
- The committed snapshot contains the full collection; content synchronization is an editorial operation, never a request-time dependency.
- Desktop is the primary visual craft target. Mobile remains functional with a lower-density direct-touch version of the same experience.
- Targeted keyboard paths, reduced-motion behavior, and a recognizable no-WebGL fallback are included. Comprehensive assistive-technology parity and a dedicated low-power renderer remain post-MVP work.
- Scenario dossiers link outward to their source, risk families, and concepts. Related scenarios use a deliberately simple, deterministic taxonomy-overlap heuristic rather than a permanent editorial ranking.
- Dark mode, popularity ranking, response/agency material, and community contribution workflows remain post-MVP work.

## Brand Commitments

"Cultural Alignment" is a working title only. The public artifact should feel like a distinctive speculative cultural archive: bold, playful, intelligent, authored, visually strange, and interactionally legible. It must not use alien narration, broadcast/transmission framing, investigation framing, forced quizzes, or institutional authority. Photoyoshi's elastic infinite image field is the binding gallery reference, adapted to a one-dimensional horizontal projected surface. Motion uses elastic exploration, precise selection, and confident dimensional transitions. Interface fiction remains light and visual.

## Current Content Baseline

- A curated Notion database containing 179 complete scenarios across 129 media sources.
- Five AI risk families and 65 currently used AI safety concepts.
- Every scenario includes a scene description, analogy explanation, caveats, release date, source, and taxonomy assignments; 159 include a YouTube clip.
- The synchronized snapshot contains 358 local gallery/detail image assets; 25 scenarios are marked as featured.
- Scenario stills and clips were manually reviewed by the creator.
- Consistently branded risk-family and concept artwork remains follow-up work. The current resource pivots are complete without placeholder artwork.

## Product Principles

1. Familiarity opens the door: recognizable culture precedes technical terminology.
2. Exploration before instruction: visitors discover the learning loop organically.
3. Spectacle must expose content, not obscure it.
4. Analogies remain honest by making both their usefulness and limits visible.
5. A few deeply crafted surfaces outrank broad but shallow completeness during prototyping.

## Accessibility & Inclusion

The MVP is explicitly desktop-first and prioritizes a differentiated visual identity over full accessibility parity. Mobile remains usable; primary links and controls retain DOM keyboard paths; reduced motion disables the automatic gallery coast; video seeking and spoiler dismissal are keyboard operable; and a recognizable non-WebGL fallback exists. A comprehensive assistive-technology audit and a dedicated low-power experience remain follow-up work.
