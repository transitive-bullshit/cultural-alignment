# Cultural Alignment — MVP Implementation Plan

- Status: local MVP implementation and content expansion complete; repository packaging and deployment follow-ups remain
- Working title: Cultural Alignment
- Audience: Codex implementation agents
- Durable product context: ../PRODUCT.md

This document is an execution history. Sections 1–22 preserve the original staged plan and are non-normative where later creator decisions differ. The dated overrides and completion checklist in section 23 are authoritative; `PRODUCT.md`, `MVP.md`, `DESIGN.md`, `ARCHITECTURE.md`, and `QA.md` describe the shipped system. Do not rerun the feedback gates or restore the removed prototype routes.

## 1. Implementation directive

Build this as an experience-first, desktop-first web artifact. The signature is a recognition-first spatial gallery: visitors should see a familiar film or television scene, become curious about its relationship to AI, enter the scenario, and only then encounter the technical language.

Do not reinterpret the project as:

- a conventional educational landing page;
- a database dashboard;
- a dark terminal-themed AI site;
- an alien, broadcast, transmission, or investigation narrative;
- a quiz or forced reveal flow;
- a comprehensive accessibility or low-power project during this MVP.

The original implementation sequence paused for feedback twice:

1. after full-size static compositions are ready;
2. after the interactive gallery and three scenario-detail variants are deployed.

The creator later pulled synchronization and full expansion into this run after selecting Dossier; section 23 records that override and its completion.

## 2. What the MVP proves

The first MVP must prove two things:

1. A Photoyoshi-like elastic image field can make the archive immediately recognizable, playful, and ownable.
2. A scenario page can carry a cinematic scene, accessible explanation, caveats, and taxonomy without losing the same visual identity.

The implementation checkpoint now uses 25 real scenarios keyed by stable Notion page IDs. These records conform to the final synchronized content contract; they are fixtures, not disposable mock data.

The original plan targeted a Vercel preview, not a public launch. The creator later excluded deployment from this run, so a local production preview and fixed review artifacts served as the approval surface. No analytics or audience-attention goal is part of acceptance.

## 3. Confirmed product and design decisions

### Audience and editorial contract

- Primary visitor: culture-literate, already uses AI, cannot yet define concepts such as Goodhart's law.
- Secondary visitor: technical AI early adopter who values science fiction and excellent design craft.
- Any useful cultural analogy qualifies, including scenes that do not depict literal AI.
- A scenario is an authored analogy, not evidence or prediction.
- Every scenario keeps the existing structure: scene, why the analogy works, and caveats.
- The initial learning loop is implicit: recognize a scene, enter it, discover the concept, then explore outward.
- No provocative-question blur or reveal friction in MVP.

### Visual world

- Speculative cultural archive, without a literal archive narrative.
- Warm pale-industrial ground; charcoal type; one restrained electric accent.
- Bold condensed display face, neutral reading sans, monospace metadata.
- Scenario imagery is category-neutral.
- Risk-family colors appear only in family-specific art or filtered chrome, never as a rainbow of card colors.
- At rest: the projected image field remains visually primary.
- On hover/selection: the exact projected copy becomes vivid, receives proportional corner brackets and a crosshair, and updates the stable lower-left metadata panel.
- Surrounding images can wash toward the paper ground; the selected image becomes vivid.
- Use cover sizing, clipped overflow, and optional focal-point data everywhere.
- Text Scramble is reserved for taxonomy-link entry and deliberate hover/focus.
- Spinning Text is reserved for the dismissible spoiler sticker.
- No constant scanlines, ambient glitching, fake diagnostics, or meaningless technical chatter.

### Motion grammar

- Explore: the field behaves like one elastic surface.
- Select: fast, precise lock-on with brackets and stable metadata.
- Navigate: one confident masked or dimensional transition.
- No card collisions, gravity, independent drift, or physics-engine chaos.
- The WebGL gallery is the signature experience, not an optional decoration.

### MVP navigation

- Homepage: manually featured scenarios, almost no controls, clear route to all scenarios.
- All scenarios: one risk-family filter and release-date ascending/descending sorting.
- Global header and Command-K search spans scenarios, risk families, concepts, and sources.
- Blank secondary pages are never linked from primary navigation.
- Scenario relationship ordering remains an experiment after the working demo; do not invent a permanent rule.

## 4. Release boundaries

### Design Prototype

Required:

- 25 real scenarios;
- one full-screen featured gallery;
- one all-scenarios gallery using the same module;
- three complete scenario-detail directions using identical content;
- minimal header and search shell;
- dismissible spoiler sticker;
- standard YouTube embed inside custom outer chrome;
- intentional missing-video state;
- desktop craft target and functional mobile behavior;
- Vercel preview and two explicit feedback checkpoints.

Not required:

- live or build-time Notion access;
- all 179 scenarios;
- public source, risk-family, or concept pages;
- a finished global search index;
- cinematic wordmark intro;
- full naming resolution.

### First OSS MVP after visual approval

Required:

- only the promoted scenario-detail direction remains;
- rejected prototype implementations are removed;
- the approved 25-scenario featured subset works through production routes;
- homepage and all-scenarios gallery are integrated;
- filter, sorting, navigation, back-state restoration, video states, and spoiler dismissal work;
- search only exposes destinations that actually exist;
- production build, automated checks, visual QA, documentation, MIT license, and CC0 dataset notice are complete.

### Immediate content expansion after the first MVP

- freeze snapshot schema version 1;
- implement the one-way Notion synchronizer;
- commit the complete normalized snapshot and embedded assets;
- load-test the gallery with all 179 scenarios;
- add functional risk-family, concept, and source routes;
- expand global search to all four resource types.

## 5. Dependency map

    Product context and scope freeze
                  |
        App shell + content contract
                  |
        Static composition feedback
                  |
          +-------+-------+
          |               |
      Gallery proof   Detail variants
          |               |
          +-------+-------+
                  |
       Interactive feedback gate
                  |
       Promote one visual direction
                  |
       Integrate 25-scenario MVP
                  |
        QA + Vercel final preview
                  |
       Freeze content schema v1
                  |
       Notion sync + full expansion

