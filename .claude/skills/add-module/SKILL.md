---
name: add-module
description: Use when creating a new feature module under src/modules/, or changing an existing module's manifest, pages, admin sections, actions, schema, blocks, sitemap, profile/scope-page hooks, payments, or its registration in src/core/registry and modules.config.ts. Also when a module needs something from core or hits the modules import boundary.
---

# Feature modules

Jobs (`src/modules/jobs/`) is the worked example throughout. Modules: deals, elections, events, jobs, qualifications.

## Layout

`src/modules/<id>/` holds only module folders (modules are first-party code under `src`, same license as core; `theme/` and the site config `modules.config.ts` stay at the repo root). Typical files: `module.ts` (manifest via `defineModule`), `pages.ts` (`definePage` entries), `views.tsx` (client-safe view map), `actions.ts` (public `routeAction$`s), `schema.ts` (or `schema/` for many tables), `service.ts`, `public-<x>.ts` (public payload mapping, e.g. `toPublicJob`), `admin/` (`list.tsx` + `list-data.ts`, `edit.tsx` + `edit-data.ts`), optional `blocks.ts`, `use*.ts` composables, `notifications.ts` / `emails.ts` (notification definitions), `payments.ts`.

## Registration (one line each)

- `src/core/registry/manifests.ts`: import the module and add it to `allModules`.
- `src/core/registry/views.ts`: spread its views into `moduleViews` (client-safe: no server imports).
- `src/core/registry/actions.ts`: re-export its public `routeAction$`s. The catch-all does `export * from "../../core/registry/actions"`.
- `src/core/registry/schemas.ts`: `export *` its tables and add its default schema to `moduleSchemas`.
- `src/core/registry/blocks.ts`: only if it owns page-builder blocks (`moduleBlocks[id] = <module>Blocks` from a side-effect-free `blocks.ts`).
- `modules.config.ts`: add the id to `active`. An id in `allModules` but not in `active` is inactive (pages 404 via `requireActiveModule`, its blocks are hidden, admin/menu entries disappear). `selectActive` throws on unknown or duplicate ids.
- Admin routes: add `src/routes/admin/[scope]/<id>/**` files that import the module's admin component + loader via RELATIVE paths and re-export its actions.
- New tables: follow the `database` skill (`npm run db:generate`, commit the migration). Add the id to the seeds if useful.

## Manifest hooks (`ModuleDefinition` in `src/core/router/modules.ts`)

- `pages`: `definePage` entries, matched in order by the catch-all. Declare static paths before parameterised ones (`/jobs/new` before `/jobs/:id`).
- `admin: { sections: [{ path, label, order?, scopes? }] }`: admin nav entries, sorted by `order`. `scopes: "root"` (default) exists on the root scope's admin only (`/admin/root/<path>`); `"all"` in every scope's admin (events, jobs, deals, elections); a list of kinds (`["root", "region"]`, kinds from `SCOPE_KINDS` in `src/env.ts`, a unit test checks them) on scopes of those kinds. Elsewhere the `[scope]` layout and `requireModuleAdmin` answer 404. A section outside the root must limit data to the URL scope's subtree (`getSubtreeIds` in list loaders, `requireWithinScope(event, scope, item)` for every item id in loaders and actions) and create items with `scopeId: scope.id`.
- `menuLinks: [{ key, label, url }]`: links offered for the site menus.
- `blocks`: page-builder block types the module owns (hidden while inactive); must match `src/core/registry/blocks.ts` (a unit test checks it).
- `sitemap: () => SitemapEntry[]`: public URLs for `/sitemap.xml`; omit for login-gated modules. Server-only.
- `profile(ctx)` / `scopePage(ctx)`: extra sections for profile pages (`ProfileExtras` in `src/contracts/profile.ts`) and a scope's public home page (`ScopeExtras` in `src/contracts/scopes.ts`; `ctx.scopeId`). Server-only; return only what `ctx.viewerId` may see (nothing private unless `ctx.isOwnProfile`), the result is serialized to the browser.
- `scopeContentCount(scopeId)`: how many of the module's rows a scope owns; a scope can only be deleted while every module reports 0.
- `reevaluateUserTags(userId)`: re-runs the module's user-tag rules (admin "Re-evaluate badges").
- `payments: Record<kind, PaymentHandlers>`: Stripe callbacks, called by the core webhook by `metadata.moduleId` / `metadata.kind` even while the module is inactive.
- `notifications: NotificationDefinition[]`: what the module sends (see Notifications below). Resolved from every registered module, so rows queued before a module was deactivated are still sent.

