## Core Rules

1. Centralize configuration in `src/env.ts` with Zod validation.
2. Assume environment variables exist; set defaults in the central config object, not at call sites.
3. Do not access `process.env.*` outside `src/env.ts`.
4. Break things rather than preserving backward compatibility unless explicitly asked otherwise.
5. Do not create APIs unless they are explicitly needed. When in doubt, ask the user.
6. Do not create ad hoc types if a package already provides them; install the existing package types instead.
7. Do not wrap everything in `try/catch`. Catch only expected errors and let unexpected failures bubble up.
8. Do not create README or other documentation unless asked.
9. Migrations: after changing a schema file run `npm run db:generate` and commit the file under `drizzle/`; never `drizzle-kit push`. Details in the `database` skill.
10. Use Qwik patterns consistently: `component$()`, `routeLoader$()`, `routeAction$()`, `useSignal()`, and `$()` where serialization requires it.
11. Notifications (email, Telegram) go only through `notify(id, { to, data })` with a `defineNotification` declaration (module manifest or `src/core/notifications/core-notifications.ts`); the outbox worker sends them. Never call `sendEmail`/Telegram directly; the login OTP/magic-link email (`sendLoginEmail`) is the only synchronous exception. Details in the `add-module` skill.

## Architecture map

- `src/core/<area>/` — core internals: `admin`, `auth`, `content`, `db`, `forms`, `media`, `memberships`, `notifications`, `payments`, `refs`, `registry`, `router`, `scopes`, `shared`, `tags`, `users`. Each area owns its services, schema (`schema.ts` or `schema/`) and helpers. `src/core/db/schema.ts` merges all schemas.
- `src/core/notifications/` — `notify()` writes `notification_outbox` rows; `worker.ts` (started in `entry.node-server.tsx` and by a dev-server plugin in `vite.config.ts`) sends them through channel adapters (`channels/`); preferences, signed unsubscribe (`/api/notifications/unsubscribe`), admin failure view at `/admin/root/notifications`.
- Root files of `src/core` are the only core surface modules may import: `~/core` (`index.ts`, server+client API), `~/core/ui` (UI primitives), `~/core/schema` (core table references), `~/core/seo` (client-safe SEO helpers), `~/core/setup-actions` (onboarding step actions).
- `src/modules/<id>/` — feature modules (deals, elections, events, jobs, qualifications), first-party app code under the same license as core, imported as `~/modules/*`; one `schema.ts` per module (a `schema/` folder only for many tables). `modules.config.ts` at the repo root lists the active ones; `src/core/registry/*` registers them (via relative paths).
- Scoped content (spec 4.2/4.3): every content row (posts, pages, events, jobs, deals, election cycles, qualification types) has a NOT NULL `scope_id` (site-wide = the root); visibility is `public` / `members` / `representatives` (`VISIBILITIES`, `src/core/scopes/visibility.ts`; `allowedVisibilities` decides what an author may pick). Every listing goes through `scopeContentFilter(viewer, scope)` / `requestContentFilter(event)` (`~/core`): own and ancestors' items by visibility, public items from below, never members-only items upward. CMS pages are per scope (`<scope path>/<slug>`); page slugs and scope slugs never collide (`pageSlugProblem`). Moving or renaming a scope (its public and `/admin/<segment>` URLs) and renaming a page write `redirects` rows; `plugin@scope` answers 301.
- URLs and references (spec 4.3, `src/core/refs/`, bound in `src/core/registry/refs.ts`, exported via `~/core`): every item has one canonical URL under its owning scope (`/germany/berlin/events/<slug>`, `/<scope>/posts/<id>`); its page calls `requireCanonicalUrl(event, await itemUrl(...))` after the auth/visibility checks, so other prefixes answer 301. Never build item URLs by hand: loaders use `itemUrl("events:event", item)` / `withItemUrls(kind, rows)` / `scopeUrl(scope, "/events")` and contracts carry `url` fields (`tests/unit/no-hand-built-item-links.spec.ts`). Never store internal URLs: store references (`scope:<id>`, `scope:<id>/<module>`, `<module>:<type>:<id>`, as `ref:<reference>` in link fields and hrefs; human input form `root/germany/berlin:events`) and resolve them when rendering (`resolveRef(s)`, `renderRichHtml`, `renderBlockRefs`, `resolveMenuUrls`). Menu items, page-builder link fields, rich-text links and notification links are references; `sanitizeRichHtml` keeps only `ref:` and http(s)/mailto/tel links, so services run `internalLinksToRefs` first. Modules declare `refs` in their manifest (`add-module` skill).
- `src/core/scopes/` — the scope tree (`scopes`, `scope_roles`, `scope_memberships`); groups, regions and chapters are scopes. `access.ts` is the access layer (roles inherit downward, membership counts upward). A scope's home page is its path (`/germany/berlin`), served by the catch-all.
- `src/routes/**` — Qwik City routes (loaders, actions, auth). Public module pages are `definePage` entries served by the catch-all `src/routes/[...path]`. Admin lives in `src/routes/admin/[scope]/**` (`[scope]` = dotted slug path: `root`, `germany.berlin`) and is core, not themeable; users, tags, notifications, the site menus and module sections with `scopes: "root"` (the default) exist on the root only; a module section may also be `"all"` or a list of scope kinds (`SCOPE_KINDS` in `src/env.ts`).
- `theme/` — separately licensed presentation layer for public routes (`blocks`, `chrome`, `emails`, `routes`, `shared`, `tokens`), imported via the `~theme/*` alias. It reaches core data only through `src/contracts/*` types and headless composables.
- `src/contracts/*.ts` — typed payloads shared between core and theme/modules.
- `src/components/ui` (UI primitives, see `src/design/DESIGN.md`), `src/design` (tokens fallback), `tests/` (unit, e2e, `fixtures.ts`), `scripts/` (seeds), `drizzle/` (migrations).

