# NeedBoard End-to-End (E2E) Test Suite

This directory contains the automated E2E test suite for **NeedBoard** using **Playwright**.

The suite is **frontend-focused**: every `/api/**` request the pages make is intercepted
in-page by `e2e/mock-api.ts` and fulfilled from an in-memory fixture store. No real
MongoDB, Pinecone, or LLM providers are contacted, so the tests run fully offline,
deterministically, and at zero API cost.

## How the mocks work

* `e2e/mock-api.ts` ships a `createMockStore()` fixture store that mirrors the old seeded
  dataset (calendar-sync cluster @ 38 reports, flaky-tests cluster @ 54, one owned solution
  @ +5, one review, category aggregates).
* `installApiMocks(page, store)` registers a single `page.route('**/api/**')` handler that
  routes by method + path and reproduces server behavior, including stateful mutations:
  * `POST /api/problems` — draft analysis (match / new / gibberish / out-of-scope) and finalize (join or seed)
  * `GET /api/clusters` (+ `?category=`), `GET /api/clusters/[id]` (+ adjacent), `PATCH` me-too
  * `GET /api/search?q=` — keyword-matched semantic results
  * Solutions CRUD, upvote/downvote algebra, and reviews
* `setMockSession(context, opts)` writes the `e2e_*` session cookies the app's E2E auth
  bypass (`NEXT_PUBLIC_E2E_TESTING=true`) reads.
* The store is mutable, so multi-step flows (e.g., add → edit → delete a solution in
  `solutions.spec.ts`) carry state across tests just like a real database would.

## How to Run the Suite

### 1. Install Browsers
```bash
npx playwright install --with-deps chromium
```

### 2. Run (Playwright boots the dev server with E2E mode on)
```bash
npx playwright test
```

### 3. UI / Interactive Mode (Recommended for Debugging)
```bash
npx playwright test --ui
```

No environment variables or database connections are required. Optionally set
`BASE_URL` to point the suite at an existing deployment.

## Modular Test Coverage

* **`e2e/navigation.spec.ts`**: End-to-end navigation from landing to category browsing, opportunity details, and back.
* **`e2e/search.spec.ts`**: Semantic search retrieval for matching concepts and the empty state for unrelated queries.
* **`e2e/submit-flow.spec.ts`**: Drafting, similarity/merge path, novel cluster proposal path, and gibberish / out-of-domain rejections.
* **`e2e/me-too.spec.ts`**: Custom phrasing co-signing with dynamic report-count updates.
* **`e2e/solutions.spec.ts`**: Builder product creation, editing, deletion, and the upvote/downvote/removal lifecycle.