## Pages and actions

- Public pages are `definePage({ id, path, load(event, { params }) })` entries served by the catch-all `src/routes/[...path]`; the view for each page id comes from `views.tsx`. Page data is declared in `src/contracts/<module>.ts` (e.g. `JobsListData`) and the catch-all runs the leak check on it (`allowPrivateFields` on `definePage` to allow a field with a reason).
- Module `routeAction$`s and admin actions are re-exported from the route files via RELATIVE paths only (e.g. `../../modules/jobs/actions` from `src/routes/x/`). Qwik production-build footgun: the Rollup transform mis-resolves `~`/`~theme` aliased re-exports.
- Authorize as the first statement (before any `try`): `requireModuleAuth(event, "<id>")` for public actions/loaders (login + module active), `requireModuleAdmin(event, { module, section? })` for admin ones (the section rule comes from the manifest) (both from `~/core`). `requireModuleAdmin` is `requireScopeRole(event, ADMIN_ACCESS)` plus the scope rule and returns `{ user, scope, ancestors, isRoot, adminBase }`; build admin links from `adminBase` (or `adminUrl(scope.path, sub)`), never by hand.
- Scopes and access (all from `~/core`): `canViewScope(user, scopeId, "public" | "members" | "representatives")` for single items; listings take a `ContentFilter` from `scopeContentFilter(viewer, scope?)` or `requestContentFilter(event)` (viewer + URL scope prefix; pass `this` in `server$`) and apply `filter.where({ scopeId, visibility? })` (select builder) or `RAW: (t) => filter.where(t)` (relational queries); a table without a visibility column counts as public. `scopeSourceLabels` labels items of other scopes. Also `allowedVisibilities`, `isMember`, `listMembers`, `canManageScope`, `listManagedScopes`, `scopeLabels`, `getScope`/`getAncestors`/`getDescendants`/`getSubtreeIds`, `isWithinScope`/`requireWithinScope`. Never read the scope tables or compute inheritance yourself. Every content row has a NOT NULL `scopeId` (`scopes` from `~/core/schema`, `onDelete: "cascade"`; site-wide = the root); visibility columns use `VISIBILITIES` from `~/core/schema`. Details and the rest of the auth rules: CLAUDE.md Security. `tests/unit/action-auth.spec.ts` fails when an action does not start with its auth call.
- Validate with `zod$`, whitelist updatable columns, re-check ownership in both loader and action.

## Notifications

Modules never pick a transport: no `sendEmail`, no Telegram client (neither is in `~/core`). Declare, then queue. Worked examples: `src/modules/jobs/notifications.ts` (optional), `src/modules/events/emails.ts` (required email + ops Telegram alert).

```ts
// src/modules/<id>/notifications.ts — listed in the manifest: notifications: [jobApprovedNotification]
export const jobApprovedNotification = defineNotification<{ jobId: string; jobTitle: string }>({
	id: "jobs.approved",            // "<module>.<name>", unique
	label: "Job approved",          // shown in the profile settings when optional
	channels: ["email"],            // "email" | "telegram"; one renderer per channel
	optional: true,                 // optional = users can mute it (profile toggle + unsubscribe link)
	render: {
		email: (data, ctx) => ({ subject: "…", react: createElement(JobApprovedEmail, { …, unsubscribeUrl: ctx.unsubscribeUrl }) }),
		// telegram: (data, ctx) => "plain text",
	},
});

// in an action / payment handler, after the change succeeded:
await notify("jobs.approved", { to: job.suggestedBy, data: { jobId: job.id, jobTitle: job.title } });
await notify("events.sale", { to: { channel: "telegram", target: "ops" }, data: { … } });
```

