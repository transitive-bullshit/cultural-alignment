# Meme generation and review policy

This file governs every meme generation batch, regardless of round number, scenario status, or which ideas are currently active in the review tool.

## Feedback semantics

- A `like` preserves the idea as a lineage. Future edits create another immutable version of that lineage so reviewers can compare its evolution and see the feedback attached to each exact version.
- When the same exact idea version is reviewed again, its newest explicit rating supersedes its earlier selection status while both review records remain in history. In particular, a later dislike terminates an earlier liked direction.
- A `neutral` does not survive a concept-generation pass by default. A layout or execution pass may explicitly retain every non-disliked candidate; in that case, keep neutral lineages and limit changes to the pass's stated execution scope.
- An unreviewed idea normally waits for review. When an explicitly scoped execution pass retains every non-disliked candidate, carry an unreviewed lineage forward as mutable without inventing a rating; its next exposed version remains unreviewed.
- A `dislike` with no note rejects the concept, text, framing device, and meme direction. Delete it from the next active batch. Do not paraphrase it, polish it, change only the layout, or quietly reuse its central joke.
- A `dislike` whose note rejects the concept or text is also terminal. Start from a different recognition hinge, comedic ingredient, framing device, and meme format.
- Revisit a disliked idea only when its note explicitly preserves an ingredient or asks for a bounded execution correction such as moving text off a face, fixing contrast, correcting a quote, or changing a frame. Preserve only what the note names.
- A batch brief may narrow this further. When a pass is scoped to **non-disliked candidates only**, every explicit dislike is terminal for that pass even when it has a note.
- Keep rejected versions and their feedback in immutable history as negative taste evidence, even though they leave the active review batch.

Ratings and notes bind to the exact idea-version payload that was reviewed, not merely to a reusable string ID. Never attach old feedback to changed copy.

## Finalization

- `locked: true` is the reviewer’s final approval of an already liked meme. The UI calls this state **Finalized**. A like keeps a lineage alive and mutable; finalization is the stronger state.
- Finalization applies to the exact version the reviewer selected, whether it is current or archived. Its `finalizedVersion` pointer and payload fingerprint identify the frozen concept, copy, source anchor, format, frame guidance, critique, preview layout, and image or referenced assets. Never assume the newest version is the finalized one.
- The finalized version is the lineage’s featured/default preview. Do not give a finalized lineage ID to generator, critic, copy, frame-selection, or layout agents. Its other versions remain immutable history, not alternate candidates to revise.
- Carry every finalized lineage, its exact `finalizedVersion`, feedback, and `locked: true` into each future batch under the same scenario and lineage ID. Within each scenario, finalized ideas appear before its mutable candidates and do not consume that scenario’s candidate-generation quota.
- Scenario disablement never removes a finalized meme. If a mutable candidate needs a different version of an asset shared with a finalized meme, allocate a new asset ID instead of editing the locked asset in place.
- Only an explicit `locked: false` review update releases the freeze. General requests to regenerate a scenario, revise layouts, or make another pass do not override finalization. Unfinalizing preserves the Like and existing note at the moment of transition; the reviewer may then change them while the idea is unlocked.
- Treat finalization changes as compare-and-set operations: every `locked` update must include the exact feedback state and revision the reviewer actually observed. Reject stale or ambiguous updates instead of allowing an old tab or reordered autosave to overwrite feedback or clear final approval.
- Bind every finalization change to its exact revision key and payload fingerprint. Re-resolve and verify the selected renderer-v1 image or renderer-v2 referenced assets while holding the shared file lock; reject a missing, changed, or ambiguous revision.
- Persist and carry the internal monotonic `lockRevision` with each idea’s feedback. Only the review store may increment it. A cross-batch lock change without a newer revision is not an explicit reviewer action and must be rejected.
- Snapshot and archive the exact feedback state attached to finalized versions. Preparation, assembly, staging, checking, and publication must run the shared finalized-meme preservation check before exposing a future payload.
- Feedback writes and generation/publication commits for the same active batch must share the meme-review file lock so finalization cannot race a checked payload replacement.
- Reserve **locked** for finalized memes. Call unfinished scenarios WIP or unavailable.

## Batch and history model

