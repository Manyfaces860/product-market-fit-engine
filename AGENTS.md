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

### CI pipeline: local dev server + mocked APIs (fully offline)
- `.github/workflows/e2e.yml`: was testing the deployed Vercel site (`BASE_URL`) — hung because the deployed build lacked `NEXT_PUBLIC_E2E_TESTING=true` (build-time flag) and real Clerk JS from `clerk.accounts.dev` blocked page loads. Now: no `BASE_URL`, suite boots its own `npm run dev` via Playwright webServer, fully offline. Triggers on push/PR to `develop` only.

### Clerk fully bypassed in E2E mode (no keys needed anywhere)
- `src/lib/clerk.tsx`: `ClerkProvider` is now conditional — pass-through when `NEXT_PUBLIC_E2E_TESTING === 'true'`, real provider otherwise.
- `src/proxy.ts`: middleware is a no-op (`() => NextResponse.next()`) in E2E mode — critical, because `clerkMiddleware` in @clerk/nextjs v7 throws `Missing publishableKey` on every request before any in-handler guard can run.
- `src/components/Loader.tsx` + `src/app/admin/dashboard/page.tsx`: `useUser` now from `@/lib/clerk` (delegates to real Clerk when flag unset).
- `playwright.config.ts`: webServer timeout `process.env.CI ? 120000 : 60000`.
- Verified keyless: moved `.env*` aside + `CI=1 npx playwright test` (forces fresh server, no reuse) → 12/12 pass. NOTE: `reuseExistingServer: !process.env.CI` — plain `npx playwright test` locally REUSES any running dev server, which can make keyless verification invalid.

### Branch reorganization (remote)
- Remote renamed `test/production-vercel` → `develop`; feature branches deleted (already merged). `main` = old merged state `36d11a0`.
- Local branch renamed to `develop`; `git fetch --prune` cleaned stale `origin/*` refs (local feature branches kept).
- `.github/workflows/e2e.yml` triggers updated to `develop`.

### Merge develop → main (LOCAL ONLY, NOT PUSHED)
- `main` fast-forwarded to `265479e` (identical to develop). Working tree had a stale hybrid `e2e.yml` — discarded before merge.
- Prod-mode verification: `npm run build` passes; `npm run start` serving localhost:3000; home/search/submit/dashboard → 200; real Clerk JS loads from `clerk.accounts.dev`; `/api/search` + `/api/problems` → 401 unauthenticated (proxy guard intact); zero publishableKey errors.
- **Pending**: push `main` only on explicit user command.

### Clerk dev → prod mode
- All env files (`.env`, `.env.test`, `.env.prod`) currently use TEST keys (`pk_test_`/`sk_test_`) — that's why prod shows dev mode.
- Switch: Clerk dashboard → API Keys → "Go live" (needs billing) → set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...` + `CLERK_SECRET_KEY=sk_live_...` in Vercel Production env → redeploy; whitelist prod domains in Clerk → Domains.

**Status:** CI green on `develop` (12/12, ~38s, keyless); `main` merged locally, not pushed; prod server running at localhost:3000 for manual Clerk testing.

## Secrets Policy (MANDATORY)
- NEVER read, print, copy, or log values from `.env`, `.env.test`, `.env.prod`, or any key files (Clerk, MongoDB, OpenAI, Pinecone, Upstash, etc.).
- Allowed checks only: key-name presence (`grep -c`), format/prefix checks with values masked (e.g. `pk_test_<rest>`), never full values.
- NEVER commit env files or embed secrets in commits, logs, artifacts, test fixtures, or commit messages. Env files are gitignored — verify with `git check-ignore` if unsure.
- If a secret may have been exposed, tell the user to rotate it.