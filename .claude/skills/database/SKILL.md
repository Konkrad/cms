---
name: database
description: Use when changing a Drizzle schema file, adding or editing tables/columns, generating or applying migrations, touching src/core/db or drizzle/, or when a local my-database.db is out of sync or must be reset.
---

# Database and migrations

- Use `better-sqlite3` with Drizzle.
- Core schemas live in their area under `src/core/<area>/` (`schema.ts` or `schema/`); module schemas live in `src/modules/<id>/schema.ts` (one file per module), or, for a module with many tables (events), in `src/modules/<id>/schema/` with one file per table plus `schema/index.ts` and no `schema.ts`. `src/core/db/schema.ts` merges them (module parts via `src/core/registry/schemas.ts`). `schemas.ts` must stay free of db connection and `~/env` imports because drizzle-kit loads it. See the `add-module` skill for `defineModuleSchema`.
- Migrations use one mechanism everywhere, local dev included: after changing a schema file, run `npm run db:generate` once to write the migration file, then commit it under `drizzle/`.
- Applying migrations is fully automatic and built into the app, not an external script or npm hook. `runMigrations()` in `src/core/db/migrate.ts` is called directly from `src/entry.node-server.tsx` before it starts listening (prod) and from `vite.config.ts` on dev-server boot (`command === "serve"`, dynamically imported so `vite build` never eagerly loads the validation in `src/env.ts`). It runs whenever the server process starts, regardless of how it is launched. There is no manual init/migrate step and no shell wrapper.
- Never apply schema changes with `drizzle-kit push`. A DB it creates has no `__drizzle_migrations` tracking row, so the migration runner will later try to recreate tables that already exist and fail.
- History starts at one baseline (`drizzle/<timestamp>_baseline`, generated from the current schema; the old history with its data moves is gone, no compatibility with older databases). Its only hand-written statement is the root scope insert at the end (every content row needs a scope; seeds reuse that root). A database built from the old history, or via `push`, cannot be upgraded: delete it with its `-shm`/`-wal` files, then let `npm start` (or a seed) migrate a new one and seed it (`npm run db:seed` / `npm run db:seed:test -- --fresh`).
- New migrations are plain `npm run db:generate` output on top of the baseline. Never hand-write data moves into them (breaking changes are fine; recreate the DB instead).
- Seeds: `npm run db:seed` (demo data, `scripts/seed.ts --fresh`), `npm run db:seed:test` (isolated e2e fixtures, see the `testing` skill).
- Authentication tables and helpers: `src/core/auth/` (schema in `src/core/auth/schema/`).
