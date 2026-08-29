# Command-K search evaluation

Research date: 2026-08-29

## Recommendation

Use a two-stage plan:

1. **Keep the current local client-side architecture and fix corpus recall first.** Add explicit searchable taxonomy such as `genres`, `topics`, and `aliases` to media sources, or generate a reviewed `searchTerms` field during content sync. This is what makes a categorical query such as `anime` return every intended title reliably. A different lexical engine cannot infer a category that is absent from the indexed text.
2. **Choose Orama if true hybrid Command-K becomes worth its runtime cost.** [`@orama/orama`](https://www.npmjs.com/package/@orama/orama) is the best match in the starred-project audit: embedded, TypeScript, zero-dependency, browser-compatible, serializable, and supports full-text, vector, and hybrid retrieval in one API. Its important caveat is that an arbitrary typed query still needs an embedding at query time.

For semantic relationships on detail pages, precompute nearest-neighbor IDs during sync and ship only those relationships. This gains semantic discovery without shipping vectors or an embedding model to every browser.

## Distilled decision sheet

| Choice | What it adds | What it costs | Verdict |
| --- | --- | --- | --- |
| **Current implementation + richer indexed metadata** | No dependency, no runtime service, predictable ranking, exact control over category aliases, keeps the existing lazy 118 KB gzip payload | Still no typo tolerance, stemming, or arbitrary semantic retrieval; ranking remains custom and linear over the corpus | **Best immediate choice**. It directly fixes categorical recall and preserves the system's strongest architectural properties |
| **Orama** | Embedded BM25 full-text, typo tolerance, field weighting, filters, vector search, hybrid ranking, save/load; same library can cover lexical now and vectors later | A real semantic query needs a query vector at runtime; serialized vectors and a local embedding model materially increase client payload and cold-start cost | **Best strategic upgrade** and the only starred embedded package that cleanly spans keyword + vector + hybrid search |
| **MiniSearch** | Mature client-side full-text ranking, prefix/fuzzy search, field boosts, auto-suggest, zero dependencies, serialized indexes and async deserialization | Lexical only, slower maintenance cadence than Orama/Fuse/FlexSearch, and requires replacing hand-tuned result scoring | **Best conservative lexical replacement** if typo tolerance and a standard inverted index are desired without semantic scope |

Runner-up: modern [`fuse.js`](https://www.npmjs.com/package/fuse.js) is now a credible very-small lexical option because v7.5 adds multi-token fuzzy search with IDF-style ranking, a prebuilt index API, and optional workers. It is easier than a full search engine, but search remains linear and it has no vector layer. [`FlexSearch`](https://github.com/nextapps-de/flexsearch) is the throughput-oriented lexical alternative, but its extra configuration and persistence/worker surface do not buy much at 609 records and it has no semantic search.

## Current system and the `anime` symptom

The app already has a well-designed runtime boundary:

- Search is a dynamically imported client island and loads `/content/search-index.json` only when Command-K opens ([loader](../../features/search/global-search.tsx)).
- The generated index covers scenarios, media sources, risk families, and AI-safety concepts ([projection](../../lib/content/search-documents.ts)).
- Ranking is dependency-free and deterministic: normalized exact, prefix, word-prefix, substring, and all-token matching across weighted title, subtitle, and keyword tiers ([ranking](../../lib/content/search.ts)).
- The architecture deliberately has no runtime database or CMS credentials, and global search is local to the command palette ([architecture](../../docs/ARCHITECTURE.md)).

The checked-in corpus currently has 609 documents: 330 scenarios, 208 sources, 66 concepts, and 5 risk families. The JSON is 464,958 bytes raw and 118,468 bytes with gzip. A warmed local Node benchmark over 200 representative queries measured about 10.8 ms median and 11.9 ms p95 per query. That is not a browser benchmark, but it confirms that the current scan is plausible at this scale while consuming much of a 16.7 ms frame on slower devices.

The concrete recall problem is mostly metadata shape. [`SourceRecord`](../../lib/content/schema.ts) has `sourceType` but no genre, medium, country, topic, tag, or alias fields. Source search indexes title, `Movie`/`TV show`, description, and link labels. Therefore `anime` only matches sources whose description literally includes that word.

In this checkout, the generated index does contain three literal matches—_Neon Genesis Evangelion_, _One Piece_, and _Pokémon: The First Movie_—and `searchDocuments(documents, 'anime')` returns those three. If the running deployment returns zero, that indicates a stale/generated-index or loading/cache discrepancy worth diagnosing separately. It still will not return other anime titles whose descriptions omit the category.

The durable fix is a first-class indexed taxonomy, for example:

- curated Notion properties projected as `genres` / `formats` / `aliases`
- or a sync-time, checked-in `searchTerms` enrichment produced from source descriptions and reviewed like the rest of the snapshot

The same approach improves queries such as `cartoon`, `space opera`, `robot uprising`, `time travel`, and safety-concept synonyms without adding runtime infrastructure.

## Why sync-time document embeddings do not by themselves enable semantic Command-K

Vector retrieval compares a document vector with a **query vector**. Orama's vector API takes the query embedding in `vector.value`, and its hybrid API runs full-text and vector retrieval together ([official example](https://github.com/oramasearch/orama#vector-and-hybrid-search-support), [hybrid implementation](https://github.com/oramasearch/orama/blob/main/packages/orama/src/methods/search-hybrid.ts)). Typesense and Qdrant document the same requirement: a text query must be transformed into a dense vector before semantic retrieval ([Typesense](https://typesense.org/docs/29.0/api/vector-search.html#hybrid-search), [Qdrant](https://qdrant.tech/documentation/guides/)).

Generating document embeddings with OpenAI during content sync is compatible with the no-runtime-service rule, but arbitrary text typed later cannot be embedded ahead of time. The remaining choices are:

1. **No query embedding:** use lexical search over curated or generated aliases. This is the lightest and fastest path.
2. **Local browser query model:** load a transformer model, embed after a debounce, and merge its results with immediate lexical results. The starred `client-vector-search` package documents a roughly 30 MB default `gte-small` model, illustrating the cold-start cost ([README](https://github.com/yusufhilmi/client-vector-search#readme)).
3. **Self-hosted query-embedding endpoint:** preserves data control but adds runtime service operations and network latency.
4. **Hosted query-embedding API:** simplest technically, but contradicts the request to avoid external runtime services.

At 609 documents, 384-dimensional float32 document vectors alone are at least 935,424 bytes before serialization and index overhead. Orama serializes vectors as number arrays ([vector index source](https://github.com/oramasearch/orama/blob/main/packages/orama/src/trees/vector.ts)), so JSON will be larger. Its current embedded vector index performs an exact cosine scan, not ANN; that is completely reasonable at this corpus size, and the query model—not the vector scan—is likely to dominate latency.

## Candidate analysis

### 1. Current implementation plus search taxonomy

**Strengths**

- Zero third-party search dependency and no runtime service
- Small, reviewable API and deterministic ranking
- Already integrated with grouping, matched-context snippets, result highlighting, and the Command-K lifecycle
- Corpus and index are checked in and generated at the explicit sync boundary
- Easy to encode high-value product rules such as title > subtitle > aliases > long prose

**Weaknesses**

- Linear scoring over every document and every long keyword string
- No typo tolerance, stemming, BM25/IDF, synonyms, or semantic retrieval
- Recall depends completely on indexed content quality
- Hand-maintained scoring will grow more complex as requirements expand

**Best use**

Keep this for the next iteration. Add taxonomy/aliases and a small query regression set based on invariants, then measure whether users still need fuzzy or semantic recall.

### 2. Orama

Orama describes itself as a full-text, vector, and hybrid search engine that runs in the browser, server, or edge, is written in TypeScript, and has zero dependencies ([official introduction](https://docs.orama.com/docs/orama-js)). Its schema supports strings, arrays, enums, nested properties, and fixed-size vector fields ([schema and vector fields](https://docs.orama.com/docs/orama-js/usage/create)). It uses BM25 by default and exposes typo tolerance, field selection/boosting, filters, facets, and result limits through one search API ([search docs](https://docs.orama.com/docs/orama-js/search)).

The package is Apache-2.0 ([license](https://github.com/oramasearch/orama/blob/main/LICENSE.md)). As inspected, GitHub reports 10.5k stars, 400 forks, an August 2026 repository push, and no archive flag ([repository metadata](https://api.github.com/repos/oramasearch/orama)); npm reports the stable 3.1.x line with zero dependencies ([npm](https://www.npmjs.com/package/@orama/orama)). Repository `main` is already preparing 3.2.0, so pin a released version rather than copying unreleased examples.

**Fit for this app**

- Build the schema and insert documents during `pnpm content:sync`
- Call Orama `save`, check in the serialized object, and create/load it lazily when Command-K opens; the library's save/load path is first-class and covered by tests ([serialization source](https://github.com/oramasearch/orama/blob/main/packages/orama/src/methods/serialization.ts), [round-trip tests](https://github.com/oramasearch/orama/blob/main/packages/orama/tests/serialization.test.ts))
- Use full-text mode first with boosted `title`, `subtitle`, `aliases`, and shorter body/search-term fields
- Add an `embedding: vector[d]` property later without changing libraries
- If hybrid search is added, show lexical results immediately and only replace/fuse them after a debounced query embedding is available

**Risks**

- Hybrid quality still needs an evaluation set and weight tuning; Orama's default embedded implementation currently uses a fixed 0.5/0.5 text/vector blend unless weights are supplied ([source](https://github.com/oramasearch/orama/blob/main/packages/orama/src/methods/search-hybrid.ts))
- Its “less than 2 KB” statement refers to the tree-shakeable engine claim, not the generated index, vectors, or an embedding model; measure the actual Next.js chunk and serialized index
- Loading an embedding model when the palette opens would be a large regression relative to today's 118 KB gzip index

### 3. MiniSearch

MiniSearch explicitly targets real-time “search as you type” where the index lives in browser memory. It supports exact, prefix, and fuzzy matching, field boosts, auto-suggest, modern ranking, dynamic updates, and zero external dependencies ([official docs](https://lucaong.github.io/minisearch/)). It can serialize via `JSON.stringify`, restore synchronously with `loadJSON`, or restore asynchronously in batches to avoid blocking the main thread ([API](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html#loadJSONAsync)).

The TypeScript repository is MIT, not archived, and was last pushed in September 2025 ([metadata](https://api.github.com/repos/lucaong/minisearch)); npm's current package is 7.2.0 and includes TypeScript declarations ([npm](https://www.npmjs.com/package/minisearch)). This is a healthy stable package, though its release cadence is quieter than the other maintained lexical candidates.

**Fit for this app**

- It maps directly to the current document model and can preserve the lazy static-index architecture
- Prefix/fuzzy search would improve typos and incomplete typing with far less bespoke ranking code
- It still needs explicit `anime` metadata and offers no path to vector search, so choosing it means accepting a separate future semantic layer

### 4. Fuse.js

Fuse.js is a lightweight, zero-dependency, browser/server fuzzy search package written in TypeScript. Stable v7.5 adds token search that splits multi-word queries, fuzzy-matches terms, and uses BM25-style IDF weighting; the package documents full and basic builds at roughly 8.6 KB and 6.8 KB gzip ([npm](https://www.npmjs.com/package/fuse.js), [token search](https://www.fusejs.io/token-search.html)). It can prebuild an index with `Fuse.createIndex`, and its official performance guide states that search remains linear in indexed entries ([performance](https://www.fusejs.io/performance.html)).

It is actively maintained—the repository was pushed in August 2026 and `main` is preparing 7.6 beta ([metadata](https://api.github.com/repos/krisk/Fuse)). It is a good low-risk way to add typo tolerance. MiniSearch is still a better conceptual match for full-text document retrieval and serialization, while Fuse is the easier drop-in for small lists.

### 5. FlexSearch

FlexSearch 0.8 is an active browser/Node full-text engine with document indexes, partial and phonetic matching, suggestions, export/import, worker indexes, and browser persistence. Its official build table ranges from about 4.5 KB gzip for the light build to 16.3 KB for the full bundle ([README](https://github.com/nextapps-de/flexsearch#readme)); repository `main` is on the 0.8.x line and was pushed in June 2026 ([package](https://github.com/nextapps-de/flexsearch/blob/master/package.json), [metadata](https://api.github.com/repos/nextapps-de/flexsearch)).

This is attractive for large lexical corpora or when workers/IndexedDB are genuinely needed. For this 609-document command palette, it is more configuration surface than MiniSearch or Fuse and offers no vector search.

### 6. LanceDB

LanceDB is the strongest “embedded database” alternative in the broader starred results. Its JavaScript SDK offers vector search, full-text search, and the primitives needed for hybrid result fusion ([SDK](https://lancedb.github.io/lancedb/js/), [full-text API](https://lancedb.github.io/lancedb/js/classes/Index/)). It is active, Apache-2.0, and npm reports a recent 0.37.x release ([npm](https://www.npmjs.com/package/@lancedb/lancedb)).

It is not a browser library. Installation downloads a native platform binary, its package supports Node 22 on desktop/server operating systems, and it peers on Apache Arrow ([package source](https://github.com/lancedb/lancedb/blob/main/nodejs/package.json)). Adopting it would require a Next.js server endpoint plus persistent local/object storage semantics, cutting across the current no-runtime-database boundary. It is excellent technology for a much larger server-side corpus, but not for this Command-K.

## Starred-project audit

The supplied GitHub query currently returns 123 starred repositories across all languages and 38 when filtered to TypeScript ([all results](https://github.com/transitive-bullshit?submit=Search&q=search&tab=stars&type=&sort=&direction=&submit=Search), [TypeScript filter](https://github.com/transitive-bullshit?tab=stars&q=search&language=typescript)). The relevant results divide cleanly:

| Category | Projects | Assessment |
| --- | --- | --- |
| **Direct embedded packages** | `oramasearch/orama`, `lucaong/minisearch`; broader-language results also include `krisk/Fuse` and `nextapps-de/flexsearch` | Serious candidates evaluated above |
| **Embedded semantic prototype** | `yusufhilmi/client-vector-search` | Browser/Node vector search, but last source push was May 2024; its own roadmap still lists HNSW and a proper test suite as TODOs ([README](https://github.com/yusufhilmi/client-vector-search#roadmap), [metadata](https://api.github.com/repos/yusufhilmi/client-vector-search)). Do not adopt |
| **Local search product/CLI, not a palette library** | `tobi/qmd`, `Ryandonofrio3/osgrep`, `unigraph-dev/unigraph-dev` | Useful architectural examples, not lightweight client dependencies. QMD combines BM25, vectors, RRF, and reranking locally, but depends on SQLite/native vector and llama runtimes and targets a CLI/daemon ([README](https://github.com/tobi/qmd#readme), [package](https://github.com/tobi/qmd/blob/main/package.json)) |
| **Hosted-service clients or UI adapters** | Algolia `autocomplete` / `instantsearch` / `react-instantsearch`, Exa projects, Firecrawl, Tavily, Upstash projects, `meilisearch-js-plugins` | Require a hosted or separately deployed backend; not self-contained search indexes |
| **Example applications / old proofs of concept** | `yt-semantic-search`, `bens-bites-ai-search`, `beerose/semantic-search`, `wishful-search`, `scira`, `morphic`, `deep-research` | Some illustrate indexing or semantic UX, but they are applications rather than maintained embeddable engines; several have not been pushed since 2023–2024 |
| **Unrelated uses of “search”** | `nuqs` (URL search params), `serpbear` (rank tracking), `movier` (IMDb API), routers/agent tool search | Keyword matches in the stars filter, not local document-search engines |

The non-TypeScript starred list also includes Meilisearch, Typesense, Qdrant, Chroma, Weaviate, Milvus, OpenSearch, Sonic, and Quickwit. These are credible self-hosted systems, but they run as a separate process/database and are designed for far larger operational workloads. Meilisearch and Typesense both support keyword + semantic hybrid search ([Meilisearch](https://www.meilisearch.com/products/hybrid-search), [Typesense](https://typesense.org/docs/29.0/api/vector-search.html#hybrid-search)); Qdrant supports dense/sparse fusion and self-hosting ([hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/), [installation](https://qdrant.tech/documentation/installation/)). At 609 static records, their process, deployment, security, monitoring, and network-hop costs dominate any retrieval benefit.

## Suggested rollout

### Phase 1: fix recall with the current engine

1. Add source `genres` / `aliases` / `searchTerms` at the content boundary.
2. Include them in generated search keywords and add invariant tests that category terms resolve to every currently tagged item without hard-coding titles or counts.
3. Diagnose why the running `anime` query can show zero while the checked-in index and pure search function return three.
4. Capture a small relevance set of real queries and judged results before changing ranking engines.

### Phase 2: lexical engine bake-off

Run the same corpus and judged queries through current, Orama full-text, and MiniSearch. Compare:

- top-5 / top-10 recall and reciprocal rank
- typo, prefix, multi-token, and category-query quality
- cold index load/parse time on a throttled phone
- p50/p95 keystroke-to-results latency
- JavaScript chunk plus compressed serialized-index size

If Orama full-text wins or ties, it is the cleanest future-proof choice. If the current enriched engine wins and remains under the latency budget, keep it.

### Phase 3: semantics where it has clear value

- During content sync, embed scenario/source/concept text, compute top related IDs, and store those compact edges for detail pages.
- For Command-K, first try sync-time generated aliases and concept phrases.
- Only add true hybrid typed-query search if measured queries still fail. Keep lexical results immediate, debounce semantic work, cache query embeddings, and load a local model only after explicit search activation.

This ordering preserves the current implementation's simplicity and speed while keeping Orama as a credible migration path rather than paying semantic-search costs before the product demonstrates a need for them.
