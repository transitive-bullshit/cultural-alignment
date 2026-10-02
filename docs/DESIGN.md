# Design system

This records the built and selected Dossier system, not an aspirational theme.

## Visual character

The site is a speculative cultural archive without literal institutional or investigative fiction. Its ground is warm paper, its typography is charcoal, and electric orange is reserved for interaction and orientation. The paper/grid ground remains continuous across the viewport; the rejected split-background treatment must not return. Scene imagery provides the color; taxonomy does not turn the gallery into a category rainbow.

Primary roles:

- Display: Barlow Condensed, heavy and tightly tracked
- Reading: Geist, neutral and comfortable at long measures
- Metadata: Geist Mono, compact uppercase labels
- Ground: pale warm paper and subtle grid/rule lines
- Accent: electric orange for crosshairs, selected brackets, active fills, and focused links

Small orange text (eyebrows, index numbers, “This scene is an example of”) stays in the electric accent. That is an explicit owner preference: do not trade it for a darker or more muted orange to raise contrast. A muted variant was tried and rejected.

## Links

Links that leave the site share one treatment, the global `external-link` class: a muted rule at rest, which an orange-to-pink gradient replaces on hover, keyboard focus, or press by growing out from the middle over 300 ms (instantly under reduced motion). The class goes on the link or the span holding its label, never on the trailing mark. A small orange ↗ marks external links and only external links; in-site links end in → or carry no mark.

## Site shell

Public archive routes use the same header component: a larger Barlow Condensed wordmark on the left, persistent global navigation in the center, and Search on the right. The four primary archive indexes remain directly visible on desktop, while Project discloses About and Privacy; franchises are reached through content links, search, and a cross-link in the media-source index, and Media sources stays active on franchise routes. Desktop destinations use a muted-paper background hover, and the gallery crosshair yields to the browser’s native pointer throughout the navigation surface. At `900px` and below, Search remains visible and a labeled Menu toggle opens the same six destinations in a right-side sheet. Header and footer share one navigation source and one wordmark component; only “Alignment” scrambles once on viewport entry and again on deliberate fine-pointer hover. Reduced-motion visitors receive stable copy, and keyboard focus does not trigger decorative motion. The Command-K palette opens without motion, pinned near the top so its input stays still as results change, and uses highlighted text matches. It shares the archive's surface language: a square ink border with the Project menu's offset shadow, mono uppercase group labels, and a square selected row with a 3px orange bar; results omit a subtitle that only repeats their group. The header nav is 11px and other mono UI labels have a 10px floor; between 901 and 1120px the nav tightens its padding rather than shrinking type. Gallery pages share the header's `clamp(18px, 3vw, 46px)` gutter, and their toolbar, selected-frame panel, and homepage card align to it.

A shared footer closes public non-gallery pages with archive navigation, project and policy links, the public Notion source, and GitHub/X profiles. In-site footer links turn electric orange on hover; external ones (Notion, GitHub, X) use the shared link underline with a trailing ↗, and the social rows carry no logos so their labels start on the rule edge. The not-found page offers an ink “Browse all scenarios” button and a “Search the archive” action that opens the header search.

## Homepage entry

The homepage opens into the Notion-tagged featured scenario gallery. A lightweight paper dialog explains the core idea with the concrete mapping defined in `features/spatial-gallery/gallery-intro-example.ts`, including the example concept's one-sentence definition, while the gallery loads behind it. Explore, Escape, and backdrop dismissal store a versioned acknowledgement, which suppresses the dialog on `/scenarios`. The homepage shows it again on later entries until the explicit close button stores a permanent dismissal for both routes. Dismissal also starts an interruptible gallery inertia burst, with reduced motion respected. Hovering a homepage frame reveals the lower-left analogy—media source, scenario name, and one primary AI safety concept. `/scenarios` presents the complete gallery with risk-family filters and shows the dialog only before any acknowledgement. At 900px and below the filters take their own toolbar row above Size and the count; at 680px and below that row scrolls, fading whichever edge has more chips and revealing the active chip with a whole neighbor beside it, and the phone gallery sits between the toolbar and the touch hint.