## Skills

Load the matching skill (`.claude/skills/<name>/SKILL.md`) before working in its area:

- `testing` — writing or running tests, test plans, e2e fixtures, the pre-commit test run, verifying behavior at runtime.
- `add-module` — creating or changing a feature module in `src/modules/`, its registration, pages, admin sections, actions, hooks, import boundary.
- `theme` — anything in `theme/`, contracts, headless composables, design tokens, UI components, `qwikify$`, the theme/core license boundary.
- `database` — schema changes, migrations, the migration runner, resetting a local DB.
- `images` — S3 images, public vs private keys, profile pictures, `VITE_S3_BASE_URL`.
- `job-portal` — the jobs module (`/jobs`, `/admin/root/jobs`).

## Security

These rules encode mistakes that have actually shipped in this codebase. Treat every one as mandatory, not advisory.

### Authorize inside the handler, never in a loader (Qwik footgun)

- **A `routeAction$` / `globalAction$` runs BEFORE the route's and layout's `routeLoader$`s.** A loader that throws `redirect()` does *not* protect an action — the action's side effects have already executed by the time the loader runs. The same applies to API `onGet`/`onPost`/`onRequest` handlers.
- Every mutating action and every API route handler must perform its own authorization as its **first statement**, before any `try` block (the auth helpers throw a `redirect`/`error`, and a `try/catch` would swallow it).
- Use the shared helpers — do not hand-roll checks:
  - `requireAuth(event)` — any logged-in user (returns the user).
  - `requireScopeRole(event, minRole)` (`~/core`, `~/core/scopes/access`) — resolves the scope from the `[scope]` admin segment or the public URL prefix, checks the role (inherited downward; admin = moderator; a coordinator is never a manager) and returns `{ user, scope, ancestors }`; 404 for an unknown scope, 403 without the role. Every action under `admin/[scope]/**` uses it (`ADMIN_ACCESS` = any managing role), then limits data to the scope's subtree (`isWithinScope`, `getSubtreeIds`).
  - `requireSystemAdmin(event)` — root-only system sections (admin/moderator of the root, on `/admin/root`). `requireAdmin(event)` — platform admin (admin/moderator of the root) whatever the URL. There is no `users.role`.
  - Modules: `requireModuleAdmin(event, { module, section? })` (the section's `scopes` rule comes from the manifest) and `requireModuleAuth(event, module)` (wrappers over the above).
  - Admin actions that take an item id re-check it with `requireWithinScope(event, scope, item)` (404 outside the URL scope's subtree).
- `tests/unit/action-auth.spec.ts` enforces this: every `routeAction$`/`globalAction$` and API `onPost/onPut/onPatch/onDelete` in `src/routes`, `src/modules` and `src/core` must start with an auth helper (or a function that starts with one); deliberately public handlers are allow-listed there with the reason.
- **Never read auth state from `sharedMap.get("session")`** — nothing populates it; it is always `undefined`. Resolve the user via `getCurrentUserData(event)` / `getServerSession(event)`.
- After adding any action, grep the file: every `export const useX = routeAction$` must have a matching auth call in its body.

### Don't trust the client for identity, price, or ownership

- Re-resolve sensitive values server-side from an id; never accept them from the request body. Examples in this repo: participant emails are looked up via `usersService.getEmailsByIds()` from `existingUserId` (the search API deliberately never returns emails); checkout recomputes totals from `product.price`; the Stripe webhook verifies the signature before trusting any payload.
- For owner-scoped resources, re-check ownership in **both** the loader and the action (e.g. jobs check `suggestedBy === user.id && status === "pending"` in each).
- Validate every action input with `zod$`. Whitelist updatable columns explicitly — never spread raw form data into a DB `update`/`insert`, and never let a client set `role`, `status`, ownership, or other privilege fields.

### Services are the privacy boundary (private by default)

- **Services return public shapes by default.** A list/detail method that returns other users returns them as public shapes: relational queries load users with `with: { user: { columns: publicUserColumns } }` (core selects use `publicUserSelect`; both from `src/core/users/public-user.ts`, exported via `~/core` for modules), or an explicit column list. Never `user: true` — `tests/unit/public-user-columns.spec.ts` fails on any `with:` user relation without a column list. Profile pictures go out as the public thumbnail URL (`publicUserThumbnailUrl`), never the private `profilePicture` key.
- **Private fields only via explicitly named methods** whose name says what they add (e.g. `usersService.getEmailsByIds`, `usersService.getOwnPrivateDetails`, `ticketsService.getByEventIdWithBuyerEmail`, `transactionsService.getByEventIdWithBuyerEmail`, `participationService.getByEventIdWithEmails`, `groupMembershipsService.getMembersWithEmailAndRole`, `adminUsersService.listWithEmailAndRole`, `usersService.getPrivateById`). Call them from admin loaders (or for the viewer's own data) only.
- **Only services use the db** (`db`, `~/core/db/*` queries): route files, loaders, actions, pages, components and module `*-data.ts` / `public-*.ts` / `actions.ts` files call services. Allowed: `services/`, `service.ts`, `*.service.ts`, and module `payments.ts` handlers. `tests/unit/no-db-outside-services.spec.ts` enforces this.
- **Visibility decisions are made in the loader/service** (login-only, members-only, role, owner-only): load or return only what the viewer may see (e.g. `postsService.canView` / the `viewerId` argument of post lists, `canViewEvent`, owner-only fields added only for the owner). The theme only renders what it gets and never hides data with conditionals.
- **Page payloads are declared types.** Pages that show another user's data return a payload type declared in `src/contracts/*` (`satisfies` or an explicit return type), not one derived from `ReturnType<typeof useX>`; adding a field to such a page means adding it to the contract.
- **Leak check (dev/test safety net).** `assertNoPrivateFields(value, { allow })` (`src/core/shared/no-private-fields.ts`, also exported via `~/core`) deep-scans a payload and throws (when `NODE_ENV !== "production"`) on private keys — email, loginId, consent, yearOfBirth, sex, latitude/longitude, foodPreference, photoConsentGiven, profilePicture, phone, login/session secrets, qrCodeUuid, adminNote, any `stripe*` key; see `PRIVATE_FIELD_KEYS`. It runs on every catch-all page result, every admin `*-data.ts` loader result (wrapped in the admin route: `routeLoader$(async (event) => assertNoPrivateFields(await loadX(event)))`) and the core loaders with user data. When a page legitimately shows such a field (admin pages listing emails, the viewer's own profile/checkout/tickets, an event venue's coordinates), allow it explicitly next to the check with a comment saying why: `assertNoPrivateFields(data, { allow: ["email"] })`, or `allowPrivateFields: [...]` on a `definePage`. New loaders that return user data must call it too; never widen an allow list to silence an e2e failure without that justification.

### Strip secrets before serialization

- Qwik serializes loader/action return values into the HTML sent to the browser. Private fields (emails, tokens, raw private S3 keys, other users' PII) must never be in them: strip them in the service (see above), not the theme. Do not rely on client-side hiding.

### Sanitize stored HTML; never render raw user input

- Any value rendered with `dangerouslySetInnerHTML` must be sanitized server-side **on write** with `sanitizeRichHtml()` from `~/core/content/sanitize-html` (do this in the service `create`/`update`, so every write path is covered). BlockNote `body`/`content` is submitted through a hidden input and is fully attacker-controlled — the editor is not a security boundary.
- Inline SVG must go through `sanitizeSvg()` from `~/core/content/svg-sanitize` on write. Keep the sanitizer imports server-only (services / route handlers) so they are not bundled to the client.

### S3 key handling — validate prefixes, presign privately

- Any S3 key supplied by the client and later stored or presigned must be prefix-validated. Profile-picture keys are checked against `private/profile-pictures/` and `public/profile-pictures/` in `usersService.update`, scope home page images against `public/scopes/` in `scopesService.setImage`; the upload endpoint (`/api/images`) allowlists `x-upload-path` via `sanitizeUploadPrefix` (rejects `..`/absolute/odd charset) and authorizes the destination per prefix via `isUploadAuthorized` (profile-pictures → any user; `private/events/` → platform admins; other `public/*` → anyone with a managing role on a scope). A key alone must never grant a presigned read of an arbitrary private object.
- Private objects are served only through `resolvePrivateImageUrl(key)` (short-lived presigned URL); public objects through `publicImageUrlFromKey(key)`. Never expose a private key as if it were a public URL.

### Auth/session invariants (don't regress these)

- Authentication is magic-link plus OTP email-based; follow the helpers in `src/core/auth/server-auth.ts` and the existing login flow.
- Session cookies are always `httpOnly`, `secure: env.isProduction`, `sameSite: "Strict"`, with an explicit expiry. Tokens come from `randomBytes` (see `~/core/auth/email-auth`). OTPs are bcrypt-hashed, single-use, expiring, and capped at 5 attempts. Preserve all of these when touching the login flow.

## Linting

- This repo uses Biome (`biome.json`), not eslint. Run `npx biome check .` (or `npm run biome` to auto-fix) after implementing changes, before considering the work complete.
- `.githooks/pre-commit` (activated by the `prepare` script via `git config core.hooksPath .githooks`) runs Biome on **staged files only** and blocks the commit on errors; it also runs the Vitest unit suite. The repo has pre-existing lint debt: fix what you touch, do not clear unrelated debt. Fix the underlying issue rather than `git commit --no-verify` unless explicitly instructed.
- Import boundaries are enforced by `noRestrictedImports` overrides in `biome.json` for `theme/**` and `src/modules/**` (check with `npx biome lint theme` / `npx biome lint src/modules`); see the `theme` and `add-module` skills.
