# Social images and crawler files

Every scenario, media source, franchise, risk family, and concept page names a generated 1200×630 WebP card in its Open Graph and Twitter metadata, served with long-lived CDN caching. The sitemap lists every detail route, `robots.txt` points to it, and `llms.txt` describes the archive.

## Sub-features

- `social-image-meta` points `og:image` and `twitter:image` to `/<route>/<slug>/opengraph-image`.
- `social-image-render` returns a 1200×630 WebP with the three cache headers for all five families, including the longest names and a posterless source.
- `crawler-sitemap` lists every detail route and no retired `/scenarios/family/*` archives.
- `crawler-robots` references the sitemap.
- `crawler-llms` serves the plain-text archive description.

## How to get to it (user POV)

- Share a detail URL on a social platform or chat app, which fetches the card from the metadata.
- Search engines and crawlers request `/sitemap.xml`, `/robots.txt`, and `/llms.txt`.

## Driving it with verify.ts

Preconditions:

- `verify.ts doctor --run=<id>` passes.
- The snapshot has a source without a poster; otherwise the first source is used.

- **Metadata.** Load each target detail page. Both `meta[property="og:image"]` and `meta[name="twitter:image"]` have the path `/<route>/<slug>/opengraph-image`.
- **Render.** Request that path from the instance with Playwright's `request.get`. The response is 200 with `content-type: image/webp`; Sharp reads `webp` at 1200×630. The image and its `cache-control`, `cdn-cache-control`, and `vercel-cdn-cache-control` headers are saved.
- **Sitemap.** `GET /sitemap.xml` lists the path of every snapshot scenario, source, franchise, risk family, and concept, and no `/scenarios/family/` paths.
- **Robots and llms.txt.** `GET /robots.txt` contains a `Sitemap:` line ending in `/sitemap.xml`. `GET /llms.txt` returns 200 and names Cultural Alignment.
- **Proof.** Run `.agents/skills/verify-cultural-alignment/verify.ts drive .agents/skills/verify-cultural-alignment/journeys/social-images.journey.ts --run=<id> -- --project=desktop`. Evidence includes five `.webp` cards to inspect visually, their response records, and the sitemap, robots, and `llms.txt` bodies.

## Gotchas

- Metadata URLs use the site origin (`http://localhost:3000` for a local build), not the instance port. Request the pathname from the instance.
- Cards are viewport-independent, so the journey skips the mobile project.
- Check wrapping and fallbacks by looking at the saved WebP files; header and dimension checks cannot catch clipped titles.
- The first request for a card renders it on demand and can take a few seconds.