## Gallery

The desktop gallery is a density-adjustable projected surface on one horizontal axis. Its 100% default preserves the original five-row composition; the `/scenarios` toolbar offers a restrained 70–200% frame-size control that steps through every fully fitting row count between seven and two while scaling the horizontal and vertical spacing in lockstep. Pointer dragging uses short, interruptible interpolation, including row entrances and exits at density thresholds; keyboard and reduced-motion changes remain immediate. The preference is versioned in local storage and applies to the homepage gallery without exposing the archive-only control there. Vertical wheel movement advances the surface; horizontal-dominant trackpad gestures remain browser-owned. At rest, rows are level. Speed reveals the material: left-edge cards shear upward and right-edge cards shear downward, with deformation increasing toward the edges.

Wrapping is cyclic, not mirrored. The deterministic pattern avoids matching horizontal neighbors, including across its seam. Offscreen copies overlap beyond the viewport so partially visible cards never pop. A scenario may appear twice on a wide screen, but only the exact hovered projection becomes vivid and receives orange brackets; moving into a gap clears emphasis instead of selecting another copy.

Hover arrival is deliberately snappier than release. Selected corner brackets scale with the card and replace the rejected adjacent-plus treatment. A small nonvisual hit halo adds pointer tolerance without changing visible spacing. The one-time entrance coast begins fast enough to expose the opposing edge deformation, then settles; user input interrupts it.

Explicit header and lower-chrome safe areas keep cards and brackets on-screen. On desktop, the lower-left selected-frame panel remains stable and contains the keyboard-accessible scenario action. At `680px` and below the visual panel is removed, its canvas space is reclaimed, and an assistive selected-scenario link preserves keyboard and screen-reader access. Touch guidance explains the two-tap select/open model. The WebGL canvas itself is not focusable. On fine pointers, the gallery uses the orange crosshair cursor throughout.

## Dossier

The opening view pairs a cinematic media plate with a grid-owned title and vertical source metadata. The approved title scale is the current, smaller Dossier setting: `clamp(68px, 7.35vw, 120px)` on desktop and `clamp(55px, 17vw, 78px)` on mobile. It has no character-width cap; its layout column governs balanced, complete-word wrapping. The title precedes a vertical, left-× metadata list: source and franchise links come first, then the episode on its own row, then the year. Episodes appear only for TV sources with a non-empty label; a linked episode opens externally with the shared external-link underline and a trailing ↗, while unlinked episodes and the year are inert.

Above 900px, the source metadata's × markers hang in the existing gutter so its text shares the title's left edge. At narrower widths the markers stay inside the metadata rows to preserve the page margin.

Sections below the opening share its shell: a centered 1600px frame inset by the header's gutter (`clamp(22px, 3vw, 48px)`, or `clamp(18px, 3vw, 46px)` at 820px and below). Memes and discovery span that shell; the reading column is at most 1120px within it, and the taxonomy and Copy as Markdown action sit on the copy sections' inner inset, the section-label edge.

Below the metadata, a ruled block names the scenario's primary (first) AI safety concept with the gallery panel's wording, “This scene is an example of,” followed by the linked short name and its one-sentence description. A visitor arriving from a shared link learns what the scene illustrates before scrolling. On mobile it follows the media plate.

The reading order is fixed: scene, analogy, and caveats. Only the second panel is prominent, while all three reserve identical geometry.

A shared ghost icon button copies the current URL on all detail pages. In the Dossier it sits beside the source metadata below the title; resource pages place it right after the category label above the title. Copy and checkmark icons crossfade with a subtle scale over 160 ms, holding success for 2.5 seconds. Repeated clicks renew the feedback timer; transitions retarget without remounting icons, stale clipboard responses are ignored, and reduced motion keeps only a short fade. Tooltips and a live status describe success or retryable failure.