- Treat batches as an open-ended ordered series, not as a two-round workflow.
- Store each batch under `rounds/round-NN/` with immutable `ideas.json`, `assets.json`, and `feedback.json` once review closes. Renderer-v2 batches also carry `status.json`; keep it `generating` until the complete payload and rendered composition audit are finished, then switch it to `ready` for the explicit handoff.
- A generating batch may expose independently finished scenarios through `status.json`'s `reviewable_scenarios`. Mark every other scenario prominently as WIP and reject feedback writes to it. Once a scenario becomes reviewable, freeze that exact idea/asset payload; do not silently revise it underneath incoming feedback.
- The review page is fail-open across zero-ready, partially ready, and fully ready states. A stale readiness slug, a missing preview asset, an editorial taxonomy mismatch, or an unreconciled draft must never crash the whole route; isolate the affected data, keep completed scenarios visible where possible, and render a recovery state as the final fallback.
- A batch may contain ideas for any scenario. `featured` is a generation-priority input, not a permanent review-tool filter.
- A scenario may have any useful number of active ideas. Exact candidate counts are batch-specific generation constraints, not invariants of the archive or UI.
- Each generated idea version is immutable once exposed for feedback. A lineage may accumulate any number of versions over time.
- If feedback reaches an in-progress payload, snapshot that exact payload under the batch's `drafts/` directory before changing it. Draft feedback remains bound to that snapshot and appears in the version history of any lineage that survives.
- Preserve the rating and note attached to every exact historical version, including rejected versions.
- Scenario-level disablement is durable generation guidance. It does not delete existing ideas or their feedback.

## Composition and copy

- Choose the meme template before fine positioning. Match the joke's reading order: top setup plus bottom payoff for a conventional two-beat meme, left then right for a genuine before/after or state contrast, one forceful zone for a single beat, and a source-native interface only when the interface is itself the joke.
- Treat familiar aggressive meme composition as the prior, not the fallback. Across a layout pass, roughly 60–70% of eligible multi-beat ideas should use a traditional top/bottom or genuine left/right split with each beat in its own visual zone. This is a batch-level prior, not a quota that overrides a scene that calls for another native format.
- Default conventional caption type to large, direct, and comfortably readable. Use comparable `hero` or `standard` sizing for setup and payoff; reserve `compact` type for copy or source-native formats that genuinely need density. Two caption lines should not collapse into one small safe box merely because they fit there.
- Treat `hero` as the first typography trial for conventional meme copy. Compare against the earliest strong version in the lineage when available; preserve or restore its bold, eye-catching scale before inventing a quieter composition. Use `standard` only after the rendered card proves that `hero` creates an actual focal collision, awkward wrap, or unreadable density.
- Use per-version `display` sizing for short copy that is already `hero` but received explicit “larger” feedback. This opt-in size sits above `hero`; never enlarge the shared `hero` CSS token because that would silently alter finalized historical versions.
- When large overlay type needs separation from a busy frame, add a subtle edge gradient behind that caption region. The gradient supports contrast without turning the caption into a detached panel or shrinking the type.
- Write caption zones like informal meme fragments: omit terminal periods by default, including periods at the end of quoted or parenthetical copy. Preserve only punctuation that carries meaning inside the line—such as decimal points, ellipses used as a beat, abbreviations, filenames, code syntax, or a canonical quote whose punctuation is itself a recognition cue—or punctuation the reviewer explicitly requests.
- Protect the recognition hinge while composing: faces, reactions, main subjects, props, gestures, readouts, subtitles, or source-native marks. These are focal constraints, not blanket no-text rectangles over every body or object.
- Default to the authentic scene filling the meme frame with text overlaid in a familiar meme position. Covering part of the image is expected and encouraged: the result should feel immediate and casually assembled, while the subject and scene remain recognizable.
- Start with the canonical template at full readable size. If it excessively obscures the recognition hinge, try the opposite reading direction or edge, adjust line breaks, and reduce type modestly while preserving the setup/payoff separation.
- Only when every readable overlay excessively obscures the recognition hinge may text leave the source frame. External bands, sidecars, contained/extended frames, wider stills, and blurred extensions are fallback devices, never the default.
- Do not choose a band or sidecar merely because an asset has protected regions. Text may cover incidental bodies, scenery, clothing, or background detail; it must not meaningfully hide the face, reaction, prop, action, or object that makes the scene recognizable.
- A diptych must express a real visual transition and use two authentic, correctly ordered frames. Never duplicate one still to simulate before/after.
- Check the rendered HTML, not only layout metadata. Text must remain visible, comfortable, non-overlapping, and correctly wrapped at the review-card size.
- Multiline code and pseudocode must use proper indentation.
- `ai_concept` names the meme's single concrete bridge. It may sharpen or extend the scenario's existing taxonomy and is not required to duplicate one of the dossier's current concept titles.
- Seek one unmistakable fandom cue plus one concrete AI bridge. Contemporary substitutions, source-native comedy, emotional attachment, and well-known fandom references are useful ingredients when they sharpen rather than explain the joke.
