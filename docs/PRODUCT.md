# Product

## Platform

web

## Stack

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Three.js/WebGL, Vercel. No application database.

## Users

The primary visitor is culture-literate and already uses AI, but cannot yet define concepts such as Goodhart's law. They should recognize a familiar film or television scene, become curious about its connection to AI, and explore from there. Technical AI early adopters who appreciate science fiction and strong design craft are an important secondary audience.

## Product Purpose

Create an independent, open-source exploratory website that makes AI safety, risk, and alignment concepts more accessible through familiar pop-culture analogies. The experience is the leading product value; learning is its payoff. Success is ultimately the creator being proud of the resulting artifact, not traffic or external attention.

## Positioning

The project treats popular stories as a shared simulation library for unfamiliar AI problems. It accepts any useful cultural analogy, including scenes that do not depict literal AI. Each mapping is presented as an authored analogy rather than evidence or prediction, with an explanation of why it works and where it breaks.

## Operating Context

The project is personally curated and published through the creator's public persona and GitHub account. Notion is the editorial source. A one-way synchronization command will use the official Notion API to create a normalized, read-only snapshot containing content and embedded assets for the application build. The source code will use the MIT license and the dataset will use CC0.

## Capabilities and Constraints

- Core resource models: scenario, source, AI risk family, and AI safety concept.
- Recognition-first homepage gallery showing a manually featured subset of scenarios.
- All-scenarios gallery using the same underlying gallery module, with risk-family filtering and release-date sorting.
- Global Command-K/header search across all four resource types.
- Scenario pages present scene media, source identity, explanation, caveats, tags, and a standard YouTube embed inside branded surrounding chrome.
- Risk-family pages are richer editorial destinations. Concept and source pages initially act as functional relational pivots.
- The first visual prototype uses ten hard-coded real scenarios shaped exactly like future synchronized content.
- Desktop is the primary visual target; mobile must remain functional without matching desktop's full density or effects.
- Accessibility, reduced-motion behavior, low-power fallbacks, dark mode, popularity/relevance ranking, response/agency material, and community contribution workflows are post-MVP work.
- The relationship hierarchy after a scenario remains an explicit prototype experiment rather than a preselected rule.

## Brand Commitments

"Cultural Alignment" is a working title only. The public artifact should feel like a distinctive speculative cultural archive: bold, playful, intelligent, authored, visually strange, and interactionally legible. It must not use alien narration, broadcast/transmission framing, investigation framing, forced quizzes, or institutional authority. Photoyoshi's elastic infinite image field is the binding gallery reference. Motion uses elastic exploration, precise selection, and confident dimensional transitions. Interface fiction remains light and visual.

## Evidence on Hand

- A curated Notion database containing 179 complete scenarios across 129 media sources.
- Five AI risk families and 65 currently used AI safety concepts.
- Every scenario includes a scene description, analogy explanation, caveats, release date, source, and taxonomy assignments; 159 include a YouTube clip.
- Scenario stills and clips have been manually reviewed by the creator.
- Separate work will provide consistently branded artwork for all risk families and safety concepts; the MVP may begin with two finished examples and placeholders for the rest.

## Product Principles

1. Familiarity opens the door: recognizable culture precedes technical terminology.
2. Exploration before instruction: visitors discover the learning loop organically.
3. Spectacle must expose content, not obscure it.
4. Analogies remain honest by making both their usefulness and limits visible.
5. A few deeply crafted surfaces outrank broad but shallow completeness during prototyping.

## Accessibility & Inclusion

The MVP is explicitly desktop-first and prioritizes a differentiated visual identity over accessibility parity. Mobile remains usable. Broader keyboard, reduced-motion, assistive-technology, and low-power support is planned after the visual system is established.
