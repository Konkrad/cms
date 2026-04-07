# Testing

Two independent test suites cover different layers of the application.

---

## Vitest — component & integration tests

**Command:** `npm run test:unit`  
**Watch mode:** `npm run test:unit:watch`  
**Config:** `vitest.config.ts`  
**Files:** `src/**/*.spec.{ts,tsx}`, `tests/unit/**/*.spec.{ts,tsx}`

### What it tests

| Area | How |
|---|---|
| Qwik components | `createDOM()` from `@builder.io/qwik/testing` — renders in a simulated DOM, no browser |
| Service functions | Import and call directly, assert return values |
| Email templates | Render to HTML string, assert content |
| DB queries | Against a real SQLite test DB file, no server needed |

### External services

Vitest starts **real containers** via testcontainers (`tests/vitest-global-setup.ts`) before the test run and stops them after:

| Container | Purpose | Env vars injected |
|---|---|---|
| `axllent/mailpit` | Receives outgoing SMTP, queryable via API | `SMTP_HOST`, `SMTP_PORT`, `MAILPIT_API_URL` |
| `minio/minio` | S3-compatible storage | `AWS_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` |
| `stripe/stripe-mock` | Stripe API responses | `STRIPE_API_BASE_URL`, `STRIPE_SECRET_KEY` |

**No manual setup required.** Docker must be running. There is no shared or persistent state between runs; each run gets fresh containers.

### Database

Vitest tests use a local SQLite file (`my-database.db`). The path is resolved from the repo root automatically — `process.env.DB_PATH` overrides it if needed (useful in CI with a temp DB). Tests that write to the DB should create and clean up their own rows.

### CI compatibility

✅ Runs in CI with Docker available (GitHub Actions `services:` or a docker-in-docker runner). No browser, no live server required.

---

## Playwright — full browser E2E tests

**Command:** `npm run test:e2e`  
**Config:** `playwright.config.ts`  
**Files:** `tests/e2e/**/*.spec.ts`, `tests/admin-pages.spec.ts`, `tests/onboarding-personal.spec.ts`

### What it tests

| File | Area |
|---|---|
| `e2e/auth.spec.ts` | Magic link login, 6-letter code login |
| `e2e/events.spec.ts` | Event public page, RSVP, checkout, waitlist, sold-out |
| `e2e/groups.spec.ts` | Group public view, join, admin promotion |
| `e2e/tickets.spec.ts` | Free ticket, RSVP, paid ticket + Stripe webhook |
| `e2e/profile-setup.spec.ts` | Setup redirect, profile/location steps, checkout consent |
| `admin-pages.spec.ts` | Admin page CRUD (create, publish, delete) |
| `onboarding-personal.spec.ts` | Onboarding page renders without console errors |

### Prerequisites

A running dev server on `http://localhost:5173` (or `BASE_URL` env var) and:

| Service | How to start |
|---|---|
| Mailpit (SMTP + API) | `docker-compose up -d mailpit` |
| Minio (S3) | `docker-compose up -d minio` |
| Stripe mock | `docker-compose up -d stripe-mock` |
| Dev server | `npm run dev` |

Tests that use mailpit (`waitForEmailHtml`) send a real magic link through the app and poll the mailpit API. Tests that inject a session directly into SQLite skip the login flow entirely and are faster.

### Database

Playwright tests share the same `my-database.db` as the dev server. Tests create and clean up their own rows directly via `better-sqlite3` (no ORM). The `E2E_ALLOW_DB_WRITE=true` guard must be set to prevent accidental writes to a developer's DB.

```bash
export E2E_ALLOW_DB_WRITE=true
npm run test:e2e
```

### Seeding

Most tests create all required data inline. If a test suite needs a pre-seeded baseline (admin user, known events) use the E2E seed runner:

```bash
E2E_ALLOW_DB_WRITE=true node scripts/run-seed.js
```

For local development (not tests):

```bash
node scripts/run-seed-dev.js
```

### CI compatibility

⚠️ Requires Docker (for mailpit/minio/stripe-mock), a running app server, and `E2E_ALLOW_DB_WRITE=true`. Not suitable for lightweight CI runners without Docker. On GitHub Actions use a matrix job with `services:` definitions or run docker-compose in a setup step.

---

## Summary

| | Vitest | Playwright |
|---|---|---|
| Browser required | No | Yes (Chromium, headless) |
| App server required | No | Yes |
| External services | Auto-started via testcontainers | Manual / docker-compose |
| DB | Own rows, SQLite file | Shared `my-database.db`, `E2E_ALLOW_DB_WRITE=true` |
| Test isolation | Per-test row cleanup | Per-test row cleanup |
| CI with Docker | ✅ | ✅ (needs more setup) |
| CI without Docker | ✅ (component tests only, skip global setup) | ❌ |
| Speed | Fast (no browser) | Slow (browser + network) |