Gallery and detail-prototype agents may work in parallel only after the content types, fixtures, provisional tokens, and shared media crop behavior exist.

## 6. Recommended technical architecture

### Stack

- Current stable Next.js App Router, React, and TypeScript.
- Tailwind CSS and shadcn/ui source components.
- Three.js through React Three Fiber for the gallery.
- Motion for DOM transitions and Motion Primitives source components.
- Zod for snapshot validation.
- Vitest for pure-module tests.
- Playwright for browser journeys.
- Vercel previews.
- Official Notion SDK, tsx, and Sharp only in the later synchronization workstream.

Use the repository's package manager if one already exists. For a greenfield scaffold, use pnpm and commit the lockfile.

Do not add a physics engine, post-processing stack, global state library, GSAP, Lenis, a hosted search service, or a runtime CMS.

React Three Fiber is the implementation detail of one deep spatial-gallery module. Its official performance guidance emphasizes draw-call control and instancing only when counts justify it: https://r3f.docs.pmnd.rs/advanced/scaling-performance

### Server/client split

- Pages, content projection, metadata, and static parameter generation remain Server Components.
- Client islands: WebGL gallery, Command-K dialog, spoiler dismissal, YouTube activation, and route-transition coordinator.
- The application reads only committed local content. It does not contact Notion at runtime.
- Generate dynamic routes from local slugs and set dynamic parameters to false.
- Use generated metadata for scenario and resource pages.

### Suggested repository structure (historical sketch)

The shipped project uses the existing root-level scaffold and `scripts/sync.ts`; see `ARCHITECTURE.md` for current ownership rather than copying this planning tree.

    src/
      app/
        layout.tsx
        page.tsx
        scenarios/
          page.tsx
          [slug]/page.tsx
        _lab/
          gallery/page.tsx
          scenario-detail/[slug]/page.tsx
        risk-families/
          page.tsx
          [slug]/page.tsx
        concepts/
          page.tsx
          [slug]/page.tsx
        sources/
          page.tsx
          [slug]/page.tsx

      features/
        spatial-gallery/
          spatial-scenario-gallery.tsx
          gallery-client.tsx
          internal/
            field-controller.ts
            field-layout.ts
            gallery-scene.tsx
            scenario-plane.tsx
            cover-material.ts
            texture-cache.ts
            gallery-tuning.ts
        scenario-detail/
          scenario-detail.tsx
          scenario-media-stage.tsx
          scenario-analysis.tsx
          scenario-taxonomy.tsx
          directions/
            dossier-direction.tsx
            screening-room-direction.tsx
            threshold-direction.tsx
        search/
          global-search.tsx
          search-trigger.tsx
        spoiler/
          spoiler-sticker.tsx
        shell/
          site-header.tsx

      lib/
        content/
          schema.ts
          snapshot.ts
          catalog.ts
          search-documents.ts
        media/
          crop.ts
        routes.ts

    content/
      snapshot/
        manifest.json
        scenarios.json
        sources.json
        risk-families.json
        concepts.json

    public/
      media/
        scenarios/
        taxonomy/
      content/
        search-index.json

    scripts/
      content-validate.ts
      notion-sync.ts

Avoid barrel files. Keep imports explicit so client/server bundle ownership remains obvious.

## 7. Domain and snapshot contract

The seed fixture and future Notion export must produce the same versioned contract.

    type ContentSnapshot = {
      schemaVersion: 1
      scenarios: ScenarioRecord[]
      sources: SourceRecord[]
      riskFamilies: RiskFamilyRecord[]
      concepts: ConceptRecord[]
    }

    type ScenarioRecord = {
      id: string
      slug: string
      title: string
      sourceId: string
      episode?: {
        label: string
        href?: string
      }
      releaseDate: string | null
      featured: boolean
      riskFamilyIds: string[]
      conceptIds: string[]
      image: {
        gallerySrc: string
        detailSrc: string
        width: number
        height: number
        alt: string
        focalPoint?: { x: number; y: number }
      }
      video: {
        provider: "youtube"
        id: string
        startSeconds?: number
      } | null
      scene: string
      whyAnalogyWorks: string
      caveats: string
    }

    type SourceRecord = {
      id: string
      slug: string
      title: string
      kind: "film" | "television" | "unknown"
      description?: string
      links?: { label: string; href: string }[]
    }

    type RiskFamilyRecord = {
      id: string
      slug: string
      title: string
      description: string
      canonicalUrl?: string
      artworkSrc?: string
      accentToken?: string
    }

    type ConceptRecord = {
      id: string
      slug: string
      title: string
      description: string
      canonicalUrls?: string[]
      artworkSrc?: string
    }

Rules:

- relations store stable IDs, never copied display names;
- slugs are stable and unique within each entity type;
- release date has one explicit meaning: media or episode release date;
- all images include dimensions;
- focal point drives both DOM object-position and WebGL cover UVs;
- missing video is a valid state;
- concept taxonomy stays flat;
- the content snapshot validates before any route imports it;
- a second validation pass checks referential integrity and local-file existence.

### Content catalog seam

Routes must not join IDs, create fallbacks, sort, filter, or build relationship lists independently.

Keep one small interface:

    type ScenarioListQuery = {
      featuredOnly?: boolean
      riskFamilySlug?: string
      sort?: "release-desc" | "release-asc"
    }

    type ContentCatalog = {
      listScenarioCards(query?: ScenarioListQuery): readonly GalleryScenario[]
      getScenarioPage(slug: string): ScenarioPage | null
      getSearchDocuments(): readonly SearchDocument[]
      getStaticSlugs(
        kind: "scenario" | "source" | "risk-family" | "concept"
      ): readonly string[]
    }

Add source, family, and concept page queries only when those routes become functional. Return page-specific view models rather than raw records.

There is no runtime CMS adapter. Seed and Notion workflows both write the same local snapshot; the runtime has one source of truth.

## 8. Expanded 25-scenario prototype seed

The original ten approved fixtures remain in the current 25-record prototype subset. The expanded set adds more texture variety and reduces obvious repetition while retaining all five risk families, film and television, positive and negative examples, non-AI analogies, multi-tag stress cases, and one missing-video state.

