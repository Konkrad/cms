---
name: testing
description: Use when planning, writing, running or debugging tests (Vitest unit tests in tests/unit, Playwright e2e in tests/e2e), editing tests/fixtures.ts, using role fixtures or DB helpers, logging in through Mailpit, running e2e in a sandbox, or when a commit fails on the pre-commit test run. Also for verifying runtime behavior of an endpoint or login flow.
---

# Testing

## Rules

- Every new feature requires a test plan before implementation begins. The plan must identify what to test (happy path, edge cases, error states), which test type to use (unit, integration, or e2e), and where the test files live.
- Unit tests go in `tests/unit/` and use Vitest: pure functions, service logic, utilities. They need no external services.
- E2E tests go in `tests/e2e/` and use Playwright (`testDir: "./tests/e2e"`): user-facing flows, form submissions, anything needing a real browser or server.
- Do not ship a feature without at least one automated test covering the primary happy path.
- Before considering a feature complete run the unit suite (`npx vitest run --no-file-parallelism`, or `npm run test:unit` for watch mode) and the e2e suite (`npx playwright test`, also `npm test`).
- Pre-commit hook (`.githooks/pre-commit`): runs Biome on staged files, then the full Vitest suite with `--no-file-parallelism` (`tests/vitest-global-setup.ts` shares one temp SQLite file across test files; parallel workers cause "database is locked"). e2e is excluded from the hook because it needs Docker services and a seeded DB; it runs in CI.
- Use Playwright to verify behavior when the user wants runtime confirmation or mentions endpoint behavior. For login tests use the Mailpit flow (`tests/utils/mailpit-client.ts`, API at `http://localhost:8025`) or the magic-link flow through `/login`.

## E2E fixtures: always import from `tests/fixtures.ts`

All e2e tests import `{ test, expect }` from `"../fixtures"` (relative to `tests/e2e/`). The `test` object provides role-based page fixtures:

| Fixture | Auth state |
|---|---|
| `guestPage` | No session cookie (unauthenticated) |
| `memberPage` | Logged in, no scope role, no membership |
| `adminPage` | Logged in as a root admin (admin role on the root scope = platform admin) |

`UserRole` is `"user"` or `"admin"` (= admin of the root scope); there is no `users.role`. Scope roles (admin, moderator, coordinator, representative) and memberships are granted with the scope helpers below. Also provided: `dbSeed` (runs the seed script before the test; requires `E2E_ALLOW_DB_WRITE=true`) and `db` (`DbHelper` for events/products). Auth flow tests (login itself) use `guestPage` plus the Mailpit helpers, in the `auth-flows` project (no stored session).

```typescript
import { test, expect } from "../fixtures";

test("admin can see the dashboard", async ({ adminPage: page }) => {
  await page.goto("/admin");
  await expect(page.locator("h1")).toBeVisible();
});
```

When a test needs the `userId` (e.g. to verify a DB column after a form submit), call `createUserSession(role)` directly and inject the cookie manually. Use the named DB helpers from `tests/fixtures.ts`; **never call `openDb()` or `new Database()` directly in a test file**:

```typescript
import { test, expect, createUserSession, getUserById } from "../fixtures";

test("saves profile picture", async ({ browser }) => {
  const session = createUserSession("admin");
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  try {
    // ... test ...
    const user = getUserById(session.userId);
    expect(user?.profile_picture as string).toMatch(/^https?:\/\//);
  } finally {
    await ctx.close();
    session.cleanup();
  }
});
```

### DB helpers in `tests/fixtures.ts`

Helpers named `create*InDb` / `create*` that return `cleanup()` should be cleaned up in `finally`/`afterEach`. If none covers your need, **add a new named helper to `tests/fixtures.ts`** (and to this table) rather than calling `openDb()` in the test.

