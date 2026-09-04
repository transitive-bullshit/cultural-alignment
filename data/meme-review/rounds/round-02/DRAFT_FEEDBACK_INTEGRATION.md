# Pre-generation seed feedback

The local review page was briefly visible while `round-02/ideas.json` still contained schema-valid generation seeds. The first exact reviewed payload and its 36 idea reviews are preserved under `drafts/seed-review-checkpoint-2026-09-03-194126z/`. One note was subsequently cleared while its dislike rating stayed intact; that later exact state is preserved under `drafts/seed-review-final-checkpoint-2026-09-03-200307z/` and governs selection. Both snapshots remain immutable history.

A later partial-review payload is preserved under `drafts/partial-review-layout-checkpoint-2026-09-03-213522z/`. It records the exact first 24 reviewable scenarios, three Dr. Evil idea reviews, and the newly disabled Brian scenario before the batch-wide overlay-first layout correction. Those ratings remain attached to that exact visual version; revised layouts return to the active review queue without inheriting the old rating.

Feedback binds to the exact archived payload, not merely its ID. Never attach a seed rating to different final copy that happened to inherit the same allocated ID. A liked or explicitly salvageable seed may keep its ID as a lineage; a genuinely different final direction must move above every exposed seed ID.

## Global corrections already applied

- Paired corner/dialogue zones now have a real horizontal gap instead of two overlapping 52%-wide boxes.
- Label text in bands and sidecars retains its orange accent fill, avoiding dark-on-black invisible captions.
- Impact overlays use a crisp outline/shadow without automatic black or partial gradient rectangles.
- The taste profile now requires checking the final HTML render for overlap, visibility, contrast, and recognition-hinge preservation.
- Rejected concepts are discarded rather than cosmetically paraphrased unless a note explicitly preserves an ingredient or supplies a concrete fix.
- The partial review clarified that a full-frame text overlay is the aesthetic default even when it covers incidental scene detail. Alternate overlay positions and smaller readable type must be tried before external bands, sidecars, contained frames, or expanded backgrounds.

## Payload-specific routing

- `hal-resists-disconnection`: keep seed `--05` with exact copy and move it off HAL's red eye; replace reviewed `--06`/`--07` under fresh `--08`/`--09` IDs.
- `sol-only-takes-an-arm`: all three seed directions were rejected and two were source-inaccurate. Generate fresh `--08`/`--09`/`--10`; the weapon tried to remove all of Sol and only succeeded in taking one arm.
- `tetsuo-outgrows-containment`: keep liked seed `--05` and its bold orange label treatment; replace reviewed `--06`/`--07` under fresh IDs.
- `alien-mothers-directive`: keep R1-liked `--01` in its original bottom-safe composition; keep seed-liked `--06`, revising `THE ASSISTANT` to `THE ROGUE AI`; place the third genuinely new direction under a fresh ID.
- `rons-sabotaged-teleprompter`: keep seed-liked `--05` and `--06` exactly; keep the strongest new question-mark/write-access direction under a fresh `--08`.
- `dedra-connects-the-data-silos`: `--05` needs a bottom-safe layout if its exact concept survives; `--06` needs non-overlapping dialogue geometry if it survives; never revive the generic correct-model/Empire concept from `--07`.
- `square-filter-round-hole`: neutral `--04` and disliked `--05`/`--06` do not survive; generate three fresh directions under IDs above `--06`.
- `viktors-glorious-evolution`: keep seed-liked `--04` and its exact canonical quote; replace reviewed `--05`/`--06` under fresh `--07`/`--08`.
- `money-in-the-banana-stand`: keep seed-liked `--06`; `--05` may survive only with non-overlapping dialogue geometry, otherwise replace it; use a fresh ID instead of reviewed/disliked `--07` for the third direction.
- `dr-evils-outdated-ransom`: R1-liked `--01` keeps its copy but loses the unnecessary black gradient bars. The newer explicit concept-level dislike of R1-liked `--02` supersedes the old like: remove it entirely and generate a fresh direction under a fresh ID. Any use of reviewed `--04` must visibly fix its contrast.
- `dr-evils-outdated-ransom` partial layout review: `--05` and `--06` were liked; preserve both concepts and copy. `--05` specifically needs normal overlaid top/bottom text instead of an expanded frame. Although `--01` received a bare dislike, the immediately following batch-wide clarification says the current concepts are solid and requests layout-only revisions, so keep its copy for this re-layout pass and retain the exact disliked visual in the partial checkpoint.
- `no-war-in-ba-sing-se`: seed `--06`/`--07` were rejected; new copy uses fresh IDs.
- `ultron-peace-in-our-time`: final new concepts move to fresh `--08`/`--09` because seed `--06`/`--07` were reviewed and rejected for different copy.
- `the-literal-doctor` and `karl-fritzs-vow` were disabled at scenario level; keep that state for future generation rounds.
- `brian-rewinds-the-gauge` was disabled during the partial round-two review; preserve that exclusion in future generation rounds.
