---
name: add-module
description: Use when creating a new feature module under modules/, or changing an existing module's manifest, pages, admin sections, actions, schema, blocks, sitemap, profile/group-page hooks, payments, or its registration in src/core/registry and modules.config.ts. Also when a module needs something from core or hits the modules import boundary.
---

# Feature modules

Jobs (`modules/jobs/`) is the worked example throughout. Modules: deals, elections, events, jobs, qualifications.

## Layout

`modules/<id>/` holds only module folders. Typical files: `module.ts` (manifest via `defineModule`), `pages.ts` (`definePage` entries), `views.tsx` (client-safe view map), `actions.ts` (public `routeAction$`s), `schema.ts`, `service.ts`, `public-<x>.ts` (public payload mapping, e.g. `toPublicJob`), `admin/` (`list.tsx` + `list-data.ts`, `edit.tsx` + `edit-data.ts`), optional `blocks.ts`, `use*.ts` composables, `emails.ts`, `payments.ts`.

## Registration (one line each)

- `src/core/registry/manifests.ts`: import the module and add it to `allModules`.
- `src/core/registry/views.ts`: spread its views into `moduleViews` (client-safe: no server imports).
- `src/core/registry/actions.ts`: re-export its public `routeAction$`s. The catch-all does `export * from "../../core/registry/actions"`.
- `src/core/registry/schemas.ts`: `export *` its tables and add its default schema to `moduleSchemas`.
- `src/core/registry/blocks.ts`: only if it owns page-builder blocks (`moduleBlocks[id] = <module>Blocks` from a side-effect-free `blocks.ts`).
- `modules.config.ts`: add the id to `active`. An id in `allModules` but not in `active` is inactive (pages 404 via `requireActiveModule`, its blocks are hidden, admin/menu entries disappear). `selectActive` throws on unknown or duplicate ids.
- Admin routes: add `src/routes/admin/[group_slug]/<id>/**` files that import the module's admin component + loader via RELATIVE paths and re-export its actions.
- New tables: follow the `database` skill (`npm run db:generate`, commit the migration). Add the id to the seeds if useful.

## Manifest hooks (`ModuleDefinition` in `src/core/router/modules.ts`)

- `pages`: `definePage` entries, matched in order by the catch-all. Declare static paths before parameterised ones (`/jobs/new` before `/jobs/:id`).
- `admin: { sections: [{ path, label, order?, scopes? }] }`: admin nav entries, sorted by `order`. `scopes: "global"` (default) shows only in the global admin; `"all"` also shows in every group's admin (e.g. events), and then the routes must authorize per group.
- `menuLinks: [{ key, label, url }]`: links offered for the site menus.
- `blocks`: page-builder block types the module owns (hidden while inactive); must match `src/core/registry/blocks.ts` (a unit test checks it).
- `sitemap: () => SitemapEntry[]`: public URLs for `/sitemap.xml`; omit for login-gated modules. Server-only.
- `profile(ctx)` / `groupPage(ctx)`: extra sections for profile pages (`ProfileExtras` in `src/contracts/profile.ts`) and the public group page (`src/contracts/groups.ts`). Server-only; return only what `ctx.viewerId` may see (nothing private unless `ctx.isOwnProfile`), the result is serialized to the browser.
- `reevaluateUserTags(userId)`: re-runs the module's user-tag rules (admin "Re-evaluate badges").
- `payments: Record<kind, PaymentHandlers>`: Stripe callbacks, called by the core webhook by `metadata.moduleId` / `metadata.kind` even while the module is inactive.

## Pages and actions

- Public pages are `definePage({ id, path, load(event, { params }) })` entries served by the catch-all `src/routes/[...path]`; the view for each page id comes from `views.tsx`. Page data is declared in `src/contracts/<module>.ts` (e.g. `JobsListData`) and the catch-all runs the leak check on it (`allowPrivateFields` on `definePage` to allow a field with a reason).
- Module `routeAction$`s and admin actions are re-exported from the route files via RELATIVE paths only (`../../../modules/jobs/actions`). Qwik production-build footgun: the Rollup transform mis-resolves `~`/`~theme` aliased re-exports.
- Authorize as the first statement (before any `try`): `requireModuleAuth(event, "<id>")` for public actions/loaders (login + module active), `requireModuleAdmin(event, { module, scope: "global" | "any" })` for admin ones (both from `~/core`). Details and the rest of the auth rules: CLAUDE.md Security. After adding an action, grep that every `routeAction$` has its auth call.
- Validate with `zod$`, whitelist updatable columns, re-check ownership in both loader and action.

## Server/client split

- Keep server-only loader logic in `*-data.ts` files imported only inside `routeLoader$` (e.g. `loadAdminJobs`), so it never reaches the client bundle. No server code (services, `db`, `~/core` server exports) in components or `views.tsx`; view maps are bundled for the browser.
- `~/core/seo` and `~/core/ui` are client-safe; `~/core` is server+client but its server exports must only be referenced inside loaders/actions/`server$`. `~/core/setup-actions` is separate because importing a `routeAction$` needs the router runtime.

## Privacy

- Services return other users only as public shapes: relational queries use `with: { user: { columns: publicUserColumns } }` (selects use `publicUserSelect`), never `user: true` (`tests/unit/public-user-columns.spec.ts` fails on it). Map rows to public payloads with `toPublicUser` / module `toPublic*` functions; private fields only via explicitly named service methods. All exported from `~/core`.
- Leak check: `assertNoPrivateFields(value, { allow })` (`~/core`) wraps every admin `*-data.ts` result in the admin route: `routeLoader$(async (event) => assertNoPrivateFields(await loadX(event)))`. Allow a field only with a comment saying why.
- Loaders and `*-data.ts` files never use `db`; they call the module service.

## Schema

`schema.ts` exports its tables plus a default `defineModuleSchema({ tables, relations })` (from `~/core/schema`). `relations` is the module's relation part, including reverse relations on core tables (like `users.jobs`). `src/core/db/schema.ts` merges the parts through `src/core/registry/schemas.ts`, which must stay free of db connection/`~/env` imports because drizzle-kit loads it.

## Import boundary

Enforced by the `modules/**` override in `biome.json` (check with `npx biome lint modules`). Modules import only:
`~/core` (add exports to `src/core/index.ts` when a module needs more), `~/core/ui`, `~/core/schema`, `~/core/seo`, `~/core/setup-actions`, `~/contracts/*`, `~theme/*`, relative files in their own folder, and npm packages. Never `~/core/<area>/**` (areas, including the registry), `~/core-api`, `~/ui`, `~/components/**`, `~/env` or another module (`~modules/**`).
