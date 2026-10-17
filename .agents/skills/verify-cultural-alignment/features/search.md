# Global search

The header's Search button and the Command-K or Control-K shortcut open a palette that loads the archive's search index on first use, explains empty and no-match states, and opens scenarios, media sources, franchises, risk families, and concepts.

## Sub-features

- `search-open` opens the palette from the header button or the shortcut, with focus in the combobox.
- `search-load` fetches `/content/search-index.json` on first open.
- `search-empty` prompts for a query when the input is empty and reports no matching records.
- `search-navigate` opens each of the five resource types from a result.

## How to get to it (user POV)

- Choose `Search` in the header on any page, including phones.
- Press Command-K or Control-K on desktop.
- From the not-found page, choose `Search the archive`.

## Driving it with verify.ts

Preconditions:

- `verify.ts doctor --run=<id>` passes.
- `content/snapshot/search-documents.json` holds at least one document of each kind.

- **Open from header.** Load `/about`, wait for `[data-search-ready="true"]`, and click `getByRole('button', { name: /Search site/ })`. A `/content/search-index.json` response returns 200, the combobox is focused, and the prompt `Type a title, franchise, source, risk, or concept.` is visible.
- **No match.** Fill the combobox with `zzqxv volcano`. `No matching records.` appears. Escape closes the palette.
- **Not-found page.** Load an unknown path such as `/no-such-archive-page`. `[data-not-found]` is visible; after `[data-search-ready="true"]`, clicking `[data-not-found-search]` focuses the combobox.
- **Shortcut.** Press `ControlOrMeta+k` on desktop; phones use the header button. The combobox is focused again.
- **Each resource type.** Fill the combobox with a document's title. `[data-search-result-href="<href>"]` is visible; clicking it navigates to the href, where `[data-scenario-dossier]` or `[data-resource-detail="<kind>"]` is visible.
- **Proof.** Run `.agents/skills/verify-cultural-alignment/verify.ts drive .agents/skills/verify-cultural-alignment/journeys/search.journey.ts --run=<id>`. Captures show the prompt, the no-match state, the not-found entry, and a result plus destination for each kind.

## Gotchas

- The shortcut works only after hydration; wait for `[data-search-ready="true"]` before pressing it.
- The index loads once per page session. Catch its response with `waitForResponse` before opening, or it will already have loaded.
- Common titles can match several records. Select the result by its `data-search-result-href`, not its position.