| Helper | Purpose |
|---|---|
| `createUserSession(role, prefix?, { name, familyName }?, completed?)` | Temp user + login + session (+ root admin role for `"admin"`) with every user requirement completed (`completed`: `{ only?, except?, values? }`); returns `{ userId, sessionToken, cleanup }` |
| `createUserSessionWithMembership(tier)` | Like `createUserSession("user")` plus a membership (`"associated"` / `"full"`) |
| `createDbSession(userId)` / `deleteDbSession(id)` | Insert / delete a session row for an existing user |
| `createTestUser({ completed?, values? })` | Logged-in user with only the listed requirements completed (default none: gated to `/profile/setup`, asked at checkout); `GLOBAL_REQUIREMENTS` = profile, location, onboarding survey |
| `getUserById(id)` / `getUserIdByEmail(email)` / `getUserEmailById(id)` | Look up user rows, ids, login emails |
| `deleteUserByEmail(email)` | Delete user + login by email (Mailpit test cleanup) |
| `completeRequirementsByEmail(email, options?)` | Complete requirements for a user who logged in through Mailpit |
| `getUserRequirement(userId, id)` / `setRequirementVersion(userId, id, version)` | A stored completion (`value` parsed) / store it at an older version (as after a version bump) |
| `setActiveOnboardingForm(formId \| null)` | Set or clear the root's active onboarding form; returns the previous id to restore |
| `createScopeInDb({ parentPath, slug, name?, kind? })` / `deleteScopeById(id)` | Create a scope (a group: region, chapter…; returns `{ id, path, segment }`, e.g. `/e2e-region/`, `e2e-region`) / delete it with its subtree, roles, memberships, redirects, pages, jobs and deals (other content goes to the root: `scope_id` is NOT NULL) |
| `renameScopeInDb(id, slug)` | New slug for a scope, rewriting its subtree's paths (no redirect rows); references follow |
| `getScopeByPath(path)` / `adminSegmentOf(path)` | Look up a scope / its `/admin/[scope]` segment (`/a/b/` → `a.b`, `/` → `root`) |
| `addScopeMember(userId, scopeId)` / `removeScopeMember(...)` / `isScopeMember(...)` | Scope membership |
| `grantScopeRole(userId, scopeId, role)` / `revokeScopeRole(...)` / `getScopeRoles(userId, scopeId)` | Scope roles (`admin`, `moderator`, `coordinator`, `representative`) |
| `rootScopeId(db)` | Id of the root scope (created if missing) |
| `createTestEvent(userId)` | Minimal event with one product |
| `createScopeEventInDb({ organizerId, title, slug?, scopeId?, visibility?, past? })` | Event owned by a scope (`public` / `members` / `representatives`), optionally past; served at `<scope path>events/<slug>` (slug = id by default) |
| `createTestEventWithProduct({ ownerId, isFuture?, participantCapacity?, title? })` | Event + product; returns `{ eventId, productId, cleanup }` |
| `setParticipationInDb(...)` | Set a user's RSVP for an event (yes/no/maybe) |
| `createTicketInDb({ buyerId, eventId, productId })` | Ticket (with a free transaction); returns the ticket id |
| `createPendingTicketPaymentInDb({ buyerId, eventId, productId, unitPrice, quantity? })` | Pending ticket order + pending Stripe payment, as the checkout creates them; returns `{ paymentId, transactionId, cleanup }` |
| `getPaymentById(id)` / `getPaymentsBySubject(ref)` / `getTransactionStatus(paymentId)` | Payment rows (`subject_ref` = `events:event:<id>`) / the order's status |
| `addParticipantToTicket(...)` | Add a participant row to an existing ticket |
| `createNoteInDb({ body, userId, scopeId?, visibility?, subject?, publishedAt? })` | Published note (no title, no image); `subject: { type: "events:event", id }` attaches it to an item; returns the id |
| `createArticleInDb({ title, body, userId, scopeId?, visibility?, featuredImage?, subject?, publishedAt? })` | Published article (`featuredImage` = a public S3 key); returns the id |
| `getNotesByBodyText(text)` / `getArticleByTitle(title)` | Read notes (no title: find them by body text) / the newest article with a title |
| `deleteNoteById(id)` / `deleteArticleById(id)` / `deleteArticleByTitle(title)` | Delete notes and articles |
| `ensureNewsPage()` | Make sure the `/news` page (a Stream block, notes and articles) exists; returns `{ pageId }` |
| `createPageInDb(opts)` / `getPageBySlug(slug)` / `deletePageBySlug(slug)` | Page fixtures: a root page with a menu item, or with `scopeId` a scope's page (no menu item) |
| `getPageContent(pageId)` | Parsed content blocks of a page |
| `deletePageAndMenuItems(pageId)` | Delete a page and its linked menu items |
| `createMenuItemInDb(opts)` / `deleteMenuItemById(id)` | Standalone menu item |
| `getMenuItemByUrl(url)` / `getMenuItemById(id)` / `getMenuItemPosition(id)` | Read menu item rows (page items store `ref:core:page:<id>`) / position |
| `createJobInDb({ suggestedBy, title?, status?, expiresAt?, scopeId? })` | Job row (owned by the root unless `scopeId`); returns `{ jobId, cleanup }` |
| `getJobById(id)` / `deleteJobById(id)` | Fetch id/title/status/suggested_by / delete |
| `createDealInDb(opts)` | Deal (name, description, logo, validUntil, steps?, scopeId?); returns `{ dealId, cleanup }` |
| `getDealByName(name)` / `deleteDealById(id)` | Fetch / delete a deal |
| `createQualificationTypeInDb(overrides?)` | Qualification type; returns `{ typeId, cleanup }` |
| `createQualificationInDb(userId, typeId, status?)` | User qualification (`pending` / `approved` / `rejected`) |
| `createQualificationTokenInDb(typeId, createdBy)` | Qualification token; returns `{ token, cleanup }` |
| `createMembershipInDb(userId, tier)` | Membership row; returns `{ membershipId, cleanup }` |
| `createElectionCycleInDb(overrides?)` | Election cycle; returns `{ cycleId, cleanup }` |
| `createElectionPositionInDb(cycleId, overrides?)` | Position in a cycle |
| `createElectionApplicationInDb(positionId, cycleId, userId, status?, adminNote?)` | Application |
| `getOutboxRows({ notificationId?, recipientUserId?, channel? })` / `getOutboxRowById(id)` | Read `notification_outbox` rows |
| `createOutboxRowInDb(opts)` | Outbox row (e.g. a `failed` one for the admin view); returns `{ id, cleanup }` |
| `getNotificationPreference(userId, notificationId, channel)` | Stored preference (`null` = never toggled, i.e. enabled) |
| `createScopeEventInDb({ …, status })` / `getEventStatus(id)` | Event in a review state (`draft`, `in_review`, `published`) / its state |
| `getLatestReview(ref)` | Newest `reviews` row of an item (`{ id, status, comment }`) |
| `createFormInDb({ title, scopeId?, purpose?, schema? })` / `createFormResultInDb(formId, answers?)` | Form (a survey unless `purpose`) / a result (locks the form) |
| `getFormsByTitle(title)` / `deleteFormsByTitle(title)` / `getFormResultsBySubject(ref)` | Find / delete forms; answers stored by an item ref |
| `setEventDebriefRequested(eventId, daysAgo?)` | Mark an event's debrief as requested (what the daily schedule does) |
| `createRedirectInDb(from, to)` / `getRedirectTarget(from)` / `deleteRedirectsLike(prefix)` | `redirects` rows (old public path → new path) |

