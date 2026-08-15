# NeedBoard End-to-End (E2E) Test Suite

This directory contains the robust, automated E2E test suite for **NeedBoard** using **Playwright**.

---
You are an expert QA and Frontend Automation Engineer. Set up a robust, automated End-to-End (E2E) test suite using Playwright and GitHub Actions for this Next.js project ("NeedBoard" — a two-sided marketplace where reporters submit real-world problems, the backend clusters them via embeddings, and builders submit solutions against validated clusters).

Execute the following steps end-to-end.

### 1. Application Analysis & Flow Identification

* Inspect the pages, components, API routes, and state logic in this repository.
* Identify the core critical user flows that must be tested to prevent regressions. At minimum, confirm whether these flows exist and test each one that does:
  - **Submit flow**: draft submission → similarity check → merge-into-existing-cluster path vs. create-new-cluster path → validation rejection (too short / gibberish) → out-of-domain rejection
  - **Search flow**: synonym/semantic query returning a matching cluster; an unrelated query returning zero results
  - **Solution submission**: a builder submitting a product against an existing cluster, including required-field validation
  - **Me Too flow**: adding a custom phrasing to an existing cluster and confirming the report count updates
  - **Navigation**: category browse view → cluster detail view → back to browse
  - Any auth/login gating on these actions — **explicitly check whether any of these flows require a logged-in user**, and if so, document how test sessions should authenticate (test account, mocked session, API-based login) before writing the specs