1. Keep Summer Safe — Rick and Morty
2. Lacie Games Her Rating — Black Mirror
3. Life Aboard the Axiom — WALL-E
4. GPS into the Lake — The Office
5. Ava Games the Test — Ex Machina
6. HAL Resists Disconnection — 2001: A Space Odyssey
7. The Raptors Test the Fences — Jurassic Park
8. Order 66 — Star Wars
9. T-800 Accepts Shutdown — Terminator 2: Judgment Day
10. Pied Piper's Self-Sabotage — Silicon Valley
11. Bender Resists Reset — Futurama
12. Mickey's Runaway Brooms — Fantasia
13. Ultron Peace in our Time — Avengers: Age of Ultron
14. AUTO Enforces Directive A113 — WALL-E
15. VIKI Protects Humanity — I Robot
16. WOPR Plays for Real — WarGames
17. Skynet Launches Judgment Day — Terminator 2: Judgment Day
18. Murderbot Hides Its Free Will — Murderbot
19. Joan Is Awful — Black Mirror
20. Pluribus Hand Grenade — Pluribus
21. The Yogurt Takes Over — Love Death & Robots
22. Zola's Algorithm — Captain America: The Winter Soldier
23. Protect Cady — M3GAN
24. Miss Minutes Takes Root Control — Loki
25. Balance the Universe — Avengers: Infinity War

Use Lacie Games Her Rating as the shared detail-page stress case because it has a familiar source, video, multiple risk families, five concepts, and enough copy to expose hierarchy problems.

Use Pied Piper's Self-Sabotage to verify the no-video state.

Fixture requirements:

- real copy and media from the Notion collection;
- no placeholder lorem ipsum;
- stable local images;
- at least one unusually wide, tall, or awkward crop;
- deterministic initial gallery position;
- the same fixture is used by all three detail directions.

## 9. Spatial gallery module

### Public interface

    type SpatialScenarioGalleryProps = {
      items: readonly GalleryScenario[]
      mode: "featured" | "browse"
    }

Callers provide content and select the surface preset. They do not configure camera, gaps, damping, shaders, or shear. Those values live in one internal gallery-tuning file and in the preview-only gallery lab.

The module owns:

- wheel, trackpad, pointer-drag, and touch-drag input;
- click-versus-drag discrimination;
- inertial current, target, and velocity state;
- deterministic multi-row layout on one horizontal travel axis;
- continuous horizontal wrapping with overlapping repeats at both viewport edges;
- orthographic camera and renderer lifecycle;
- image texture loading and disposal;
- WebGL cover cropping;
- deformation-aware hover/selection hit testing;
- label/selection projection;
- custom cursor and corner brackets;
- resize behavior;
- route prefetch and navigation;
- cleanup of frame loops, listeners, materials, and textures.

### Rendering approach

- Use one full-viewport canvas and an orthographic camera.
- Use shared segmented plane geometry so velocity can bend the surface.
- Update motion and shader uniforms through refs inside the render loop; never set React state each frame.
- Use a time-step-independent damping function so 60 Hz and 120 Hz displays feel similar.
- Use a custom material:
  - vertex stage: position-driven edge curl, taper, and shallow cylindrical bow, with the center field left planar;
  - fragment stage: cover UV calculation, paper wash/desaturation, selected-image vividness, and optional bracket marks.
- Attach a non-passive wheel listener only to the gallery surface, not the global window.
- Prevent activation when pointer displacement exceeds the click threshold.
- Prefetch a scenario route after stable hover, not on every pointer crossing.
- Dynamically import the gallery client and show a designed paper loading state before initialization.

### Texture strategy

For the 25-scenario prototype, preload all 25.

Before expanding to 179:

- keep only visible and near-visible textures resident;
- use a small plane/texture pool;
- resize assets to their maximum useful display dimensions;
- cap device pixel ratio;
- verify stable texture and draw-call counts across navigation cycles.

The performance risk is decoding and retaining 179 images, not merely having 179 records.

### Shared crop module

Implement crop behavior once:

    type MediaCrop = {
      sourceWidth: number
      sourceHeight: number
      frameWidth: number
      frameHeight: number
      focalPoint?: { x: number; y: number }
    }

    getObjectPosition(crop)
    getCoverUvTransform(crop)

Test portrait, landscape, ultrawide, centered, and off-center focal points. Gallery and detail views must show materially consistent crops.

### Gallery lab

The preview-only lab may expose:

- card scale and density;
- horizontal card rhythm and fixed row gaps;
- input gain;
- velocity damping;
- maximum velocity;
- shear and bow intensity;
- settle response;
- peripheral wash;
- selection emphasis;
- cursor and bracket scale.

Use a small local panel or Leva only inside the lab bundle. Approved values are copied into gallery-tuning.ts; the control panel never ships.

## 10. Design-system implementation

### Tokens

Start with semantic roles, not finalized raw colors:

- background/paper;
- foreground/ink;
- muted paper and muted ink;
- one electric accent;
- dark media-stage surface;
- one optional token per risk family, never shown simultaneously without purpose.

Keep all custom variables in the project's single global Tailwind CSS file. Do not create parallel theme files.

### Typography

- Display: bold condensed grotesk.
- Reading: neutral sans with comfortable long-form measures.
- Metadata: monospace.
- Select the actual typefaces during the composition feedback gate.
- Text Scramble runs on taxonomy-link entry and deliberate hover/focus; it is not ambient body-copy decoration.
- Spinning spoiler text uses a slow, steady rotation; provisional full rotation 10–14 seconds.

Motion Primitives references:

- https://motion-primitives.com/docs/text-scramble
- https://motion-primitives.com/docs/spinning-text

Install their source components, inspect them, and adapt them locally. Do not treat them as opaque runtime widgets.

### shadcn usage

Use shadcn for behavior-heavy primitives, not expressive page composition:

- Command inside Dialog for global search;
- ToggleGroup for All plus five risk-family values;
- ToggleGroup or compact Select for newest/oldest release date;
- Button, Badge, Separator, Skeleton, and Dialog where behavior is already solved.

After scaffold, run the shadcn project-info command and inspect each added source file. Command items must be grouped; dialogs must retain titles even when visually hidden.

Command reference: https://ui.shadcn.com/docs/components/base/command

