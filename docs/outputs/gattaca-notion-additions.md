# Gattaca Notion additions

Completed 2026-09-19. Created one Media Source and five Scenarios at the user’s request. Read-back verification passed for all six pages.

- [Gattaca](https://app.notion.com/p/Gattaca-3e0edb27f1248130a4bde04256c0ea81)
- [The DNA Job Interview](https://app.notion.com/p/The-DNA-Job-Interview-3e0edb27f124810aa8cbddfc28abf576)
- [The Borrowed Heartbeat](https://app.notion.com/p/The-Borrowed-Heartbeat-3e0edb27f12481d896dbe81057035ef2)
- [A Hair Is Enough](https://app.notion.com/p/A-Hair-Is-Enough-3e0edb27f12481c7be0ef83f1f7b7827)
- [A Prognosis Becomes a Verdict](https://app.notion.com/p/A-Prognosis-Becomes-a-Verdict-3e0edb27f124811bb13dfb75cbce953a)
- [Lamar Lets Vincent Through](https://app.notion.com/p/Lamar-Lets-Vincent-Through-3e0edb27f12481f9ad3bd95d9a17882b)

## Verification

- Exactly one uploaded Notion-hosted image in each page body; no hotlinked image blocks.
- Every scenario points to the new Gattaca source.
- Existing taxonomy relations verified live and retained in strongest-first order.
- Scene, analogy, caveats, and clip fields read back against the submitted values.
- Episode blank and featured unset for all five scenarios.
- Draft meme captions saved in page bodies; no rendered memes attached.
- Official Sony trailer and poster added to the Media Source.

## Media notes

- Clips were downloaded and inspected through sampled frames; interview and birth captions were also checked.
- Rejected NwPKYvvCsiU: it shows borrowed-identity preparation, not the proposed treadmill sequence.
- Correct treadmill excerpt: https://www.youtube.com/watch?v=uPqvrXXQvQk
- Ending excerpt: https://www.youtube.com/watch?v=NNUK1n29tVM
- Hair-sequencing excerpt: https://www.youtube.com/watch?v=iRFy3mrkP4s&t=105s
- Four scenario images are 1280–1920 px wide. The hair-test still is a clean 999 × 428 frame from SHOT.CAFE; this is below the preferred 1200 px, selected over the lower-resolution video frame.
- Original letterboxing and small source-channel marks are retained in extracted frames. The source poster is 1400 × 2100.

The subsequent requested `pnpm content:sync` completed successfully: five new scenarios and one new media source, with no changes to existing records. It uploaded 12 derived image variants. The snapshot now contains 474 scenarios, 265 sources, 15 franchises, 5 risk families, and 69 safety concepts.

## Repository verification

- Content validation passed, covering 2,042 content-addressed media references.
- Formatting, lint, route types, TypeScript, and all 379 unit tests passed.
- The initial `pnpm test` development-server browser run passed 18/21 journeys. Two navigation checks timed out; the source-sorting journey encountered a Next.js development-server `Unexpected end of JSON input` error. The cause was not established.
- `pnpm build` passed and generated 852 pages, including all six new Gattaca routes.
- `PLAYWRIGHT_SERVER=production pnpm test:e2e` passed all 21 journeys in 22.2 seconds without application-code changes.
