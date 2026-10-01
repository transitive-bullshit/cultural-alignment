# Riff branch

Use this branch to turn an outside reference (a tweet, meme format, headline, or joke) plus one archive scenario into a few candidates the owner picks from, and optionally publish the pick to the scenario's `Memes`. This is the project's meme workflow; the composer never publishes on its own.

Read [taste.md](taste.md) and [editorial.md](editorial.md) before writing captions.

## Steps

1. **Stage the scenario.** Run `pnpm memes:riff prepare <scenario-slug>`. It downloads the still and writes `fixture.json` to `work/meme-riffs/<slug>/`, reusing the hand-annotated regions in [protected-regions.json](../protected-regions.json) when they match the still. When it warns that no regions match, view the still and add `protected_regions` for faces and the recognition hinge as `[x, y, width, height]` percentages of the image, and save them to `protected-regions.json` for reuse. Done when the fixture protects every face and hinge.

2. **Extract one ingredient from the reference.** Name what it contributes: a meme grammar (“nobody: / me:”, a catchphrase), a topical AI event, or a joke angle. The scene stays the recognition hinge; the reference supplies one ingredient, not a template to fill. Its exact words are a lock only when the owner says so.

3. **Write three or four intents** as `intent-N.json` next to the fixture, following the composer contract. Make them genuinely different in hinge, ingredient, or semantic mode, and run each against the taste lists before composing.

4. **Compose each** with the command `prepare` printed, numbering the outputs. On `blocked`, change only the mutable ingredient the reason names: the other edge, a single beat, or shorter copy. Look at every preview. Done when three or four `complete` renders pass visual inspection.

5. **Present and stop.** Show the previews with each caption and a one-line why, and wait for the owner's pick. Record any reusable lesson from the pick or the rejections in [taste.md](taste.md).

6. **Publish only on request.** `pnpm memes:riff export <slug> <render.png>` writes a JPEG and an upload manifest. Show the uploader dry run (`pnpm memes:upload-notion --manifest=<path>`), then run it with `--apply` once the owner confirms. A normal `pnpm content:sync` (not `--fast`) imports the attachment; then run `pnpm content:validate` and commit the snapshot.
