---
name: job-portal
description: Use when working on the job portal, the jobs module (src/modules/jobs), the /jobs, /jobs/mine, /jobs/new routes, /admin/root/jobs, job approval or expiry rules, or the job seed data.
---

# Job portal

Members post job listings that go live only after admin approval. Worked example of a module: see the `add-module` skill.

## Routes

| Path | Who | What |
|---|---|---|
| `/jobs` | authenticated users | approved, non-expired job listings |
| `/jobs/[id]` | authenticated users | single job detail |
| `/jobs/new` | authenticated users | submission form |
| `/jobs/mine` | authenticated users | own submissions with status |
| `/jobs/mine/[id]/edit` | owner, pending only | edit a pending submission |
| `/admin/root/jobs` | root admin (or representative of the root) | list all jobs, approve, delete |
| `/admin/root/jobs/[id]/edit` | root admin (or representative of the root) | full edit + status toggle |

## Key rules

- Jobs are owned by a scope (`scope_id`; a submission from `/<scope path>/jobs/new` belongs to that scope, the root by default). The admin section exists in every scope's admin (`scopes: "all"`): loaders (`src/modules/jobs/admin/list-data.ts`, `edit-data.ts`) and admin actions call `requireModuleAdmin(event, { module: "jobs" })` (from `~/core`) as their first statement, list only the URL scope's subtree and re-check every job id with `requireWithinScope`. `/jobs` lists jobs through `requestContentFilter` (the scope's own, its ancestors' and its descendants' jobs).
- All public-facing job pages and actions call `requireAuth` (pages) or `requireModuleAuth(event, "jobs")` (actions) first; unauthenticated visitors are redirected to `/login`.
- `status` is `pending` on creation; admin sets it to `approved` to make it visible.
- `expiresAt` is capped at 30 days from today, enforced server-side in both the submit and user-edit actions (`src/modules/jobs/actions.ts`).
- Editing is blocked once a job is approved: the page loader (`editMyJobPage` in `pages.ts`) redirects away and the action re-checks ownership + `status === "pending"`.
- The body field uses BlockNote with `textOnly={true}`, which removes image/file/audio/video block types. The HTML `body` is rendered with `dangerouslySetInnerHTML`, so it is sanitized server-side in `jobsService.create`/`update` via `sanitizeRichHtml()`; the editor is not a security boundary (CLAUDE.md Security § Sanitize stored HTML).
- Public payloads go through `toPublicJob` (`src/modules/jobs/public-job.ts`) and the contract types in `src/contracts/jobs.ts`.

## Schema and service

- Module `src/modules/jobs/`: schema `schema.ts`, service `service.ts`, public pages `pages.ts`/`views.tsx`/`actions.ts`, admin UI+actions `admin/`, list pagination composable `useJobsPagination.ts`. Schema fields: `id`, `title`, `body`, `editorState`, `locationType`, `city`, `country`, `link`, `expiresAt`, `status`, `suggestedBy`, `createdAt`, `updatedAt`.
- Service: `src/modules/jobs/service.ts` exports `jobsService` and the `JobWithUser` type (author as `PublicUser`).
- Relations: `jobs.suggestedBy -> users.id`, defined in the module's `defineModuleSchema` relation part in `src/modules/jobs/schema.ts` (including the reverse relation `users.jobs`); `src/core/db/schema.ts` merges it through `src/core/registry/schemas.ts`.

## Seed

The seed (`scripts/seed.ts`) inserts 7 jobs: 4 approved (visible), 2 pending (admin queue), 1 expired (filtered out). Jobs appear in both the main and footer menus at `/jobs`.

## Tests

`tests/e2e/jobs.spec.ts`, `jobs-pagination.spec.ts`, `jobs-privacy.spec.ts`, `tests/unit/jobs.service.spec.ts`; fixtures `createJobInDb`, `getJobById`, `deleteJobById` (see the `testing` skill).
