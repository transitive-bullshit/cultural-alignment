# Blank first-load investigation

Date: September 2, 2026

## Summary

A mobile Safari user reported seeing the site header above an otherwise blank page on their first visit. The failure could not be reproduced naturally in the current production build, but it was reproduced precisely by pausing or ending the initial HTML response immediately after the header and before `<main>`.

This points to an incomplete document response rather than a React hydration, WebGL, image-loading, font-loading, or CSS failure. The homepage is a complete static prerender, and its render path always emits `<main>` directly after the header.

## Evidence

- 120 fresh production mobile loads rendered successfully.
- `<main>` remained present throughout 300 post-load samples.
- 60 direct HTTP checks returned structurally complete documents, and all deployed JavaScript and CSS assets returned `200`.
- Blocking JavaScript, WebGL, images, or fonts produced visible fallback states that did not match the report.
- A shortened `200` response ending after `</header>` matched the screenshot and could finish without a browser console error.

The public domain is proxied through Cloudflare before Vercel. Cloudflare modifies and reframes the otherwise fixed-length Vercel HTML response, so that extra delivery layer is the leading infrastructure suspect. This attribution remains provisional because the affected Safari request was not captured. [Vercel recommends against stacking a reverse proxy in front of Vercel](https://vercel.com/kb/guide/cloudflare-with-vercel) because it can introduce latency and cache-management complications.

## Current decision

Keep the existing Cloudflare configuration unchanged for now. No application or infrastructure changes were made during this investigation.

## Recommended next steps

1. Add a production mobile check that independently requires the site header and meaningful `<main>` content.
2. Add a one-time recovery and telemetry guard when the header loads without `<main>`.
3. If the issue recurs, capture the URL, timestamp, browser version, reload outcome, and—if possible—a Safari HAR.
4. Reconsider Cloudflare DNS-only routing only if recurrence data supports it.