A quiet Copy as Markdown action closes the reading section after taxonomy. It copies semantic headings, linked metadata, the authored analysis, an absolute Markdown still image, and a timestamped YouTube link when available, then reports short-lived clipboard success or failure.

Risk families and concepts follow the authored analysis. Each taxonomy heading links to its full index, while the individual taxonomy links scramble once as they enter and again on deliberate fine-pointer hover. On the risk-family and concept indexes, deliberate fine-pointer hover scrambles only the hovered record title; descriptions, counts, and layout stay still. A hidden original copy owns the text wrapping and block size, while the scrambled copy renders as a layout-independent overlay. Optional meme attachments follow the reading section in a progressive three-column grid (two at 820px and below, one at 620px and below) with a lightbox and download action. Meme and discovery headings use the resource pages' section-heading scale. Discovery then offers continuation from the first authored franchise, or the same source when no franchise is available, and related scenarios outside that scope with shared taxonomy as context. At wide desktop sizes each discovery section uses three restrained cards; below that breakpoint it shows two. The discovery header follows the same columns, so its action or note sits over the last card column. Both discovery collections use washed grayscale stills until fine-pointer hover or keyboard focus. The same richer card is shared by source, franchise, risk-family, and concept detail pages, where a continuous collection shows the first 12 matching scenarios in a responsive three-, two-, or one-column grid; a full-width “Show all N scenes +” button expands it in place, keeps the chosen sort, and focuses card 13. A collection with one scenario spans the row and lays its card out horizontally above 860px. Cards end in “View scenario →”, and only cards with a summary reserve the taller body, so cards without one carry no empty band. At 620px and below card titles step down to `clamp(32px, 9vw, 36px)`, below the section heading. On concept pages each card adds a muted one-line version of its analogy (the leading sentences of “Why the analogy works,” clamped to three lines) so the page teaches the concept through its examples. Display headings wrap within their layout boxes rather than arbitrary character-width caps. Scrambling is not used for body copy or ambient decoration.

## Resource detail pages

Resource detail pages use two hero layouts, chosen by what a visitor recognizes first.

- **Taxonomy layout** (AI safety concepts and risk families) is text-led. The category label and copy action, the full title, and the definition as a large ink lead paragraph share one leading edge; a facts strip follows (scene count, plus the concept's main risk families, the ones holding at least 40% of its scenes, or the family's concept count). Further reading sits beside the title on desktop and moves below the scenes when stacked, so the scenes follow the definition directly.
- **Media layout** (media sources and franchises) is recognition-led, like the Dossier opening. The poster or key art leads in an ink-framed plate with the media plate's offset shadow: landscape art takes the wider column, portrait posters a column up to 420px. Title, description, a compact facts strip (type, release date, franchise, scene or work counts), and an inline row of external links sit beside it. When stacked, the image comes first; portrait posters narrow to 380px on tablet and 300px on mobile, and landscape art insets 6px from the screen edge on mobile.

Taxonomy titles use a restrained `clamp(55.2px, 7.82vw, 115px)` scale and media titles `clamp(52px, 6.2vw, 100px)` beside their image, both reduced to `clamp(46px, 12.88vw, 82.8px)` at `860px` and below, where both layouts stack into one column. Their `0.96` line height gives multiline titles breathing room; balanced wrapping uses whole words, with an emergency break only for a word wider than its layout column.

Section headers share the page's leading edge: a mono count or label above a title that names the subject (“Scenes showing Goodhart's Law”, “Scenes from Black Mirror”, or “The scene from The Truman Show” when there is one). Section titles are `clamp(32px, 4.5vw, 62px)`, `clamp(40px, 6vw, 52px)` at 860px and below, and 42px at 680px and below. Sorting labels sit beside their options; scene collections default to “Featured first”. Risk families list their concepts before the scenes. Concepts end with the concepts they most often appear with, and media pages with the risk families and concepts their scenes illustrate. These lists are ranked chips whose counts are scenes shared with the current page; the first 12 show, and the rest open from a “Show all” disclosure whose + cue trails its label.

