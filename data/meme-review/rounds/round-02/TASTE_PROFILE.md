# Meme review round two taste profile

This round is trained on the exact immutable round-one files in `../round-01/`. Round one contains 519 ideas: 156 likes, 46 neutrals, 296 dislikes, and 21 unrated ideas. Preserve the archive and its feedback byte for byte.

## Selection policy

- Every round-one `like` survives under the same stable idea ID unless a newer review of that exact direction explicitly rejects it. The newest selection signal governs what stays active; all earlier signals remain archived.
- A liked direction with requested changes becomes a new version under that same ID. Praise-only likes keep their copy and receive only a composition sanity check.
- Neutral, disliked, and unrated ideas leave the active set. Replace them with genuinely new directions and never recycle their IDs.
- A dislike with no comment rejects the entire concept. A dislike whose comment rejects the concept or text is equally terminal. Do not iterate, paraphrase, polish, reframe, or reuse the central joke; start from a different recognition hinge, comedic ingredient, framing device, and meme format.
- Revisit a disliked direction only when its note explicitly preserves a named ingredient or requests a bounded execution fix such as layout, contrast, frame choice, quote accuracy, or one precise copy edit. Preserve only the named ingredient.
- Every scenario finishes with exactly three active ideas in round two.
- New IDs continue above the scenario's highest round-one numeric suffix.

The durable cross-round policy lives in `../../GENERATION_POLICY.md`; round-two constraints supplement rather than replace it.

## What the first pass says about taste

The winning realization remains: one unmistakable fandom cue plus one concrete AI bridge, then stop.

- Specific names, quotes, props, numbers, physical actions, and reactions beat taxonomy-first copy.
- Recognition should arrive before abstraction. Put `3.6 ROENTGEN`, the steak, the butter, the air gap, the remote, the question marks, or the character's canonical line first.
- The AI bridge must create a payoff rather than classify the plot. A correct analogy without personality is not enough.
- Crisp technical weirdness is welcome when instantly legible: root access, biological CAPTCHA, SQL, horizontal scaling, an unpinned frog-DNA dependency.
- Emotional truth can hit as hard as comedy when the scene already carries it.
- Source-native profanity, absurdity, dryness, and character voice are assets.
- `WHEN YOUR…` is useful native meme grammar for the right collision, not a mandatory template.
- Broadly reusable observations can work when a precise source cue still owns the line.

Round-one directional signals among reviewed ideas:

- collision: 45% liked; relabel: 34%; canon: 30%; interface: 24%; state contrast: 20%; dialogue: 18%;
- one caption line: 44% liked; two: 33%; three: 18%;
- ideas rendered on the curated frame were liked about 1.8 times as often as unresolved `alternate-needed` previews.

Treat those as priors, not quotas. Prefer collision, relabel, and canon when the scene supports them. Use dialogue, code, an interface, or a state contrast only when that native form is itself the joke.

## Less obvious signals in written feedback

- A rating is not an atomic judgment on every ingredient. Several dislikes explicitly preserve a quote, premise, private-safe-word mechanic, background image, or first line while rejecting the execution. Salvage only the named ingredient, rebuild the direction around it, and give the result a new ID.
- “Cute” landed at neutral; surprising precision, emotional force, or an actual second-beat payoff is what moved nearby ideas to like. Recognition alone is necessary but not sufficient.
- Canonical cues often need to lead in reading order. The `3.6 ROENTGEN` note is the cleanest example: recognition first, canonical response second, with the AI mapping carried by context rather than a preceding explanation.
- The user can love a frame while disliking every proposed caption. Treat a strong source image as independent evidence that the scene has memetic potential; do not abandon it just because the first copy missed.
- Contemporary substitutions work best as one surgical noun swap inside source-native grammar (`AI` for `THE TET`), not as a topical-news paragraph.
- Canon accuracy is part of the laugh: spelling, exact line order, speaker, before/after chronology, and which image belongs on which side all matter.
- Broad applicability is not automatically generic. A line can travel across scenarios when the visible scene still gives it one unmistakable owner.
- Many composition complaints occurred on liked concepts. Preserve concept approval separately from execution approval, and never interpret a like as permission to keep text over the recognition hinge.

## Composition is part of the idea

Before placing text, identify the recognition hinge and every region that must survive: faces, the main subject, a prop, gesture, readout, original subtitle, or source-native on-screen mark.

Use this fallback ladder:

1. A compact overlay in genuine negative space.
2. The opposite corner or edge.
3. A familiar top/bottom overlay split, with controlled line breaks.
4. Slightly smaller but still comfortable overlay type.
5. A different authentic asset with more usable space, when it is actually present in the preview.
6. Only then, an external band, sidecar, contained image, or deliberately extended/blurred frame.

The default is the source image filling the meme with text on top of it. A little overlap is desirable and helps the result feel like a native, low-effort meme; only overlap with the recognition hinge is disqualifying. Do not leave an alternate as a search wish. Do not use a diptych without two real, correctly ordered assets. CSS blur can create breathing room but cannot invent missing scene content. Never shrink below comfortable desktop readability.

Avoid a safe-layout monoculture. Use `cover` plus a plain overlay whenever it can preserve the hinge. Bands, sidecars, and blurred containment are last-resort escape hatches for frames that genuinely cannot support readable overlay text, not a visual house style to apply to every survivor.

The first complete round-two draft exposed the failure numerically: 403 of 519 previews moved text outside the scene and 402 expanded or contained the image. That was a systemic overcorrection, not an acceptable composition prior. The overlay-first reprocessing pass must judge each rendered frame individually and reverse those defaults while preserving the smaller set of genuinely necessary fallbacks.

Render-level checks are mandatory, because plausible layout metadata can still produce a broken image after wrapping. Paired corner or dialogue boxes need a real gap and must never overlap. Every foreground style must retain sufficient contrast in its chosen template; dark label text belongs on the accent fill, not a black band. Native impact text should normally use its outline and shadow directly on the still. Avoid unnecessary black rectangles and partial gradient bars behind readable text; an external band is for genuinely missing space, not decoration. Confirm that every caption is visible in the final HTML render.

Code must use a code zone and explicit indentation. Preserve case when a quote, interface, or character voice benefits from it. Use local scrims behind text, not a blanket gradient over the scene.

## Critic calibration

Round one's critic was not discriminating: it predicted 447 likes, while the user liked 156. All 519 glance tests passed, so the booleans were acting as ceremony rather than evidence.

For each round-two survivor, score independently:

1. exact scene-level hinge;
2. whether the AI bridge itself supplies the payoff;
3. parsing ease;
4. visual proof and preservation of protected regions;
5. source/copy accuracy.

Compare against an actual liked and disliked round-one precedent when useful. Predict `neutral` when warranted. A third candidate may be riskier than the first two, but it still needs to clear the four-part glance test honestly.

## Failure modes to remove

- generic dashboards, KPIs, status labels, or access-denied boilerplate;
- invented dialogue that explains rather than sounds native;
- three lines where one collision would land;
- an AI label stapled onto a plot summary;
- a famous franchise with no exact scene cue;
- two abstract concepts fighting for the punchline;
- false before/after layouts made from one duplicated still;
- covering a face, reaction, prop, readout, or other recognition hinge;
- explaining the joke after it lands.