### Spoiler sticker

- Appears on the homepage and scenario Dossier until dismissed.
- Uses circular spinning text and a clear dismiss target.
- Stores one versioned local-storage key, for example cultural-alignment:spoiler:v1.
- Must not dominate the gallery or block exploration.

## 11. Scenario-detail prototype

Build three separate compositions, not one production component with a variant prop.

All three receive the same ScenarioPage view model and can share genuinely invariant leaf elements:

- media frame;
- source identity;
- scene content;
- why-the-analogy content;
- caveats;
- taxonomy links;
- YouTube shell;
- missing-video state.

### Direction A — Dossier

- Pale editorial archive.
- Opening viewport shares space between a large media plate, source identity, title, and the beginning of analysis.
- Best reading clarity and flexibility.
- Honest cost: least cinematic.

### Direction B — Screening Room

- Dark, near-full-viewport media stage.
- Sparse source/title treatment.
- Explanation begins below the fold.
- Best recognition and drama.
- Honest cost: delays comprehension.

### Direction C — Threshold

- Dark media stage physically gives way to a pale editorial surface.
- A caption or metadata rail bridges both modes.
- Best potential balance and strongest match to the agreed hybrid.
- Honest cost: most choreography and responsive complexity.

The directions must differ in silhouette, information sequence, media dominance, and scroll behavior. Color swaps do not count.

### Video behavior (final selected system)

- Render the local still first.
- On activation, mount a YouTube iframe with native chrome disabled inside the branded media plate.
- Keep the player instance mounted when returning to the still, reset playback to the configured clip start, and expose branded play/pause, progress, seeking, and return-to-still controls.
- Missing video uses a deliberately composed media plate, not an empty box.

### Preview picker

- Full-size rendering of one direction at a time.
- Labeled switcher and keys 1, 2, and 3.
- Desktop and mobile widths.
- Identical content for every direction.
- Preview-only route marked noindex.
- No production variant prop, feature flag, or conditional class forest.

## 12. Prototype and feedback phase

### P0 — Freeze the brief and fixtures

Deliver:

- PRODUCT.md;
- ten validated fixture scenarios;
- normalized related resources;
- stable local media;
- fixed 1440×900 and 390×844 review viewports;
- deterministic layout seed;
- one long-copy state, one missing-video state, and one difficult crop.

Acceptance:

- all records validate;
- all relations and slugs resolve;
- no secret or network access is required;
- fixture shape exactly matches the future generated snapshot.

### P1 — Full-size static compositions

Create:

- one desktop and one mobile gallery composition;
- desktop and mobile compositions for Dossier, Screening Room, and Threshold;
- a one-page comparison naming the axis, strength, and honest cost of each direction;
- a short storyboard for explore, select, and navigate motion.

Use real scenario stills and production-intent typography.

#### Feedback Gate A — composition approval

Stop and present each composition full-size.

Ask the creator to approve or correct:

- gallery density and card scale;
- image wash versus selected vividness;
- amount of archive chrome;
- provisional palette and type pairing;
- whether all three detail directions are sufficiently distinct;
- any element that feels like generic AI design or archive cosplay.

Allow one focused composition revision. Do not merge all directions into a compromise.

### P2 — Interactive gallery proof

Build:

- wheel/trackpad movement;
- touch drag;
- velocity-driven shear and perspective;
- damped settling;
- hover/proximity color restore;
- title reveal;
- lock-on brackets;
- stable metadata;
- click-versus-drag handling;
- transition into a neutral detail shell;
- spinning dismissible spoiler sticker;
- mobile density simplification.

Acceptance:

- recognizable scenes lead before taxonomy;
- fast motion deforms the field without destroying image legibility;
- the field settles confidently;
- reversing direction never sticks;
- click targets match transformed cards;
- drag release never accidentally opens a card;
- cover crop remains stable;
- 25-card interaction is smooth on the primary review desktop;
- mobile requires no hover.

### P3 — Interactive detail picker

Build all three complete directions with:

- media/source identity;
- title;
- scene;
- why the analogy works;
- caveats;
- risk families and concepts;
- standard YouTube state;
- missing-video state;
- text scramble only on relevant metadata changes;
- coherent desktop and mobile layouts.

Acceptance:

- each direction remains meaningfully different;
- every direction is console-clean;
- paragraph measures and hierarchy support real reading;
- long content and multiple tags do not break layouts;
- mobile has no horizontal overflow.

#### Feedback Gate B — interactive selection

Deploy one stable Vercel preview containing:

- interactive gallery lab;
- detail picker;
- direct links to each direction;
- fixed-size screenshots;
- short recordings of slow motion, fast shear, reversal, selection, mobile drag, and the opening scroll of each detail page.

Collect explicit decisions:

1. approved card density and scale;
2. approved shear, inertia, and settle feel;
3. approved idle/selected image treatment;
4. approved palette and type roles;
5. selected detail direction by name;
6. two or three qualities from the winner that must survive integration;
7. any final correction required before promotion.

If no direction wins, create one new riff around the strongest governing axis. Do not retain and combine all rejected code.

### P4 — Promote the winner

After explicit approval:

1. promote or reimplement the winner at /scenarios/[slug];
2. connect the gallery selection transition to that composition;
3. restore gallery position and active item on browser Back;
4. delete the picker, rejected direction files, prototype-only CSS, query parameters, and temporary transition shell;
5. remove unused tokens and dependencies;
6. search the repository for rejected direction names;
7. keep only approved screenshots and a concise design-decision note.

Acceptance:

- production has no visual-variant switch;
- no rejected code remains behind flags;
- all 25 scenarios use one production detail route;
- the gallery and detail page feel like one authored system;
- lint, typecheck, unit tests, browser tests, and production build pass.

## 13. Core MVP integration

### Homepage

- Full-viewport featured gallery.
- Working title and one sharp sentence, visually subordinate to imagery.
- Minimal header.
- Search trigger.
- Explore-all route.
- Spoiler sticker.
- No filter controls.

### All scenarios

- Same SpatialScenarioGallery module in browse mode.
- All plus five-family single-select filter.
- Newest/oldest release-date sort.
- Filter and sort reflected in URL search parameters.
- No concept/source filter in MVP.

