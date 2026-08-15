# AGENTS.md — Project Context

**Project:** P-X1 / "NeedBoard" — Next.js 16 (App Router, TS, Tailwind v4, Framer Motion) prototype. Users submit problems; they get embedded, LLM-classified, and clustered via vector similarity (Pinecone + MongoDB, Clerk auth, Upstash rate-limiting).

## Session Log

### E2E tests converted to mocked API requests (offline, no DB/LLM)
- **`e2e/mock-api.ts`** (new): stateful in-memory fixture store + `installApiMocks(page, store)` intercepts all `/api/**` fetches via `page.route()` — no MongoDB/Pinecone/LLM needed. Handlers mirror server behavior: problem draft/finalize (match / new / gibberish / out-of-scope), clusters/categories/search, me-too (count++ + 409 repeat), solutions CRUD, upvote/downvote algebra, reviews. `setMockSession()` sets the `e2e_*` cookies the app's E2E auth bypass reads.
- **All 5 specs** (`submit-flow`, `search`, `navigation`, `me-too`, `solutions`) install mocks in `beforeEach`.
- **`playwright.config.ts`**: removed `globalSetup` + Mongo env vars; webServer only needs `NEXT_PUBLIC_E2E_TESTING=true`.
- **Deleted** `e2e/global-setup.ts` + `e2e/seed/`; rewrote `e2e/README.md`.

### `e2e/solutions.spec.ts`
- Modals: after publish/update, the solution form modal shows a success screen — tests click its "Close Window" button. Delete flow dismisses the AlertModal via "Dismiss" (`modal-cross-button` only exists on AlertModal).
- Order independence: new solutions get realistic `upvotes: 1`; edit/delete tests target the seeded `CrossSync Calendar Mock` (always sorts first); add test uses unique `E2E Novel App`. Each test passes in isolation.

### `e2e/search.spec.ts`
- Old `text=` assertion could pass without a result card rendering. Now asserts on the result card via `a[href="/cluster/cluster-e2e-flaky-tests"]` + canonical text + "Match Score:"; empty-state test asserts zero result cards.

**Status:** 12/12 E2E tests pass (~25-28s), fully offline. Lint errors (~222) are pre-existing in `src/` — not from these changes.