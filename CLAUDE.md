## Core Rules

1. Centralize configuration in `src/env.ts` with Zod validation.
2. Assume environment variables exist; set defaults in the central config object, not at call sites.
3. Do not access `process.env.*` outside `src/env.ts`.
4. Break things rather than preserving backward compatibility unless explicitly asked otherwise.
5. Do not create APIs unless they are explicitly needed. When in doubt, ask the user.
6. Do not create ad hoc types if a package already provides them; install the existing package types instead.
7. Do not wrap everything in `try/catch`. Catch only expected errors and let unexpected failures bubble up.
8. Do not create README or other documentation unless asked.
9. Local development: apply schema changes directly with `drizzle-kit push` (no committed migration files needed). For deployed environments: generate committed migrations with `npm run db:generate` and apply them with `npm run migrate` (the programmatic runner in `scripts/migrate.js`) — the deploy container runs this at startup. Keep the `drizzle/` migration files in sync with the schema.

## Qwik And Data Flow

- Use Qwik patterns consistently: `component$()`, `routeLoader$()`, `routeAction$()`, `useSignal()`, and `$()` where serialization requires it.
- Keep route-specific one-off joins in route loaders when abstraction would not be reused; use services for reusable operations.
- Strip sensitive data server-side in loaders before Qwik serializes state. Do not rely on client-side hiding for privacy.

## Component And UI Rules

- React components used through `qwikify$()` must be self-contained: keep their CSS alongside the component.
- Before creating any shared UI primitive or form element, read [src/design/DESIGN.md](src/design/DESIGN.md) and import primitives from `~/components/ui` only.

## Theme vs Core

The presentational layer for public-facing routes lives in `theme/` and is licensed separately from core (`theme/LICENSE`). The admin panel is core and is **not** themeable — see [theme/README.md](theme/README.md) for the folder layout.

- **Qwik City forces route files to stay in `src/routes/**`.** A route file keeps its `routeLoader$`/`routeAction$`/`onRequest`/`head`/auth, strips secrets in the loader, then delegates rendering to a theme `*View` component, passing loader data as typed props.
- **The props type is the contract.** Derive it from the loader (`NonNullable<ReturnType<typeof useX>["value"]>`) and re-export it from `src/contracts/*.ts`. Theme components import only from `~/contracts/*` and, where a block/view needs live data after SSR (pagination, "Load More"), a core-owned **headless composable** — never `db`, `env`, services, or `~/utils/server-auth` directly.
- **Page-builder blocks have no route loader**, so each "dynamic" block delegates its data-fetching/pagination to a composable under `src/components/builder/blocks/*.ts` (e.g. `useUpcomingEvents`, `useDealsList`) — plain functions using `useSignal`/`useTask$`/`server$()`, Qwik's native "custom hook" pattern. The composable owns the service/db/auth calls and any `server$()` RPC boundary; the theme block (`theme/blocks/**`) only calls the composable and renders the returned signals. Same split for the `/jobs` list's pagination (`src/routes/jobs/useJobsPagination.ts`). `BlockDefinition`/`FieldDefinition`/`BlockData` (needed by every block for registration) are re-exported type-only from `src/contracts/blocks.ts` rather than `~/db/schema`, so blocks never import `~/db/*` either.
- **The boundary is enforced, not just documented**: `biome.json` has a `noRestrictedImports` override scoped to `theme/**` that fails the build on any `~/services/*`, `~/db/*`, `~/utils/server-auth`, or `~/env` import from theme. Run `npx biome lint theme` to check. When adding a new dynamic block or new live data need, add a composable in core first — do not import a service directly from `theme/**` to work around the rule.
- **Import theme code via the `~theme/*` alias** (`~theme/chrome`, `~theme/blocks`, `~theme/routes/**`, `~theme/shared/**`). Never import theme code from a route file via a relative path.
- **Qwik production-build footgun:** a re-exported `routeAction$`/`routeLoader$` is only resolved correctly by the production Rollup transform when re-exported via a **relative** import path — never `~` or `~theme`. When a step/widget bundles an action with JSX (see `src/components/setup/README.md`), split it: the action stays in core (`src/components/**/useXxx.ts`, re-exported relatively from the route), the JSX moves to `theme/shared/**` (imported via `~theme` alias — only the action re-export hits the broken transform).
- **Check usage per exported component, not per file.** A single file can export multiple components where only some are theme-exclusive — grepping the file/folder name as "shared" is not enough; check what each consuming route actually imports before moving or splitting (e.g. `ParticipationToggle` vs `ParticipationSummary`, originally one file, split because only the public route used the toggle and only the admin route used the summary).
- Admin stays un-themeable via the `.admin-shell` scope in `src/global.css`, which re-pins brand token values; `src/routes/admin/layout.tsx` wraps admin in it. Never let an admin-only component read brand tokens (`--color-primary*`, `--color-accent*`) expecting theme values to apply.
- Design tokens (colors, fonts, radii, shadows) are defined once in `theme/tokens/theme.css` (Tailwind `@theme {}` block) and `theme/tokens/tokens.ts` (TS constants for emails/inline styles), with a core fallback set in `src/design/tokens.css`. Never hardcode hex colors or font stacks in components or emails — reference a token. See [src/design/DESIGN.md](src/design/DESIGN.md) for the full palette and `theme/emails/brand.ts` for email-specific brand strings.

