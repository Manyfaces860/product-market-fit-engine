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

### UI redesign per `new-ui-description.md` (branch `design/new-ui`)
- **Terminal data-entry surfaces:** new `.input-terminal` / `.input-terminal-teal` classes in `globals.css` — Geist Mono on ALL inputs/textareas/selects, frosted `slate-950/80` bg, hairline `white/10` border, amber (or teal) focus border + soft glow ring. Submit form shell gained the same `focus-within` amber glow the search bar already had.
- **Glassmorphic cards:** new `.glass-card` class (`backdrop-blur(24px)`) applied across home trending cards, browse/category rows, search results, cluster detail cards, dashboard panels, admin stat + panel cards — ambient canvas now shows through everywhere.
- **Eyebrows:** all section headers now use the `NN // SECTION NAME` micro-label format with colored icon chips (`p-2 bg-{color}-500/10 rounded-xl`): home 01–04, submit 00/01, browse/category/search `00 //`, cluster 00–03, dashboard panels 01–06, admin 00–04.
- **Disabled states:** amber-gradient CTAs now `disabled:opacity-30` (was 50); teal-gradient submits `disabled:opacity-50` + `pointer-events-none`.
- **Verified:** `npm run build` passes; `CI=1 npx playwright test` 12/12 pass (~22s, offline).

### UI redesign v3: FULL terminal console (user direction: "Full terminal console")
- **Mono everywhere:** `globals.css` `@theme` now remaps `--font-sans: var(--font-geist-mono)` — every `font-sans` utility renders Geist Mono (no classes needed per-element); unlayered `body` + `h1,h2,h3,.font-display` rules force mono over Tailwind's layered utilities (Playfair import stays in layout but is never applied). Verified via headless DOM probe: body, paragraphs, h1s, inputs ALL compute `Geist Mono`.
- **CRT overlay:** `.scanlines` fixed div (`z-50`, `pointer-events-none`, 3px repeating lines @ 0.025 white) added in `layout.tsx` after `<AmbientCanvas />` — do NOT remove (part of the terminal look).
- **HUD corner brackets:** `.hud-corners` (amber) / `.hud-corners-teal` (teal) classes — 4 corner brackets via layered `linear-gradient` backgrounds (14px, 0.65 alpha). Applied to: home About card + 3 console cards + 2 ecosystem cards, submit draft card (amber) + success card (teal), search shell (teal), cluster canonical + me-too cards, dashboard header card, admin 4 stat cards.
- **`$` prompts:** submit textarea wrapped with amber `$` prompt (flex row); search input's `Search` icon replaced by teal `$` span (import kept — header chip still uses it).
- **Header readout:** "SYSTEM ONLINE" — teal pulsing dot (`animate-pulse` + `shadow-[0_0_8px_rgba(45,212,191,0.8)]`) + 9px `tracking-[0.2em]` uppercase mono text, `hidden lg:flex`.
- **Glow bumps:** home hero badge `0.1`→`0.25`, primary CTA `0.2`→`0.35`, submit submit-button + cluster me-too button `0.3`, input focus glows `0.18`/`0.20` (was 0.08/0.10), search shell teal `focus-within` 0.15; terminal scrollbars (8px amber).
- **Gotcha:** `npm run dev` (E2E mode) surfaces compile errors as an HTTP 500 "This page couldn't load" — probing with `page.goto` returns no font/scanline data; check the dev log (`/var/folders/.../p-x1-dev.log`) for the actual compile error (hit: removed `Search` import while header chip still used it).
- **Verified:** `npm run build` passes; `CI=1 npx playwright test` 12/12 pass (~24s, offline). Dev server running at localhost:3000 (E2E mode) — user must hard-refresh (Cmd+Shift+R) to bypass stale cached CSS/HTML.

### Category focus: only Developer Tools & DX + SaaS & B2B Productivity (user direction)
- **`static-categories.ts`**: each category now has `status: 'active' | 'coming-soon'` — only `software-devtools` + `software-saas` are active; exports `isFocusedCategory(id)` + `focusedCategories`.
- **Browse page**: active cards first (sorted), coming-soon cards render dimmed (`opacity-60`) with Lock icon + "Coming Soon" pill + "Locked" footer, NOT links. `Category` interface gained `status?`.
- **`/browse/[category]`**: direct URL to a coming-soon category renders a locked panel (fetch skipped via early return in effect, `isComingSoon` in deps).
- **LLM**: system prompt now lists ONLY the 2 active categories; rule 5 rejects anything outside focus (no new-category proposals); post-parse guard force-invalidates any `isValid: true` result whose category isn't active. E2E mock unchanged (gibberish/cookies rejection intact) — `existingCategories` param now unused in real path (kept for signature compat).
- **`/api/problems`**: match path requires `isFocusedCategory(topMatch.category)` — cannot join coming-soon clusters.
- **Submit page**: `DEFAULT_TAXONOMY` trimmed to the 2 focused categories (dropdown + label fallback).
- **Verified:** build passes; 12/12 E2E green (mock fixtures + mock categories all use the two focused ids).

## Secrets Policy (MANDATORY)
- NEVER read, print, copy, or log values from `.env`, `.env.test`, `.env.prod`, or any key files (Clerk, MongoDB, OpenAI, Pinecone, Upstash, etc.).
- Allowed checks only: key-name presence (`grep -c`), format/prefix checks with values masked (e.g. `pk_test_<rest>`), never full values.
- NEVER commit env files or embed secrets in commits, logs, artifacts, test fixtures, or commit messages. Env files are gitignored — verify with `git check-ignore` if unsure.
- If a secret may have been exposed, tell the user to rotate it.