### Scenario page

- Promoted detail direction.
- Media and source dominate the first viewport.
- Analysis is visible without question/reveal friction.
- Caveats remain a first-class section, not footnote styling.
- Risk-family and concept tags are visually subordinate but legible.
- YouTube click-to-play and missing-video states.
- Relationship strip may remain absent until the working demo settles its hierarchy.

### Search

Use shadcn Command inside Dialog.

Prototype:

- shell may be visual-only or search implemented scenario-only;
- do not show results pointing to blank routes.

Expanded MVP:

- generate a small local search document file from the snapshot;
- load it when the palette first opens;
- group results by scenario, risk family, concept, and source;
- exact/prefix title matches rank above keyword matches;
- each document includes kind, title, subtitle, keywords, and href;
- do not add a search library unless approximately 380 local documents demonstrate a real need.

## 14. One-way Notion synchronization

Treat this as an independent post-design agent workstream.

Command:

    pnpm content:sync

Configuration:

- read NOTION_TOKEN from the environment;
- hard-code the Example Scenarios data-source ID in the script: 3c6edb27-f124-80f0-a929-000b1fb786d5;
- use the official Notion SDK and the current supported API version at implementation time;
- never run this command as part of normal development or production runtime.

Responsibilities:

1. paginate through every scenario row;
2. map Notion properties into snapshot schema version 1;
3. fetch the required page blocks for embedded scenario imagery;
4. download images into a generated staging directory;
5. create gallery and detail WebP variants with Sharp;
6. record dimensions and optional focal point;
7. parse YouTube URLs into video IDs and optional start time;
8. derive source, risk-family, and concept records;
9. generate stable slugs, preserving prior slugs by Notion page ID;
10. generate search documents;
11. validate schemas, uniqueness, relations, required fields, and local asset existence;
12. write into a temporary directory;
13. atomically replace committed generated content only after validation succeeds.

Required invariants:

- failed synchronization leaves the prior snapshot untouched;
- unchanged Notion content produces no meaningful diff;
- the site builds offline without NOTION_TOKEN;
- no temporary Notion asset URL remains in committed JSON;
- orphaned relations fail loudly;
- generated asset cleanup is limited to the generated media directory;
- source code remains MIT and exported dataset files remain CC0.

Official Notion data-source reference: https://developers.notion.com/reference/retrieve-a-data-source

## 15. Full content expansion

After synchronization works:

1. import all 179 scenarios;
2. switch gallery texture loading from eager to visible/nearby residency;
3. run the complete gallery against the full snapshot;
4. implement risk-family index and five functional family pivots, with richer editorial treatment deferred;
5. implement concept index and functional concept pivots;
6. implement source index and functional source pivots;
7. add family/concept artwork when a complete branded set is available; do not ship placeholder art;
8. include all four resource types in search;
9. keep source/concept pages out of primary navigation until they contain working content;
10. test the long tail: one-scenario sources, no-video scenarios, long taxonomy labels, and one-to-six concepts.

Risk-family pages may receive the richer treatment first. Concept and source pages are allowed to remain concise relational pivots.

## 16. Automated verification

### Required commands

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm test:e2e
    pnpm build

### Content tests

- snapshot Zod validation;
- unique IDs and slugs;
- every relation resolves;
- every local media file exists;
- media dimensions are positive;
- featured filtering returns the expected seed records;
- release-date sorting is stable for ties and null dates;
- risk-family filtering uses membership semantics;
- every static slug resolves;
- every search result points to a working route.

### Pure gallery tests

- continuous horizontal wrapping in positive and negative directions;
- deterministic layout for the same IDs, seed, and viewport;
- damping remains frame-rate independent within tolerance;
- click-versus-drag threshold behavior;
- cover UV math matches DOM crop behavior;
- filter/sort replacement yields stable layout and selection state.

### Component and integration tests

- metadata scramble triggers once per relevant value change;
- spoiler dismissal persists;
- filter and sort controls reflect URL state;
- media frame handles portrait, landscape, and focal-point crops;
- video activates only after click;
- missing-video state renders intentionally;
- Command-K opens, closes, groups results, handles empty results, and navigates.

### Playwright journeys

- homepage displays all 25 records marked `featured`; the full set of 179 remains available on `/scenarios`;
- a recognizable card opens the correct scenario;
- browser Back restores the gallery position;
- family filter and release sorting update content and URL;
- rapid wheel input followed by selection opens the intended card;
- spoiler sticker stays dismissed after navigation and reload;
- direct scenario URL and refresh work;
- malformed slug reaches the intended 404;
- mobile drag, tap, reading, and video states remain functional.

Do not use exact cross-GPU WebGL screenshots as the primary automated oracle. Test the engine mathematically, keep deterministic review mode, and manually inspect the rendered canvas.

## 17. Visual and motion QA

Review production builds, not development mode.

Desktop craft targets:

- Chromium and Safari;
- 1440×900 and 1920×1080;
- mouse wheel and high-resolution trackpad;
- 1× and Retina density.

Functional targets:

- 390×844 phone;
- one tablet viewport;
- touch drag, tap selection, orientation change, and browser Back.

Inspect:

- wrapping seams and blank edges;
- z-fighting, texture flashes, and stretched images;
- cover crop for unusual aspect ratios;
- labels remaining attached during deformation;
- rendered-card/hit-target alignment throughout deformation;
- hover flicker while moving;
- filter transitions briefly showing excluded cards;
- selected metadata scrambling repeatedly;
- spoiler sticker overwhelming the page;
- page transition double-triggering;
- YouTube chrome covering the iframe;
- gallery/detail/back memory leaks;
- mobile horizontal overflow.

Use one batched desktop/mobile screenshot pass, fix material issues in one batch, and run one confirmation pass. After the chosen direction ships, record the actual visual system in DESIGN.md rather than documenting an untested intention.

## 18. Performance checks

The MVP intentionally favors WebGL craft, but the field still needs to feel immediate.

Safeguards:

- one canvas and renderer;
- shared geometry/materials where practical;
- no allocations in the steady-state frame loop;
- ref/uniform updates instead of React state per frame;
- capped device pixel ratio;
- local, resized textures;
- pause rendering when the document is hidden;
- dispose listeners, materials, geometries, and textures on teardown;
- no eager GPU upload of all 179 full-resolution images.