This suite runs against a dedicated **testing MongoDB database** (connection string provided via env var, e.g. `MONGODB_URI` — never hardcoded) that is separate from production, and against a dedicated **`test/production-vercel`** branch: all changes land there first, the E2E suite runs against that deployment, and only after it passes green does the same change get promoted to the production branch. Treat this branch + DB pairing as the safety gate the whole workflow depends on — the CI config in Step 5 must trigger on this branch specifically.
* Document the flows you found (and any assumed-but-missing ones) in a short markdown summary before writing test code, including which flows are currently untestable and why (e.g., no accessible locators, flow doesn't exist yet).

### 2. Test Data Strategy (address before writing specs)

* The testing MongoDB is **wiped and reseeded on every suite run** — build around this rather than around tagging/cleanup of leftover data. Specifically:
  - **Global setup hook**: use Playwright's `globalSetup` (in `playwright.config.ts`) to wipe the test DB and insert a known seed dataset before any spec runs — not per-test, since a per-test wipe would race with parallel workers and defeat the point of a shared baseline.
  - **Seed script**: write this as a standalone script (e.g., `e2e/seed/reset-and-seed.ts`) that connects using `MONGODB_URI`, drops/clears the relevant collections, and inserts a fixed, known set of categories, clusters, and a test user account. Keep this script runnable standalone too, so it can be used for local dev without going through Playwright.
  - **Design the seed data around the flows in Step 1** — e.g., seed at least one pre-existing cluster with a known canonical text and report count so the "near match / merge" and "search finds an existing cluster" tests have something deterministic to match against, without depending on a prior test case (like a "1E" step) to create it first.
  - **Flakiness from AI-dependent behavior**: the submit and search flows depend on real embedding similarity calls even against seeded data, which is inherently less deterministic than typical UI state. Where possible, assert on structural outcomes (a result appeared, a cluster was created, a count incremented) rather than exact similarity scores, and note anywhere a test may need a wider retry/timeout allowance because of this.
  - **Run-tagging is optional but still cheap insurance**: even with a full wipe/reseed, prefixing dynamically-created test input (e.g., new clusters created mid-suite) with a marker like `[E2E-TEST]` makes failures easier to read in DB inspection without extra cleanup cost.

### 3. Frontend Locators & Testability

* Review the existing TSX/JSX components for the identified flows.
* Prefer accessibility-first locators: `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`.
* Where a complex or dynamic element lacks a reliable accessible role or text, add a `data-testid="..."` attribute directly to the relevant TSX component — make these edits minimal and non-visual (no structural or styling changes as a side effect).
* Do NOT rely on brittle CSS or Tailwind utility classes for selection.
* List every file you modify to add `data-testid` attributes, so the diff is easy to review.

### 4. Playwright Setup & Test Code Generation

* Install and configure `@playwright/test` if not already present; pin the version in `package.json` rather than leaving it floating.
* Create `playwright.config.ts` configured to:
  - Use `process.env.BASE_URL || 'https://test.needboard.space'` as the default `baseURL` (this should resolve to whatever Vercel preview/deployment URL corresponds to the `test/production-vercel` branch).
  - Read `MONGODB_URI` and any auth test-account credentials from `process.env` — never hardcode connection strings or credentials in the config or specs.
  - Capture screenshots on failure and traces on first retry.
  - Run in headless Chromium only for now.
  - Set a reasonable global timeout and a slightly extended `expect` timeout for the AI-dependent flows identified in Step 2.
  - Set retries to at least 1 in CI to absorb transient flakiness, and 0 locally.
* Create an `e2e/` directory with modular specs (`test.describe` / `test` blocks) per flow, named by flow (e.g., `submit-flow.spec.ts`, `search.spec.ts`, `solutions.spec.ts`, `me-too.spec.ts`).
* Include at least one negative/edge-case test per flow where applicable (validation errors, empty states, out-of-domain rejection), not just happy-path coverage.
* Add a short `e2e/README.md` explaining how to run the suite locally, including any required environment variables or test credentials.

### 5. GitHub Actions CI/CD Integration

* Create or update `.github/workflows/e2e.yml` to run on pushes and pull requests targeting **`test/production-vercel`** (this branch is the gate — tests must pass here before the same change is manually promoted to the production branch).
* Scope the job to a GitHub **Environment** (e.g., `testing`) so secrets are environment-restricted rather than exposed repo-wide, especially since fork-originated PRs should not have access to real test credentials.
* Include:
  - Node.js setup with dependency caching.
  - `npm ci` for install.
  - `npx playwright install --with-deps` for browser binaries.
  - Run the DB wipe-and-seed script (`e2e/seed/reset-and-seed.ts` or equivalent) against `MONGODB_URI` before the test step — either as its own workflow step, or confirm it's invoked automatically via Playwright's `globalSetup` so it doesn't need a separate CI step. Pick one and be consistent; don't do both (risk of double-seeding).
  - `npx playwright test`, with:
    - `BASE_URL: 'https://test.needboard.space'`
    - `MONGODB_URI: ${{ secrets.MONGODB_URI }}`
    - Auth test-account credentials pulled from `${{ secrets.* }}` (e.g. `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`) — never hardcoded, and ideally a dedicated throwaway test account rather than any real one.
  - Upload of the Playwright HTML report and trace/screenshot artifacts on failure, with a sensible retention period (e.g., 7 days).
  - A job-level timeout so a hung test can't block CI indefinitely.

### 6. Output

Before writing any code, respond with:
1. The list of critical flows identified (and any flows you expected to find but couldn't, with a reason).
2. Your seed dataset design (which categories/clusters/accounts get seeded, and why each one is needed for a specific test) and whether wipe-and-seed runs via `globalSetup` or a separate CI step.
3. Whether auth is required for any flow, which env vars/secrets it needs, and how the specs will authenticate.

Then implement the config, specs, `data-testid` edits, and workflow file, listing every file created or modified at the end.
## 🚀 Key Architectural Advantages

1. **100% Offline & Deterministic Clerk Mocking:**
   Instead of using flaky, slow, and rate-limited live authentication servers (which fail in CI and block parallel execution), we utilize a high-performance **testing bypass**. When `NEXT_PUBLIC_E2E_TESTING=true` is set, Clerk’s client hooks and backend middleware are bypassed seamlessly by reading simulated session cookie indicators (`e2e_user_id`, `e2e_user_name`, `e2e_user_role`). Playwright logs in instantly in **microseconds** simply by appending cookies to the browser context!
2. **Zero-API Cost LLM Fallbacks:**
   We patched the LLM and Embedding services with an offline testing fallback. It produces highly accurate, mathematical unit-vector cosine similarities and responds to gibberish/out-of-scope complaints deterministically without executing live, paid external API calls.
3. **Database Sandboxing:**
   Tests run against a isolated sandbox database. The sandbox database is **wiped and reseeded exactly once** before the test suite starts executing (using Playwright's `globalSetup` hook) to ensure parallel test workers operate on a identical, pristine baseline.

---

## 🛠️ Local Prerequisites

To run these tests locally, ensure you have a local or test MongoDB connection string ready (e.g., inside `.env` or in process variables):

```bash
MONGODB_URI=mongodb://localhost:27017/needboard-e2e
# MONGODB_DB_TEST is the collection target (can be custom sandbox)
MONGODB_DB_TEST=needboard-e2e
```

---

## 🎯 How to Run the Suite

### 1. Install Browsers
Make sure Playwright has its standard local browser binary engines installed:
```bash
npx playwright install --with-deps chromium
```

### 2. Run Local Development Server + Suite (Unified Command)
Playwright is configured to automatically launch the Next.js dev server on port `3000` with the E2E mock bypass active if no `BASE_URL` is configured:
```bash
npx playwright test
```

### 3. Run in UI/Interactive Mode (Recommended for Debugging)
To step through tests visually and inspect DOM locators, network calls, and console logs:
```bash
npx playwright test --ui
```

### 4. Run Standalone Standalone Seeding (Optional)
If you want to reseed your local dev database without executing any specs:
```bash
npx tsx e2e/seed/reset-and-seed.ts
```

---

## 📁 Modular Test Coverage

* **`e2e/navigation.spec.ts`**: Tests the end-to-end user navigation journey from landing to category browsing, opportunity details, and back.
* **`e2e/search.spec.ts`**: Verifies high-accuracy semantic search retrieval for seeded concepts and empty states for unrelated queries.
* **`e2e/submit-flow.spec.ts`**: Validates drafting, similarity/merge detection path, novel cluster proposal path, and out-of-domain/gibberish validation rejects.
* **`e2e/me-too.spec.ts`**: Asserts custom phrasings can be co-signed, incrementing vote counts dynamically while enforcing creator-block guardrails.
* **`e2e/solutions.spec.ts`**: Verifies builder product creations, required fields, and the unified voting upvote/downvote/removal lifecycle.
