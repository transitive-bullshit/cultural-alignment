# Riff branch

Use this branch to turn an outside reference (a tweet, meme format, headline, or joke) plus one archive scenario into a few candidates the owner picks from, and optionally publish the pick to the scenario's `Memes`. This is the project's meme workflow; the composer never publishes on its own.

Read [taste.md](taste.md) and [editorial.md](editorial.md) before writing captions.

## Steps

1. **Stage the scenario.** Run `pnpm memes:riff prepare <scenario-slug>`. It downloads the still and writes `fixture.json` to `work/meme-riffs/<slug>/`, reusing the hand-annotated regions in [protected-regions.json](../protected-regions.json) when they match the still. Inspect the scenario's existing memes and avoid their exact copy or same joke with cosmetic changes. Compare the still with alternate recognizable imagery; replace the fixture's image and regions when another reference serves the joke better. When no regions match the chosen image, view it and add `protected_regions` for faces and the recognition hinge as `[x, y, width, height]` percentages of the image. Save reusable annotations to `protected-regions.json` only when they describe the current scenario still. Done when the fixture protects every face and hinge.

2. **Extract one ingredient from the reference.** Name what it contributes: a meme grammar (“nobody: / me:”, a catchphrase), a topical AI event, or a joke angle. The chosen visual supplies the recognition hinge and the scenario supplies the AI bridge. Its exact words are a lock only when the owner says so.

3. **Write three or four intents** as `intent-N.json` next to the fixture, following the composer contract. Make them genuinely different in hinge, ingredient, or semantic mode, and run each against the taste lists before composing.

4. **Compose each** with the command `prepare` printed, numbering the outputs. On `blocked`, change only the mutable ingredient the reason names: the other edge, a single beat, or shorter copy. Look at every preview. Done when three or four `complete` renders pass visual inspection.

5. **Present and stop.** Use the [local batch review](batch-review.md) even for a single scenario, with previews, exact captions, and a one-line why. Wait for copied results and the owner's requested action. Record any reusable lesson from the pick or the rejections in [taste.md](taste.md).

6. **Publish only on request.** Follow the [batch review promotion step](batch-review.md#promote-or-refine) for the exact approved revisions. `pnpm memes:riff export <slug> <render.png>` writes a JPEG and an upload manifest. Show the uploader dry run (`pnpm memes:upload-notion --manifest=<path>`), then run it with `--apply` when upload authorization is present. A normal `pnpm content:sync` (not `--fast`) imports the attachment; then run `pnpm content:validate` and commit the snapshot.