- `to`: user id(s), or an ops target `{ channel, target }` (`telegram`/`ops` = TELEGRAM_CHANNEL_ID). Never an address: emails are looked up server-side from the user id.
- `data` must be JSON-serializable and is stored in `notification_outbox`; prefer ids and let the (async, server-side) renderer load the rest at send time. Attachments (`attachments` in the email result) are built in the renderer, never stored.
- Renderers get `ctx.recipient` (`userId`, `name`, `address`), `ctx.appUrl` and `ctx.unsubscribeUrl` (set for optional notifications to a user; pass it to the template so `EmailLayout` shows the footer link; the List-Unsubscribe headers are added by the email channel).
- Email templates live in `theme/emails/*` (props contract in `src/contracts/emails.ts`), imported via `~theme/emails/...`.
- `notify` only inserts rows (never sends inline) and throws on an unknown id or non-serializable data. Delivery, retries (exponential backoff, `NOTIFICATIONS_MAX_ATTEMPTS`) and failures are the worker's job; failed rows show up at `/admin/global/notifications`.
- Unit tests: `enqueueNotification(def, input)` and `processOutboxOnce({ resolve, channels })` with fake channels (see `tests/unit/notifications*.spec.ts`).

## Server/client split

- Keep server-only loader logic in `*-data.ts` files imported only inside `routeLoader$` (e.g. `loadAdminJobs`), so it never reaches the client bundle. No server code (services, `db`, `~/core` server exports) in components or `views.tsx`; view maps are bundled for the browser.
- `~/core/seo` and `~/core/ui` are client-safe; `~/core` is server+client but its server exports must only be referenced inside loaders/actions/`server$`. `~/core/setup-actions` is separate because importing a `routeAction$` needs the router runtime.

## Privacy

- Services return other users only as public shapes: relational queries use `with: { user: { columns: publicUserColumns } }` (selects use `publicUserSelect`), never `user: true` (`tests/unit/public-user-columns.spec.ts` fails on it). Map rows to public payloads with `toPublicUser` / module `toPublic*` functions; private fields only via explicitly named service methods. All exported from `~/core`.
- Leak check: `assertNoPrivateFields(value, { allow })` (`~/core`) wraps every admin `*-data.ts` result in the admin route: `routeLoader$(async (event) => assertNoPrivateFields(await loadX(event)))`. Allow a field only with a comment saying why.
- Loaders and `*-data.ts` files never use `db`; they call the module service.

## Schema

`schema.ts` exports its tables plus a default `defineModuleSchema({ tables, relations })` (from `~/core/schema`). `relations` is the module's relation part, including reverse relations on core tables (like `users.jobs`). `src/core/db/schema.ts` merges the parts through `src/core/registry/schemas.ts`, which must stay free of db connection/`~/env` imports because drizzle-kit loads it.

Layout rule, the same for every module: ONE `schema.ts` holding the tables, their types/insert schemas and the `defineModuleSchema` default export. Only a module with many tables (today: events) uses a `schema/` folder instead, with one file per table plus `schema/index.ts` (re-exports and the `defineModuleSchema` default export) and NO `schema.ts` beside it. `./schema` resolves to either form, so importers do not change when a module grows.

## Import boundary

Enforced by the `src/modules/**` override in `biome.json` (check with `npx biome lint src/modules`). Modules import only:
`~/core` (add exports to `src/core/index.ts` when a module needs more), `~/core/ui`, `~/core/schema`, `~/core/seo`, `~/core/setup-actions`, `~/contracts/*`, `~theme/*`, relative files in their own folder, and npm packages. Never `~/core/<area>/**` (areas, including the registry), `~/core-api`, `~/ui`, `~/components/**`, `~/env` or another module (`~/modules/**`).
