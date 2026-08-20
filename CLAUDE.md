# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js version warning

This project pins `next@16.2.11` with `react@19.2.4` — a version ahead of your training data. APIs, conventions, and file structure may differ from what you expect (e.g. route handler signatures, middleware, config options). Verify against `node_modules/next/dist/lib/**` or the installed types before assuming a Next.js 13/14-era API still applies, and prefer checking existing usage in this repo over recalling from memory.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build (type-checks the whole project)
npm run start    # run a production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no `test` script in package.json. The one test file (`tests/rate-limit.test.ts`) uses `node:test` and `node:assert` directly against TypeScript source — run it with Node's native TypeScript support, e.g.:
```bash
node --experimental-strip-types --test tests/rate-limit.test.ts
```
This requires **Node.js ≥22.6** (`--experimental-strip-types` doesn't exist before that). The CI workflow (`.github/workflows/e2e.yml`) runs on Node 20 and `package.json` declares no `engines` field, so this command is a local-only convenience for now, not something CI can run as-is.

`scripts/test-query.ts` and `scripts/test-retrieval.ts` are standalone manual scripts for poking at the live Pinecone index (they load `.env` via `dotenv` and call `getPineconeIndex()` directly) — not part of an automated suite.

## Architecture

P-X1 clusters user-submitted "problem" statements into semantic groups using vector search + LLM classification, then lets builders attach solutions to a cluster. Everything degrades gracefully to in-memory/mocked backends when external services aren't configured, so the app is fully runnable with zero API keys.

### Dual-store data model with automatic fallback

- **Pinecone** (`src/lib/pinecone.ts`) stores cluster *vector centroids* (`type: 'cluster'`) and raw problem embeddings (`type: 'problem'`), plus static cluster metadata (category, canonicalText). If `PINECONE_API_KEY` is unset/placeholder, or a call throws, every read/write silently falls back to an in-memory `Map` (`globalForDb.__p_x1_db`) keyed the same way — `isPineconeLive()` reports which mode is active.
- **MongoDB** (`src/lib/mongodb.ts`) stores *dynamic* cluster state (`memberCount`, `sampleVariants`, `userIds`, timestamps) and all solutions/reviews. In test env or when `MONGODB_URI` is unset, or on a 4s connect timeout, it falls back to an in-process mock DB (`createMockMongoDb`) implementing a small Mongo-like subset (`find`, `findOne`, `insertOne`, `updateOne` with `$set`/`$inc`/`$push`/`$pull`, etc.) — `isMongoDbLive()` reports which mode is active.
- `getClusters`/`getClusterById`/`searchClusters`/`getAdjacentClusters` in `pinecone.ts` fetch the vector-side record then call `joinMongoDataToClusters()` to merge in the Mongo-side dynamic fields and solutions before returning. When adding a cluster field, decide up front whether it's static (Pinecone metadata) or dynamic (Mongo) — most read paths assume this split.
- API responses go through `createResponse()` (`src/lib/response.ts`), which stamps `X-MongoDB-Status`/`X-Pinecone-Status` headers and demotes an otherwise-200 response to HTTP 203 whenever either store is running in fallback mode. Use `createResponse` instead of `NextResponse.json` for anything touching cluster/problem data so this signal isn't lost.

### AI provider abstraction

`src/lib/ai/` (`config.ts`, `types.ts`, `embedding-service.ts`, `llm-service.ts`) is a provider-agnostic layer selected via `LLM_PROVIDER` / `EMBEDDING_PROVIDER` env vars (`openai`, `anthropic`, `vertexai`, `nvidia`, `cerebras`, `openrouter`, plus `local-fallback` for embeddings — a deterministic hash-based vector generator needing no API key at all). `llm-service.ts`'s `classifyProblem()` is the single source of truth for the classification prompt/contract (`ClassificationResult`); all providers must parse into that same shape. Import from `@/lib/ai` (the barrel in `index.ts`), not individual provider files.

### Submission flow (`src/app/api/problems/route.ts`)

1. Clerk `auth()` gate → reject if unauthenticated.
2. Per-user sliding-window rate limit (`src/lib/rate-limit.ts`, Upstash Redis-backed, mocked when Redis env vars are absent) — separate minute and daily windows, both must pass.
3. `validateQuery()` (`src/lib/validation.ts`) enforces `NEXT_PUBLIC_MAX_QUERY_CHARS`.
4. Embed the text, `searchClusters()` for nearest centroid; if cosine score ≥ `NEXT_PUBLIC_SIMILARITY_THRESHOLD` it's treated as a match to an existing cluster, otherwise the LLM classifies it within the active categories or rejects it as out of scope — there's a two-step draft/confirm flow (`draft` flag, `confirmedCategory`/`confirmedCanonicalText`) so the UI can show the proposed classification before committing the cluster/problem write.

### Auth boundary

`src/proxy.ts` is the Clerk middleware entry point (not `middleware.ts` — check this file, not the conventional name, when touching route protection). Only `/api/problems(.*)` and `/api/search(.*)` are gated behind `auth.protect()`; everything else (browse, clusters, categories, seed) is public.

### Resilience conventions used throughout

- `fetchWithRetry()` (`src/lib/fetch-retry.ts`) wraps client-side fetches with timeout + exponential backoff/jitter, auto-escalating timeout to 60s for `/api/seed` and `/api/admin/stats`. Use it instead of bare `fetch` for calls into this app's own API routes from client components.
- Nearly every external-service call (Pinecone, Mongo, Redis) is wrapped in try/catch with a same-shape local/mock fallback rather than surfacing an error — preserve this pattern when adding new external calls so the app keeps working fully offline.
