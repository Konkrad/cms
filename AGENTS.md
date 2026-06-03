## Core Rules

1. Centralize configuration in `src/env.ts` with Zod validation.
2. Assume environment variables exist; set defaults in the central config object, not at call sites.
3. Do not access `process.env.*` outside `src/env.ts`.
4. Break things rather than preserving backward compatibility unless explicitly asked otherwise.
5. Do not create APIs unless they are explicitly needed. When in doubt, ask the user.
6. Do not create ad hoc types if a package already provides them; install the existing package types instead.
7. Do not wrap everything in `try/catch`. Catch only expected errors and let unexpected failures bubble up.
8. Do not create README or other documentation unless asked.
9. Do not create migration files; apply schema changes directly with `drizzle-kit push`.

## Qwik And Data Flow

- Use Qwik patterns consistently: `component$()`, `routeLoader$()`, `routeAction$()`, `useSignal()`, and `$()` where serialization requires it.
- Keep route-specific one-off joins in route loaders when abstraction would not be reused; use services for reusable operations.
- Strip sensitive data server-side in loaders before Qwik serializes state. Do not rely on client-side hiding for privacy.

## Component And UI Rules

- React components used through `qwikify$()` must be self-contained: keep their CSS alongside the component.
- Before creating any shared UI primitive or form element, read [src/design/DESIGN.md](src/design/DESIGN.md) and import primitives from `~/components/ui` only.

## Database And Auth

- Keep schema files in `src/db/schemas/` and use `better-sqlite3` with Drizzle.
- Authentication is magic-link plus OTP email-based; follow the helpers in `src/utils/server-auth.ts` and the existing login flow.
- Uploaded images only store the main path in the database; derive thumbnails with `deriveThumbnailKey(mainPath)` from `~/utils/images`.

## Testing

- Every new feature requires a test plan before implementation begins. The plan must identify: what to test (happy path, edge cases, error states), which test type to use (unit, integration, or e2e), and where the test files live.
- Unit tests go in `tests/unit/` and use Vitest. Use them for pure functions, service logic, and utilities.
- E2E tests go in `tests/e2e/` and use Playwright (`testDir: "./tests/e2e"`). Use them for user-facing flows, form submissions, and anything requiring a real browser or server.
- Do not ship a feature without at least one automated test covering the primary happy path.
- Run `npm test` (unit) and `npx playwright test` (e2e) before considering a feature complete.

### E2E fixtures — always import from `tests/fixtures.ts`

All e2e tests import `{ test, expect }` from `"../fixtures"` (relative to `tests/e2e/`). The `test` object provides four role-based page fixtures:

| Fixture | Auth state |
|---|---|
| `guestPage` | No session cookie (unauthenticated) |
| `memberPage` | Logged in as role `"user"` |
| `moderatorPage` | Logged in as role `"moderator"` |
| `adminPage` | Logged in as role `"admin"` |

Use the fixture that matches the access level the test needs:

```typescript
import { test, expect } from "../fixtures";

test("admin can see the dashboard", async ({ adminPage: page }) => {
  await page.goto("/admin");
  await expect(page.locator("h1")).toBeVisible();
});
```

When a test needs the `userId` (e.g. to verify a DB column after form submit), call `createUserSession(role)` directly and inject the cookie manually. Use the named DB helpers from `tests/fixtures.ts` — **never call `openDb()` or `new Database()` directly in a test file**:

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

All DB helpers live in `tests/fixtures.ts`. Available helpers include:

| Helper | Purpose |
|---|---|
| `getUserById(id)` | Fetch a full user row |
| `deleteUserByEmail(email)` | Delete user + login by email (mailpit test cleanup) |
| `setUserConsentByEmail(email, consent)` | Update consent JSON for a user |
| `createTestUser(opts)` | Create user with preset consent/food/photo fields |
| `getGroupBySlug(slug)` | Look up a group by slug |
| `addGroupMember(userId, groupId)` | Add user to a group |
| `deleteGroupMember(userId, groupId)` | Remove user from a group |
| `deleteGroupRepresentative(userId, groupId)` | Remove a group representative |
| `createTestEvent(userId)` | Create a minimal event with one product |
| `getPostByTitle(title)` | Fetch a post row by title |
| `deletePostByTitle(title)` | Delete posts by title |
| `createPageInDb(opts)` | Insert a page + menu item |
| `createMenuItemInDb(opts)` | Insert a standalone menu item |
| `deletePageAndMenuItems(pageId)` | Delete a page and its linked menu items |
| `deleteMenuItemById(id)` | Delete a single menu item |
| `getMenuItemByUrl(url)` | Fetch a menu item by URL |
| `getMenuItemPosition(id)` | Get the position of a menu item |
| `getPageContent(pageId)` | Get the parsed content blocks of a page |

If you need DB access that none of the above covers, **add a new named helper to `tests/fixtures.ts`** rather than calling `openDb()` in the test.

### Auth flows (login tests)

For tests that exercise the login flow itself, use `guestPage` and the mailpit helpers in `tests/utils/mailpit-client.ts`. Mailpit API runs at `http://localhost:8025`.

### Running e2e tests

```bash
# All e2e tests
npx playwright test

# Single file, skip auth setup
npx playwright test tests/e2e/pages.spec.ts --project chromium --no-deps

# Auth flow tests (no stored session)
npx playwright test --project auth-flows
```

## Verification

- Use Playwright to verify behavior when the user wants runtime confirmation or mentions endpoint behavior.
- For login tests, use the mailpit flow in `tests/utils/mailpit-client.ts` or the magic-link flow through `/login`.