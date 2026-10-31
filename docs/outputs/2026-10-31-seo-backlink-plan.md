# Cultural Alignment: SEO review and backlink plan

Prepared October 31, 2026. This is a dated research and execution proposal, not a new product contract. The owner authorized a pull request for the SEO and dependency changes. Outreach, submissions, deployment, purchases, and account changes have not been authorized or performed.

## Source and interpretation

Reviewed all 69 numbered recommendations in [borja's post](https://x.com/borjafat/status/2116164330014007296), recovered through the [public FxTwitter text mirror](https://api.fxtwitter.com/status/2116164330014007296) after X returned 403 to the research browser. The post's tier ranking and claimed AI-mention results are unverified promotional claims. They do not establish causation or predict results for this project.

Cultural Alignment's useful contribution is a personally curated archive of recognizable scenes, authored explanations, and explicit analogy limits. The strongest link destination is usually a relevant concept or dossier, rather than the homepage. Preserve the recognition-first experience and current editorial scope described in [Product](../PRODUCT.md).

## On-site findings and changes

The repository already supplies catalog-backed canonical links and sitemap URLs, robots.txt, initial-HTML scenario links, individual descriptions, generated social cards, Article/CollectionPage JSON-LD, and llms.txt. Recreating these would add little. The public [concept index](https://cultural-alignment.com/concepts) returned 200 and contained its correct canonical, title, description, and 1200×630 social image, but no `og:url` or large-image preview permission. Its HTML and the public robots response were saved under ignored `work/seo/` during this run.

Implemented:

- A shared static-page metadata builder aligns `og:url` with the canonical on `/scenarios`, `/sources`, `/franchises`, `/risk-families`, `/concepts`, `/about`, and `/privacy`. These seven pages previously omitted the Open Graph URL. Existing root title templates and file-based images remain in use.
- The root layout emits `max-image-preview:large`, permitting larger search image previews. Google's [Discover guidance](https://developers.google.com/search/docs/appearance/google-discover) recommends this alongside suitable representative images; it does not guarantee inclusion or traffic. Existing third-party media rights remain unchanged.
- A browser regression suite inspects initial HTML without JavaScript for all eight fixed pages and a snapshot-derived page from each of the five detail families. It checks canonical/share URL agreement, removal of tracking queries from canonical identities, resolved title and description agreement, inherited/generated images, and preview permission.

No visible layout, gallery behavior, editorial snapshot, CMS, or delivery configuration changed. Search visibility alternatives already documented in Product—visible gallery text, a permanent homepage headline, and links beyond the initial 12 collection items—remain design decisions for a separate visual review.

### Verification evidence

Branch: `seo-backlink-foundations`, based on `8b07327` (public main's revision was verified through HTTPS after the configured SSH key could not sign).

- `pnpm content:validate`: passed for the current snapshot and media references.
- `pnpm test:checks`: passed formatting, lint, generated route types, TypeScript, and all 311 unit tests across 43 files.
- Production webpack build: passed. Full Playwright suite against that build: **57 passed**, including the 13 new metadata cases.
- Repository verification skill: run `20261031-090124-28cc`, build `mTNJIuzGoApIvJSLAvPgz`. Doctor passed process, port, HTTP, build/source consistency, and all 487 server-rendered scenario links. The ad hoc desktop SEO journey passed all seven static-page response checks and captured HTML, JSON metadata records, a screenshot, an ARIA snapshot, and a trace in `work/verify/evidence/20261031-090124-28cc/01-seo/`. The screenshot was inspected. Its only recorded problems were the documented local Vercel Analytics script 404 and related browser errors. Safari and physical-device behavior were not tested; this change has no viewport-dependent presentation.
- Live read-only audit: all five backlink destinations returned 200 with matching production canonicals; `/sitemap.xml` returned 200 with 851 URLs and no local or Vercel preview origins. Record: `work/seo/production-audit.json`. Current counts are dated evidence, not fixed test expectations.
- Before/after metadata evidence: production `/concepts` had a canonical and image but no `og:url`; the corrected local production build has a matching `og:url`, keeps the inherited social image, and emits `max-image-preview:large`. The browser tests initially caught dropped parent images and a homepage trailing-slash assumption; both were corrected before the passing run. The inheritance trap was recorded in the repository verification recipe.

### Dependency update

The owner subsequently authorized updating Next.js and opening a pull request. `package.json` now requires `next: ^16.4.3`, and the lockfile resolves **Next.js 16.4.3**, **@next/env 16.4.3**, and all eight platform-specific _*@next/swc-* 16.4.3_* packages. Only Next.js and its matching package references/integrities changed in the lockfile. React and React DOM remain at 19.3.0; no additional Next.js packages are declared directly. The SEO application and test source files were verified byte-for-byte unchanged during the dependency update.

Version 16.4.3 is the [current stable patch release](https://github.com/vercel/next.js/releases/tag/v16.4.3) in this project's existing release line and includes the fixes introduced in [16.4.1's October security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026). The package manager's existing minimum-release-age policy was preserved. The advisory affects 16.4.0; the production dependency audit reports no Next.js advisory after the update.

The audit does report a separate high-severity [Zod collection-validation issue](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in the existing Zod 4.6.5 dependency, patched in 4.6.6. Zod was not changed as part of the requested Next.js update. Audit exit status therefore remains nonzero. Next.js has also [announced a November 3 security release](https://nextjs.org/blog/upcoming-nextjs-security-release-november-2026); those patches were not yet published when this update was prepared.

On 16.4.3, content validation and `pnpm test:checks` passed again, including all 311 unit tests. Production webpack compilation succeeded without the earlier Next.js security warning, and all **57 browser tests passed** against that build (45.4 seconds). Deployment and the public site's changed metadata remain pending owner review.

## Which recommendations fit

| Post items | Decision for this archive |
| --- | --- |
| 1–5 | Pursue independently useful editorial references; record the actual source and destination. Skip reciprocal-link arrangements and networks selling placements. |
| 6–12 | Adapt to educational reading lists with an exact proposed resource description. Commercial buyer roundups are a poor audience match. |
| 13–19 | Consider a reproducible analysis of this archive's coverage. Label counts as editorial selections, never estimates of real-world AI risk or audience learning. |
| 20–27 | Respond only to a relevant, live request within the owner's firsthand experience, after review. No journalist service account or response created. |
| 28–32 | Study why a publisher cites an educational resource, then offer a specific complementary example. No backlink-provider account or exhaustive competitor graph is available. |
| 33–37 | Audit known mentions and historical URLs before proposing reclamation. No lost backlink or broken referring URL was established in this run. |
| 38–43 | The existing searchable archive is already a free resource. Favor a useful concept page over inventing an unrelated calculator. |
| 44–49 | Replace a dead reference only when its original purpose and a truly equivalent destination are verified. No mass replacement campaign. |
| 50–60 | Offer an original explanatory diagram or a short walkthrough if an editor wants it. Obtain approval before producing publisher-specific media or publishing video. |
| 61–64 | A factual Notion-to-static-snapshot case study could fit a vendor editorial feature. Treat this as secondary to the educational audience. |
| 65–69 | Consider only a curated AI-safety resource directory that accepts this format. Supplier and government business listings do not fit the archive. |

These choices follow Google's [link-spam policy](https://developers.google.com/search/docs/essentials/spam-policies#link-spam): avoid paid ranking links, automated link creation, excessive exchanges, and low-quality directories. No ranking or AI-citation improvement is promised.

## First editorial wave: concrete prospects

These are researched candidates, not established relationships or confirmed placement offers. Contact routes and eligibility need a final check before sending. All rows are **draft; unsent**.

| Priority / prospect | Evidence and proposed placement | Destination and proposed addition | Next step after owner approval |
| --- | --- | --- | --- |
| P1 · AISafety.info | Its [Goodhart's law explainer](https://aisafety.info/questions/8185/What-is-Goodharts-law) discusses school test-score incentives and exposes an editorial suggestion link. A scene-based supplement fits that passage. | [Teaching to the Test](https://cultural-alignment.com/scenarios/teaching-to-the-test), with [Goodhart's law examples](https://cultural-alignment.com/concepts/goodharts-law) as the collection. Suggested addition: “For a fictional illustration of school incentives overwhelming the learning objective, see Cultural Alignment's analysis of The Wire, including the analogy's limitations.” | Review the explainer's linked Google Doc and suggestion rules, then propose one small addition through that route. No suggestion posted. |
| P1 · BlueDot Impact | Its [Technical AI Safety Unit 2](https://bluedot.org/courses/technical-ai-safety/2/1) covers training safer models. Offer a facilitator warm-up rather than an alternative technical syllabus. The [course overview](https://bluedot.org/courses/technical-ai-safety) establishes the audience. | [Lacie Games Her Rating](https://cultural-alignment.com/scenarios/lacie-games-her-rating) and the Goodhart's law collection. Suggested addition: “Optional discussion starter: use a Black Mirror scene to distinguish a reputation score from what it is intended to measure; then identify where the analogy fails.” | Confirm the unit's relevant lesson and responsible curriculum editor through the official [contact page](https://bluedot.org/contact). Its contact details are client-rendered and were not exposed by the research browser; no email address inferred. |
| P2 · AI Safety Atlas | [Chapter 6](https://ai-safety-atlas.com/chapters/v1/specification-gaming/introduction/) introduces optimization, Goodhart's law, and reward misspecification. It offers a relevant educational context; editorial interest is unconfirmed. | [Goodhart's law examples](https://cultural-alignment.com/concepts/goodharts-law). Suggested addition: “Optional cultural examples distinguish a proxy target from the intended objective, with caveats for each mapping.” | Identify the precise optimization passage and an appropriate editorial contact. The observed problem-report and feedback forms are not permission to use them for promotional pitches. |
| P2 · LessWrong | Its [community introduction](https://www.lesswrong.com/about) describes substantive reasoning and AI-safety discussion. A useful companion essay could invite critique of the archive's method. | Link two or three dossiers from an original essay on when cultural analogies clarify or distort AI concepts. Candidate contrast: [Teaching to the Test](https://cultural-alignment.com/scenarios/teaching-to-the-test) versus [AZ-5 Backfires](https://cultural-alignment.com/scenarios/az-5-backfires). | Draft and review a complete essay with substantive analysis and disclosed authorship before requesting publication approval. Avoid promotional link drops. |
| P3 · AISafety.com | Its [self-study collection](https://aisafety.com/self-study) lists curricula and reading lists and offers contribution routes. Cultural Alignment is an analogy archive, so eligibility is uncertain. | If editors accept supplemental reference resources, propose [the concept index](https://cultural-alignment.com/concepts): “A curated archive of film and TV scenes explaining AI safety concepts, with analysis and caveats.” | Ask whether a suitable category exists via its published correction route, with owner approval. Do not submit it as a course or create a course-shaped landing page to qualify. |

The archive's destinations above were checked against committed snapshot slugs. Before each approved send, load the production destination and confirm its current response, content, spoiler suitability, and canonical. Preserve each publisher's control over wording, placement, and link attributes; never make a backlink a condition of help.

## Prepared first pitch

For AISafety.info only, to adapt after checking its current editorial process:

**Subject:** A scene-based supplement for your Goodhart's law explainer

> Your explainer's school test-score example has a close fictional illustration in The Wire. I made Cultural Alignment, an archive that pairs familiar scenes with AI-safety ideas and explains where each analogy breaks.
>
> This dossier shows how the score replaces the learning objective: https://cultural-alignment.com/scenarios/teaching-to-the-test. Its caveat is that the people involved can recognize the broken metric while still facing pressure to optimize it.
>
> If useful for readers who learn through concrete examples, the proposed optional-reading sentence is in the table above. The concept collection has other examples: https://cultural-alignment.com/concepts/goodharts-law. These are illustrations rather than evidence about AI systems. Happy to leave this with you to judge for fit.

This text is a review artifact, not a sent message or saved email draft.

## Other work worth preparing

1. **Coverage analysis, if useful to educators.** Derive per-concept and per-source counts from the committed snapshot; record its Git revision and calculation method. Membership is many-to-many, so concept totals overlap. The archive is personally selected and cannot establish prevalence, probability, or teaching effectiveness. Do not invent a survey or promote a scene count as original safety research. Decide the reader's question before adding a public research page.
2. **One reusable original diagram.** A proxy → incentive → behavior → intended outcome diagram for the Goodhart examples could accompany an interested editor's lesson. Use original artwork, do not grant third-party film-still or clip rights, and retain the current code/data license distinctions. No asset created or publisher contacted.
3. **Mention reclamation after evidence.** Search `"Cultural Alignment" "AI safety"`, `"cultural-alignment.com"`, and the repository URL, excluding the site's own properties. Record the passage and confirm attribution is warranted before asking for a source link. Use Search Console's external-link export if the owner supplies it. Never infer that an absent search result proves no links exist.
4. **Historical URL checks only when justified.** The retired `/scenarios/family/*` routes deliberately return 404. Do not restore them or add redirects solely for a theoretical SEO benefit. If a real referring link is found, review whether the current risk-family page is an equivalent destination and propose the exact redirect separately.

## Approval and measurement

Suggested sequence, with no recurring automation created:

1. Review the local implementation and this plan. After approval to publish, deploy through the normal repository workflow and verify the public metadata again.
2. With Search Console access, record a baseline for indexed canonical pages, search impressions/clicks, and existing external links. Confirm `/sitemap.xml` is present in the correct property before deciding whether to submit it. Search Console data was unavailable in this run; no account or submission changes were made.
3. Approve the exact first three targets and messages. Check each contact route and record the send only after it succeeds. No generic bulk pitch, payment, or exchange offer.
4. After about four weeks, review accepted references, referral visits that reach a dossier, and editorial feedback. Compare search data over equal periods, accounting for deployments and newly synchronized content. These observations do not isolate a backlink's ranking effect.

Use one row per proposed or delivered reference with: prospect, referring page/section, proposed destination, reason it helps the reader, verified contact route, approval date, sent date, reply, published URL, link attributes, last checked date, referral observations, and next action. Initial records are the five unsent rows above. Stop on rejection; one follow-up at most if appropriate and separately authorized.

Success is a small number of useful references and better paths into the authored explanations. Raw link volume, domain-rating targets, and unverifiable AI-mention counts are not acceptance criteria.