## Database And Auth

- Keep schema files in `src/db/schemas/` and use `better-sqlite3` with Drizzle.
- Authentication is magic-link plus OTP email-based; follow the helpers in `src/utils/server-auth.ts` and the existing login flow.
- Public images (events, posts, groups): store the S3 key in the DB; call `publicImageUrlFromKey(key)` from `~/utils/images` to build a direct browser URL using `VITE_S3_BASE_URL`. Thumbnails are derived with `deriveThumbnailKey(key)`.
- Profile pictures are split: the full-size image (`private/profile-pictures/`) is stored in `users.profilePicture` and must be presigned server-side via `resolvePrivateImageUrl(key)` from `~/utils/secure-urls`; the thumbnail (`public/profile-pictures/`) is stored separately in `users.profilePictureSmall` and served as a direct public URL via `publicImageUrlFromKey`.
- `VITE_S3_BASE_URL` (e.g. `http://localhost:9000/data` locally, `https://<bucket>.s3.<region>.amazonaws.com` in prod) is the base URL for all public S3 objects. It is a Vite env var accessed via `import.meta.env.VITE_S3_BASE_URL`, not through `src/env.ts`.

## Security

These rules encode mistakes that have actually shipped in this codebase. Treat every one as mandatory, not advisory.

### Authorize inside the handler, never in a loader (Qwik footgun)

- **A `routeAction$` / `globalAction$` runs BEFORE the route's and layout's `routeLoader$`s.** A loader that throws `redirect()` does *not* protect an action — the action's side effects have already executed by the time the loader runs. The same applies to API `onGet`/`onPost`/`onRequest` handlers.
- Every mutating action and every API route handler must perform its own authorization as its **first statement**, before any `try` block (the auth helpers throw a `redirect`/`error`, and a `try/catch` would swallow it).
- Use the shared helpers — do not hand-roll checks:
  - `requireAuth(event)` — any logged-in user (returns the user).
  - `requireAdmin(event)` — platform admin or moderator.
  - `requireGroupAdmin(event)` (in `~/utils/access-control`) — resolves the `[group_slug]` scope: platform admin for `global`, or a representative of that group. Use this for every action under `admin/[group_slug]/**`.
  - `requireMembership(event, tier)` — membership-gated routes.
- **Never read auth state from `sharedMap.get("session")`** — nothing populates it; it is always `undefined`. Resolve the user via `getCurrentUserData(event)` / `getServerSession(event)`.
- After adding any action, grep the file: every `export const useX = routeAction$` must have a matching auth call in its body.

### Don't trust the client for identity, price, or ownership

- Re-resolve sensitive values server-side from an id; never accept them from the request body. Examples in this repo: participant emails are looked up via `usersService.getEmailsByIds()` from `existingUserId` (the search API deliberately never returns emails); checkout recomputes totals from `product.price`; the Stripe webhook verifies the signature before trusting any payload.
- For owner-scoped resources, re-check ownership in **both** the loader and the action (e.g. jobs check `suggestedBy === user.id && status === "pending"` in each).
- Validate every action input with `zod$`. Whitelist updatable columns explicitly — never spread raw form data into a DB `update`/`insert`, and never let a client set `role`, `status`, ownership, or other privilege fields.

### Strip secrets before serialization