Profile:

- ordinary exploration for ten seconds;
- aggressive wheel/trackpad input for ten seconds;
- hover and selection while moving;
- repeated gallery/detail/back cycles;
- resize and mobile rotation;
- background/foreground tab transitions;
- filter and sort changes;
- full 179-entry snapshot before content expansion ships.

Desired behavior:

- near-60-fps normal desktop exploration on the primary review machine;
- immediate visual response to input;
- no prolonged input disconnect during aggressive movement;
- stable memory and renderer-info counts after repeated route cycles;
- no duplicate canvases or frame loops;
- initial media transfer measured in a few megabytes, not original-size assets.

Record browser, device, bundle size, media transfer, frame-time observations, texture counts, and accepted compromises in QA.md.

## 19. Risks and containment

### WebGL consumes the project

Containment: isolate a single motion proof, lock the design through feedback, and do not expand content until it feels correct.

### Prototype density works but 179 overload memory

Containment: content count stays independent of resident texture count; implement visible/nearby pooling before full expansion.

### Hit testing diverges from deformation

Containment: derive rendering and hit testing from the same field state and transforms; test rapid reversal and click-after-drag.

### Static designs look great but motion feels gimmicky

Containment: Gate B evaluates slow precision, fast shear, settle, lock-on, and interruption independently.

### Three variants contaminate production

Containment: separate preview routes, identical view model, explicit winner, repository search, and deletion of rejected implementations.

### Canvas-to-detail transition becomes a time sink

Containment: implement only after a detail winner exists. Start with a controlled selected-card exit and page entrance; add shared-image choreography only if it materially improves the result.

### Notion modeling leaks into UI code

Containment: normalize once into snapshot schema; routes consume page view models only.

### Thin resource pages make the site feel database-shaped

Containment: keep them unlinked until useful; family pages receive editorial depth first; source and concept pages remain concise pivots.

### Visual language falls into generic cyberpunk

Containment: warm paper base, meaningful instrumentation only, no ambient glitch, and explicit review question: does this feel like archive cosplay?

### Working title becomes embedded everywhere

Containment: keep site identity in one configuration module and avoid baking title geometry into the core layout before the naming sprint.

## 20. Explicit post-MVP backlog

- final project name and domain;
- cinematic clipped-wordmark intro;
- question-before-reveal scenario interaction;
- related-scenario ranking strategy;
- same-pattern/different-universe guided path;
- how-practitioners-address-the-risk agency content;
- concept taxonomy kinds;
- popularity, relevance, ratings, or personalization;
- community scenario submissions and moderation;
- dark mode;
- full mobile visual parity;
- comprehensive keyboard and assistive-technology support beyond the shipped primary paths;
- a dedicated low-power rendering mode beyond the shipped reduced-motion behavior and no-WebGL fallback;
- full accessibility audit;
- custom player behavior beyond the shipped play/pause, progress, seeking, and return-to-still controls;
- analytics or attention optimization;
- audio design.

## 21. Documentation required at handoff

- PRODUCT.md — durable product truth.
- README.md — thesis, setup, scripts, route map, preview workflow.
- MVP.md — fixed scope, gates, and explicit exclusions.
- ARCHITECTURE.md — content contract, catalog interface, gallery ownership, state restoration, and sync boundary.
- DESIGN.md — written after selection from the built visual system.
- QA.md — commands, browser/device matrix, performance baseline, known issues.
- CONTRIBUTING.md — code contributions welcome; editorial collection remains personally curated.
- LICENSE — MIT.
- CC0 notice for exported dataset files.

Final handoff includes:

- local production-preview instructions;
- selected detail direction and decision note;
- exact verification commands and results;
- screenshots and short motion captures;
- performance observations;
- known limitations;
- recommended follow-ups.

## 22. Codex work packets

### Agent 1 — Foundation and fixtures

Implement only the scaffold and shared foundation.

Deliver:

- Next.js/TypeScript/Tailwind/shadcn shell;
- semantic provisional tokens and font roles;
- snapshot schema and validation;
- the 25 real fixtures and related entities;
- content catalog;
- shared crop module;
- basic routes and deterministic review mode;
- schema, relation, filtering, and sorting tests.

Do not access Notion, build WebGL, style full secondary pages, or invent new taxonomy. Run lint, typecheck, tests, and production build. Report changed files and open decisions.

### Agent 2 — Static composition package

Using the real fixture content and confirmed visual world, create:

- desktop/mobile gallery compositions;
- desktop/mobile Dossier, Screening Room, and Threshold compositions;
- comparison sheet;
- motion storyboard.

Keep the gallery direction singular and the detail structures genuinely different. Stop for Feedback Gate A. Do not write production interaction code before approval.

### Agent 3 — Spatial gallery

After Gate A, implement the shared spatial-gallery module and lab against the existing content view models.

Build:

- horizontally looping, multi-row field;
- wheel/trackpad/touch input;
- velocity deformation;
- inertial settle;
- cover shader;
- hover/selection;
- brackets/cursor/metadata;
- click-versus-drag handling;
- featured/browse presets;
- filter and sort integration;
- deterministic engine tests;
- production performance notes.

Do not style scenario-detail pages or touch Notion.

### Agent 4 — Detail variants

After Gate A, implement the three complete detail directions behind the preview picker.

Use identical content and shared invariant leaf modules. Include video, missing-video, long-copy, multi-tag, text-scramble, and mobile states. Do not create a permanent production variant interface. Provide screenshots and tradeoff notes.

### Agent 5 — Integration

Wait for Feedback Gate B.

Promote the selected direction, remove the rejected implementations, connect gallery navigation and Back restoration, finish the 25-scenario production paths, search shell, spoiler behavior, and route metadata. Verify only working destinations are discoverable.

### Agent 6 — QA and finish review

Audit the production preview against MVP.md, DESIGN.md, and QA.md.

Exercise:

- desktop and functional-mobile matrix;
- rapid motion, reversal, and selection;
- filters, sorting, search, and browser Back;
- YouTube and missing-video states;
- direct routes, refresh, and 404 behavior;
- renderer lifecycle, texture count, frame time, and memory.