`SHARED_E2E_EMAIL` is the shared login used by the auth setup project. Seeded users, role fixtures and the shared session have completed every user requirement (`scripts/seed-requirements.ts`, versions checked by `tests/unit/requirements.spec.ts`); only `createTestUser` and new Mailpit logins hit the setup gate.

Role fixtures (`adminPage`, `memberPage`) create a temporary user per test and delete it, with its notes and articles, when the test ends: check content such a user creates within the same test (use `test.step` for a longer flow, e.g. `tests/e2e/social-web.spec.ts`).

Endpoint handlers (route `onGet`/`onRequest` delegating to module code, e.g. the social-web feed and actor) are unit-tested with `fakeRequestEvent(url, { method, headers, params })` from `tests/unit/request-event.ts` (`sent()` returns status, body, headers; `event.error` throws a `FakeHttpError` with `status`); `assertWellFormedXml` checks generated XML without a parser dependency.

## Running e2e

`playwright.config.ts` starts its own dev server on an isolated test DB: it reseeds with `npm run db:seed:test -- --fresh`, then `npm start -- --port $E2E_PORT`; `reuseExistingServer` is false, so the port must be free. Defaults: `E2E_PORT=5179`, `DB_PATH=<repo>/my-database.test.db`. Set both to isolate a run (parallel agents, a second checkout):