- Qwik serializes loader/action return values into the HTML sent to the browser. Strip private fields (emails, tokens, raw private S3 keys, other users' PII) in the loader **before** returning. Do not rely on client-side hiding.

### Sanitize stored HTML; never render raw user input

- Any value rendered with `dangerouslySetInnerHTML` must be sanitized server-side **on write** with `sanitizeRichHtml()` from `~/utils/sanitize-html` (do this in the service `create`/`update`, so every write path is covered). BlockNote `body`/`content` is submitted through a hidden input and is fully attacker-controlled — the editor is not a security boundary.
- Inline SVG must go through `sanitizeSvg()` from `~/utils/svg-sanitize` on write. Keep the sanitizer imports server-only (services / route handlers) so they are not bundled to the client.

### S3 key handling — validate prefixes, presign privately

- Any S3 key supplied by the client and later stored or presigned must be prefix-validated. Profile-picture keys are checked against `private/profile-pictures/` and `public/profile-pictures/` in `usersService.update`; the upload endpoint (`/api/images`) allowlists `x-upload-path` via `sanitizeUploadPrefix` (rejects `..`/absolute/odd charset) and authorizes the destination per prefix via `isUploadAuthorized` (profile-pictures → any user; `private/events/` → staff; other `public/*` → staff or representative). A key alone must never grant a presigned read of an arbitrary private object.
- Private objects are served only through `resolvePrivateImageUrl(key)` (short-lived presigned URL); public objects through `publicImageUrlFromKey(key)`. Never expose a private key as if it were a public URL.

### Auth/session invariants (don't regress these)

- Session cookies are always `httpOnly`, `secure: env.isProduction`, `sameSite: "Strict"`, with an explicit expiry. Tokens come from `randomBytes` (see `~/utils/email-auth`). OTPs are bcrypt-hashed, single-use, expiring, and capped at 5 attempts. Preserve all of these when touching the login flow.

## Linting

- This repo uses Biome (`biome.json`), not eslint. Run `npx biome check .` (or `npm run biome` to auto-fix) after implementing changes, before considering the work complete — the same "run before done" discipline as the Testing section below.
- A pre-commit hook enforces this automatically: `.githooks/pre-commit` runs Biome against **staged files only** (activated via `git config core.hooksPath .githooks`, wired up on `npm install` through the `prepare` script) and blocks the commit on errors. It's scoped to staged files, not the whole repo, because the repo has pre-existing lint debt that predates this hook — fix what you touch, don't try to clear unrelated debt to get a commit through. The same hook also runs the full Vitest unit suite (fast, no external services) on every commit — e2e (Playwright) is deliberately excluded from the hook since it needs Docker services (MinIO, Mailpit, stripe-mock) and a seeded DB; that still runs in CI. Fix the underlying issue rather than bypassing with `git commit --no-verify` unless explicitly instructed to.
- `theme/**` has an extra enforced rule: `noRestrictedImports` blocks `~/services/*`, `~/db/*`, `~/utils/server-auth`, `~/env` (see Theme vs Core) — this is the actual enforcement of the theme/core license boundary, not just a style preference.

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

| `createJobInDb(opts)` | Insert a job row (suggestedBy, title?, status?, expiresAt?) |
| `getJobById(id)` | Fetch id/title/status/suggested_by for a job |
| `deleteJobById(id)` | Delete a job row by id |

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

## Job Portal

The job portal lets authenticated members post job listings that go live only after admin approval.

### Routes

| Path | Who | What |
|---|---|---|
| `/jobs` | authenticated users | approved, non-expired job listings |
| `/jobs/[id]` | authenticated users | single job detail |
| `/jobs/new` | authenticated users | submission form |
| `/jobs/mine` | authenticated users | own submissions with status |
| `/jobs/mine/[id]/edit` | owner, pending only | edit a pending submission |
| `/admin/global/jobs` | admin/moderator | list all jobs, approve, delete |
| `/admin/global/jobs/[id]/edit` | admin/moderator | full edit + status toggle |

### Key rules

- All public-facing job routes call `requireAuth` — unauthenticated visitors are redirected to `/login`.
- `status` is `pending` on creation; admin sets it to `approved` to make it visible.
- `expiresAt` is capped at 30 days from today, enforced server-side in both the submit and user-edit actions.
- Editing is blocked once a job is approved — the loader redirects away and the action re-checks ownership + `status === "pending"`.
- The body field uses BlockNote with `textOnly={true}`, which removes image/file/audio/video block types from the editor. The HTML `body` is rendered with `dangerouslySetInnerHTML`, so it is sanitized server-side in `jobsService.create`/`update` via `sanitizeRichHtml()` — the editor is not a security boundary (see Security § Sanitize stored HTML).

### Schema & service

- Schema: `src/db/schemas/jobs.ts` — fields: `id`, `title`, `body`, `editorState`, `locationType`, `city`, `country`, `link`, `expiresAt`, `status`, `suggestedBy`, `createdAt`, `updatedAt`
- Service: `src/services/jobs.service.ts` — exports `jobsService` and the `JobWithUser` type
- Relations: `jobs.suggestedBy → users.id` (defined in `src/db/schema.ts`)

### Seed

The seed (`scripts/seed.ts`) inserts 7 jobs: 4 approved (visible), 2 pending (admin queue), 1 expired (filtered out). Jobs appear in both the main and footer menus at `/jobs`.