Fix only clearly scoped defects in one batch, recapture, and run one confirmation pass.

### Agent 7 — Notion synchronization

Begin only after snapshot schema version 1 is frozen.

Implement the official-API, hard-coded-data-source, one-way sync command. It must generate deterministic committed JSON, Markdown-compatible text, search documents, and embedded image assets; validate atomically; and leave the app completely independent of Notion at build and runtime.

### Agent 8 — Full content expansion

Load-test and integrate the complete snapshot. Add minimal functional family, concept, and source routes and cross-resource search. Keep the promoted visual system unchanged and do not reopen gallery/detail concept work without explicit feedback.

## 23. Completion checklist for the first MVP

Pulled-forward workstream update — 2026-08-27: the creator explicitly requested that Notion synchronization begin before Gate B, overriding the original deferred sequence in sections 1, 4, 5, and 14.

Preview exception — 2026-08-27: the creator explicitly excluded deployment from this run. A local production preview plus saved fixed-size captures and a transition recording substitute for the Gate B Vercel preview; deployment remains a manual creator step.

Gate B interaction revision — 2026-08-27: creator review replaced the free two-axis field with a horizontally scrolling, multi-row ribbon. Vertical wheel input maps to horizontal travel; only incoming and outgoing edge cards deform; repeated edge copies must prevent visible wrap popping. The same review requested a fully clickable spoiler warning, grid-governed detail-title wrapping, and direct media play/pause with a contextual cursor.

Desktop surface refinement — 2026-08-28: creator review rejected the ribbon-like fast-scroll feel and requested a denser projected surface. This pass is desktop-only: deformation must be gated by absolute velocity and opposing screen position, recycling must happen beyond complete card exit with duplicate scenarios allowed on both edges, the renderer must remain responsive under rapid wheel input, and the canvas must reserve explicit header and lower-chrome safe areas.

Instance-selection and entrance-motion refinement — 2026-08-28: creator review approved the core projected-surface feel and requested exact-copy hover emphasis, cyclic rather than mirrored scenario mapping, reliable blank-space deselection, a short first-entry coast, removal of canvas keyboard focus, and consistent clip terminology. Pointer picking must use the same live deformation model as the shader so visual and interactive card bounds stay synchronized during motion.

Gallery-detail polish and fixture expansion — 2026-08-28: creator review requested a faster hover arrival with the existing slower release, proportional selected corners, a stronger explanatory entrance shear, foreground-control suppression for the floating media label, and a sequential Dossier reading hierarchy. The official Notion sync was rerun after source edits and the stable page-ID prototype subset expanded from 10 to 25 records.

Gate B media and input refinement — 2026-08-28: creator review requested an accessible themed video timeline with keyboard seeking, still-only scene labeling, vertically aligned source metadata with movie-aware episode suppression, section 02 as the sole prominent reading panel, viewport-centered desktop header copy, more forgiving exact-instance gallery hit targets, native horizontal browser swipe preservation, and a faster explanatory entrance coast.

Continuation authorization — 2026-08-28: the creator selected Dossier, approved the refined spatial-gallery direction, and explicitly authorized work to continue past any remaining feedback gates while deployment stays manual.