```bash
E2E_PORT=5280 DB_PATH=/tmp/e2e-5280.db npx playwright test

# Single file, skip auth setup
npx playwright test tests/e2e/pages.spec.ts --project chromium --no-deps

# Auth flow tests (no stored session)
npx playwright test --project auth-flows
```

Projects: `setup` (shared session), `auth-flows` (`auth.spec.ts`, `profile-setup.spec.ts`), `chromium` (everything else, stored session).

UI language: the default run is English. To check German, run the suite once with `SITE_LOCALE=de` on its own port and DB (`SITE_LOCALE=de E2E_PORT=5281 DB_PATH=/tmp/e2e-de.db npx playwright test`); `tests/e2e/i18n.spec.ts` reads `<html lang>` and expects that locale's strings, other specs assert English text and fail under `de` for that reason only. Unit tests always see the English catalog (no Vite plugin); test other locales with `createTranslator` / `buildCatalog` / `createFormatters` (`tests/unit/i18n.spec.ts`).

## Environment pitfalls

- e2e needs the Docker services from `docker-compose.yml`: Mailpit (email, `:8025`), MinIO (S3), stripe-mock. Start them with `docker compose up -d` before running; without them login, upload and checkout tests fail for environmental reasons.
- In sandboxed environments without Docker or outbound network, S3 uploads can fail; those failures (image upload specs) are environmental, not regressions. Run the unaffected specs and say which were skipped.
- Payments (spec 4.7): the checkout redirects to the provider (stripe-mock answers with a `checkout.stripe.com` URL; intercept it with `page.route`). Simulate the result with a signed webhook: `page.request.post("/api/payments/webhook/stripe", signedCheckoutEvent(paymentId))` (`tests/utils/stripe-webhook.ts`), then poll for the module's handler effect (it runs from `handler_calls` on the scheduler tick). Unit tests use `setPaymentProvider(fake | null)` and `applyPaymentChange` / `expireStalePayments` / `handlePaymentWebhook` from `~/core/payments/payments`.
- The scheduler (`schedules`, review handlers) ticks every 500 ms in e2e (`SCHEDULER_POLL_INTERVAL_MS`); poll for the effect of a review decision (`expect.poll(() => getEventStatus(id))`). Unit tests call `runDueSchedules` / `processHandlerCallsOnce(resolveHandlerCall)`.
- Emails and Telegram alerts (except the login email) are queued in `notification_outbox` and sent by the worker inside the e2e dev server (`NOTIFICATIONS_POLL_INTERVAL_MS=500` in `playwright.config.ts`), so poll Mailpit / the outbox (`getOutboxRows`) instead of expecting them right after an action. Unit tests never start the worker; call `processOutboxOnce()`.
- Stale servers: never point e2e at an ambient dev server or the dev DB; use `E2E_PORT`/`DB_PATH` isolation. A leftover `my-database.test.db-shm/-wal` from a crashed run can be deleted along with the DB.