External links keep their text on the shared leading edge. As in the footer, an orange ↗ trails each link in an inline row and sits flush right on stacked, ruled rows; no icon precedes link text. Their labels, and the in-site Franchise and Risk family links in the facts strip, use the shared link underline. Pages with a single scene hide the chip counts and their note.

## Resource indexes

Index intros stack the label, title, description, and count on the page edge at the taxonomy title scale. Concept and risk-family indexes are text cards: a mono number above the title, the definition (two lines for concepts), and the scene count pinned to the card bottom; a short final row spans the open columns. Media-source and franchise indexes are poster grids (2:3 posters, 16:9 franchise art) in ink frames without shadow, washed grayscale until fine-pointer hover or keyboard focus, with type, year, and scene count beneath. Sorted A–Z, sources group under letter headings with a sticky letter bar (decades for date sorts); the source and franchise indexes link to each other.

## Media and spoilers

The full media plate is a play/pause target. Its initial poster state uses a large central play mark, and its keyboard focus ring sits outside the media bounds instead of covering the image. A branded play/pause pointer and contextual label replace the gallery-style crosshair and disappear over the progress control. Explicit controls use Play clip, Pause clip, and Resume clip consistently. The “Scene still” label is reserved for scenarios without video. The player instance stays mounted when returning to the still, while playback resets to the configured clip start. The custom timeline supports scrubbing and focused keyboard seeking. While a clip plays, custom chrome fades after 2.8 seconds without interaction when the plate is not hovered; hover, pointer or keyboard activity, scrubbing, and control focus restore it immediately, and paused or still states keep it visible. YouTube does not expose a supported top-chrome-only configuration, so its native controls remain disabled rather than mixing two incomplete control surfaces. Missing video is an intentional composed state: an archive note in the plate's lower-right corner, layered above the still.

The spoiler warning is the sole spinning-text element and appears on desktop Dossiers only; mobile-layout and touch-first devices omit it. A compact archive note carries the explanatory copy and overlaps an empty-center circular seal whose orbit repeats “Spoiler warning” three times with dot separators. On fine-pointer hover or keyboard focus, the orbit fades out and one centered white “I’m okay with spoilers” message fills the orange seal. The full note-and-seal surface acknowledges the warning—there is no separate close icon—then turns orange, briefly confirms “Spoilers noted,” retracts, and fades. A versioned local-storage value prevents a dismissed-state hydration flash. On Dossiers 1360px and wider the warning anchors bottom-left on the page gutter, over the label column, so it never covers the reading copy; between 821 and 1359px it closes the opening's text column in normal flow.

## Motion grammar

- Explore: elastic, continuous, interruptible
- Select: fast, exact, and locally vivid
- Navigate: one confident media-led transition; a short-lived DOM proxy carries the selected WebGL frame into the Dossier media plate
- Read: mostly still, with restrained entry/hover text effects

Avoid scanlines, ambient glitches, fake diagnostics, card collisions, independent drift, springy ornamental movement, and transition stacks that make content wait.

## Responsive behavior

Desktop is the craft target. Mobile uses fewer rows—including one fully framed row on short landscape surfaces—direct touch drag, first-tap selection/second-tap opening, no persistent selected-frame panel, centered balanced titles, and the same content hierarchy. Functional clarity outranks reproducing desktop density.

## Taxonomy social images

Risk-family and AI safety concept detail links share a 1200×630 Takumi card with the warm paper grid, charcoal Barlow Condensed full descriptive name, orange target icon, Cultural Alignment wordmark, and a quiet category label. The masthead wordmark shares the content's left edge, with the full-size target icon at the far right. Titles wrap within the card geometry. These image-free cards use the existing WebP quality and shared response-cache policy; Next.js supplies their Open Graph and Twitter image metadata.

Scenario social images align source metadata and concept text with the title's left edge in the paper panel. The × markers and concept numbers hang in that panel's existing margin.