- [x] Official Notion database and data-source IDs are verified with API version 2026-03-11.
- [x] All 179 live scenarios normalize into 129 sources, 5 risk families, and 65 used concepts.
- [x] All 179 scenarios have deterministic local gallery/detail media (358 generated assets total).
- [x] The snapshot, uniqueness constraints, relations, filtering, sorting, and local assets validate.
- [x] Two consecutive established-state syncs produce identical JSON and media hashes.
- [x] Sync reuse is guarded by strict generated paths, pipeline/output hashes, stable page-ID fixtures, and preserved slug tombstones.
- [x] Authored rich text exports deterministically as Markdown-compatible text; missing image blocks use the row's curated YouTube thumbnail when available.
- [x] PRODUCT.md exists and matches the confirmed brief.
- [x] Twenty-five real fixture scenarios validate against snapshot schema version 1; the original ten remain included.
- [x] The Gate A package includes desktop/mobile gallery compositions and all three detail directions with identical Lacie content.
- [x] The Gate A comparison sheet and explore/select/navigate motion storyboard were reviewed under `/prototypes`; the approved evidence remains archived under `docs/outputs/gate-b` after route removal.
- [x] The prototype picker, local stills, YouTube activation, and intentional no-video state are browser-verified at 1440×900 and 390×844.
- [x] Gallery and detail compositions passed Feedback Gate A. Creator approval on 2026-08-27 locked the Dossier direction, gallery density/card scale, image treatment, archive chrome, warm paper/charcoal palette, Barlow Condensed/Geist pairing, and electric-orange accent. Gate B corrections: remove the prototype-index fiction, rebalance the title and opening whitespace, present section 02 as one continuous argument, make source identity actionable while keeping episode/year inert, add restrained scramble/stagger behavior, and remove the comparison page's split background.
- [x] The refreshed Gate B review package contains the interactive 25-card horizontal gallery, corrected selected Dossier, working source pivot, current desktop/mobile captures, spoiler/media interaction captures, and gallery-to-Dossier transition evidence under `docs/outputs/gate-b`.
- [x] Horizontal wheel/trackpad travel, pointer/touch drag, immediate reversal, damping, center selection, click-versus-drag handling, mobile first-tap selection, WebGL fallback, reduced motion, and the DOM media-transition proxy are implemented.
- [x] The Dossier title and opening rhythm are rebalanced; its H1 width is grid-owned with complete-word wrapping and centered mobile alignment; section 02 is continuous; source identity is actionable while episode/year are inert; taxonomy scramble starts on viewport entry and repeats on hover/focus.
- [x] Gallery travel is horizontal-only and vertical wheel input maps horizontally.
- [x] Stable offscreen surface recycling eliminates visible edge popping, including viewports wide enough to show one scenario at both edges.
- [x] The Dossier H1 has no character-based width cap or forced mid-word breaking; its layout column governs balanced wrapping on desktop and mobile.
- [x] The spoiler warning dismisses from its full circular surface with an accessible hover/focus fill and explicit warning text.
- [x] The detail media supports click-anywhere YouTube play/pause while retaining the Play clip control and contextual orange cursor label; all player states consistently use clip terminology.
- [x] The Gate B correction pass passes formatting, lint, typecheck, 33 unit tests, content validation, desktop/mobile browser QA, and the 145-page production build.
- [x] The desktop gallery uses a dense five-row projected-surface layout with absolute-speed screen-space shear that settles completely level at rest.
- [x] Surface recycling remains outside the visible exit boundary, permits simultaneous duplicate scenarios, and shows no left/right pop during rapid travel or reversal.
- [x] Desktop canvas safe areas keep all selected brackets clear of the in-flow header and lower metadata chrome.
- [x] The desktop surface refinement passes 41 unit tests, rapid-scroll browser QA at 1440×900 and 2560×900, lint, typecheck, content validation, and the 145-page production build without reopening visual mobile QA.
- [x] Cyclic modular mapping prevents matching horizontal neighbors, including across the recycling seam, without hiding simultaneous nonadjacent copies.
- [x] Hover emphasis is keyed to one projected slot rather than scenario identity; all repeated copies stay dim and blank space clears vividness and brackets.
- [x] Deformation-aware pointer picking follows the rendered card bounds each frame, preventing stale or unrelated hover targets while the field moves and settles.
- [x] The gallery runs one short visibility-triggered entrance coast, cancels it on interaction, and remains stationary under reduced motion.
- [x] The WebGL surface is outside the tab order with no disconnected arrow-key selection state; the selected scenario link remains keyboard-accessible.
- [x] The instance-selection refinement passes formatting, lint, type generation, typecheck, 47 unit tests, desktop browser QA at rest and peak warp, content validation, and the 145-page production build without reopening visual mobile QA.
- [x] The gallery hover arrives in roughly 130–170 ms while its existing 260–290 ms release remains intact; selected corners scale proportionally and are smaller at the current desktop card size.
- [x] The one-time entrance travels 2.25 columns, exposes visible shader deformation, settles in roughly 1.1 seconds, cancels on interaction, and remains stationary under reduced motion.
- [x] The Dossier opening contains media plus title identity with H1 before enlarged source metadata; Scene, Why this analogy works, and Where the analogy breaks now form one sequential reading section.
- [x] The floating media label hides over Play, Pause, Resume, and Return-to-still controls and restores after pointer exit without changing whole-frame playback.
- [x] The official Notion sync refreshed all 179 scenarios and 358 local media assets; 25 unique stable page IDs are featured, and two established-state runs produced byte-identical snapshot and media hashes.
- [x] The gallery-detail polish pass passes formatting, lint, type generation, typecheck, 50 unit tests, desktop browser QA, content validation, and the 160-page production build without reopening visual mobile QA.
- [x] Activated video states hide the scene-still label and expose an accessible progress scrubber plus focused ArrowLeft/ArrowRight seeking without remounting the YouTube player.
- [x] Dossier metadata is a vertical, left-marked list with redundant movie episode rows suppressed; section 02 is the only prominent reading panel and all three sections share one alignment box.
- [x] The desktop Dossier header phrase is centered to the viewport independently of the identity and navigation widths.
- [x] Gallery picking includes nonvisual tolerance around each exact warped instance, vertical wheel input still drives the field, and horizontal-dominant desktop trackpad gestures pass through for browser history navigation.
- [x] The one-time gallery entrance launches 60% faster, reaches roughly 79% deformation, travels 3.6 columns, and remains finite, interruptible, and stationary under reduced motion.
- [x] The media/input refinement passes formatting, lint, type generation, typecheck, 63 unit tests, desktop browser QA, content validation, and the 160-page production build; native history swipe awaits a physical trackpad feel-check.
- [x] The production catalog exposes all 179 scenarios, 129 source pivots, 5 risk-family pivots, and 65 concept pivots through static detail URLs, indexes, four-kind search, canonical metadata, robots, and a 383-entry sitemap.
- [x] Full-gallery media admission is center/velocity-prioritized, LRU-evicted, and hard-capped at 64 resident textures; the settled 179-item view requests a 2,775,750-byte near-field subset rather than the complete corpus.
- [x] Final integration fixes isolate history by filter/sort topology, keep the gallery crosshair below portalled search, preserve compact mobile sorting, reveal the active mobile family, and keep long Dossier titles inside the layout-owned column without character caps.
- [x] Interactive gallery and detail picker passed Feedback Gate B through creator approval and the 2026-08-28 continuation authorization.
- [x] One detail direction is explicitly selected: Dossier.
- [x] Rejected variant code and routes are removed.
- [x] Homepage and all-scenarios gallery share one deep gallery module.
- [x] Scenario pages use the promoted visual direction.
- [x] Family filter and release-date sort work through URL-native controls on desktop and mobile.
- [x] Browser Back restores the exact gallery topology, continuous field position, and selected scenario.
- [x] The entire spoiler sticker dismisses by pointer or keyboard and persists without a dismissed-state hydration flash.
- [x] Text Scramble and Spinning Text are used only in their assigned roles.
- [x] Video supports whole-frame play/pause without remounting, retains explicit controls and a stateful cursor, and the no-video state remains intentional.
- [x] Desktop visual QA at 1440×900 and functional-mobile QA at 390×844 are complete in Chrome; the documented physical trackpad check remains a deployment follow-up.
- [x] Format, lint, route type generation, TypeScript, 95 unit tests, 8 browser journeys, content validation, and the 388-page production build pass.
- [ ] The 358 files under `public/media/generated` are included in the repository/deployment artifact; they currently exist locally but are excluded by `.gitignore`.
- [ ] The configured pre-commit hook has an explicit `lint-staged` dependency or is updated not to invoke it.
- [ ] Vercel final preview is stable (intentionally deferred to the creator).
- [x] README, MVP, ARCHITECTURE, DESIGN, QA, CONTRIBUTING, and license files are complete.
- [x] No post-MVP feature appears as unfinished public UI.

The implementation, Notion synchronization, and full content expansion are complete locally. Generated-media packaging, pre-commit-hook repair, deployment, and the remaining physical macOS trackpad feel-check are follow-ups.
