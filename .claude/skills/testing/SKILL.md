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
| `memberPage` | Logged in as role `"user"` |
| `adminPage` | Logged in as role `"admin"` |

Roles are only `"user"` and `"admin"` (`UserRole`). Also provided: `dbSeed` (runs the seed script before the test; requires `E2E_ALLOW_DB_WRITE=true`) and `db` (`DbHelper` for events/products). Auth flow tests (login itself) use `guestPage` plus the Mailpit helpers, in the `auth-flows` project (no stored session).

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
| `createUserSession(role, prefix?)` | Temp user + login + session; returns `{ userId, sessionToken, cleanup }` |
| `createUserSessionWithMembership(tier)` | Like `createUserSession("user")` plus a membership (`"associated"` / `"full"`) |
| `createDbSession(userId)` / `deleteDbSession(id)` | Insert / delete a session row for an existing user |
| `createTestUser(opts)` | User with preset consent/food/photo fields |
| `getUserById(id)` / `getUserIdByEmail(email)` / `getUserEmailById(id)` | Look up user rows, ids, login emails |
| `deleteUserByEmail(email)` | Delete user + login by email (Mailpit test cleanup) |
| `setUserConsentByEmail(email, consent)` | Update consent JSON for a user |
| `getGroupBySlug(slug)` / `createGroupInDb(opts)` / `deleteGroupInDb(id)` | Look up, create, delete a group |
| `addGroupMember(userId, groupId)` / `deleteGroupMember(...)` | Add / remove a group member |
| `addGroupRepresentative(userId, groupId)` / `deleteGroupRepresentative(...)` | Add / remove a group representative |
| `createScopeInDb({ parentPath, slug })` / `deleteScopeById(id)` | Create a scope (returns `{ id, path }`, e.g. `/e2e-region/`) / delete it |
| `createTestEvent(userId)` | Minimal event with one product |
| `createGroupEventInDb({ organizerId, title, groupId?, visibility?, past? })` | Event owned by a group (`global` / `group-only`), optionally past |
| `createTestEventWithProduct({ ownerId, isFuture?, participantCapacity?, title? })` | Event + product; returns `{ eventId, productId, cleanup }` |
| `setParticipationInDb(...)` | Set a user's RSVP for an event (yes/no/maybe) |
| `createTicketInDb({ buyerId, eventId, productId })` | Ticket (with transaction); returns the ticket id |
| `addParticipantToTicket(...)` | Add a participant row to an existing ticket |
| `createPostInDb(opts)` / `getPostByTitle(title)` / `deletePostByTitle(title)` | Post fixtures |
| `ensureNewsPage()` | Make sure the news page exists; returns `{ pageId }` |
| `createPageInDb(opts)` / `getPageBySlug(slug)` / `deletePageBySlug(slug)` | Page (with menu item) fixtures |
| `getPageContent(pageId)` | Parsed content blocks of a page |
| `deletePageAndMenuItems(pageId)` | Delete a page and its linked menu items |
| `createMenuItemInDb(opts)` / `deleteMenuItemById(id)` | Standalone menu item |
| `getMenuItemByUrl(url)` / `getMenuItemPosition(id)` | Read menu item rows / position |
| `createJobInDb({ suggestedBy, title?, status?, expiresAt? })` | Job row; returns `{ jobId, cleanup }` |
| `getJobById(id)` / `deleteJobById(id)` | Fetch id/title/status/suggested_by / delete |
| `createDealInDb(opts)` | Deal (name, description, logo, validUntil, steps?); returns `{ dealId, cleanup }` |
| `getDealByName(name)` / `deleteDealById(id)` | Fetch / delete a deal |
| `createQualificationTypeInDb(overrides?)` | Qualification type; returns `{ typeId, cleanup }` |
| `createQualificationInDb(userId, typeId, status?)` | User qualification (`pending` / `approved` / `rejected`) |
| `createQualificationTokenInDb(typeId, createdBy)` | Qualification token; returns `{ token, cleanup }` |
| `createMembershipInDb(userId, tier)` | Membership row; returns `{ membershipId, cleanup }` |
| `createElectionCycleInDb(overrides?)` | Election cycle; returns `{ cycleId, cleanup }` |
| `createElectionPositionInDb(cycleId, overrides?)` | Position in a cycle |
| `createElectionApplicationInDb(positionId, cycleId, userId, status?, adminNote?)` | Application |

`SHARED_E2E_EMAIL` is the shared login used by the auth setup project.

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

## Environment pitfalls

- e2e needs the Docker services from `docker-compose.yml`: Mailpit (email, `:8025`), MinIO (S3), stripe-mock. Start them with `docker compose up -d` before running; without them login, upload and checkout tests fail for environmental reasons.
- In sandboxed environments without Docker or outbound network, Stripe.js (loaded from the Stripe CDN) and S3 uploads can fail; those failures (checkout/payment-element, image upload specs) are environmental, not regressions. Run the unaffected specs and say which were skipped.
- Stale servers: never point e2e at an ambient dev server or the dev DB; use `E2E_PORT`/`DB_PATH` isolation. A leftover `my-database.test.db-shm/-wal` from a crashed run can be deleted along with the DB.
