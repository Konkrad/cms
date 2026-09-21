# Deployment

This repo ships everything needed to run as a single Docker container — how you
actually get that container onto a server is up to you. There's no prescribed
deploy tool: pick whatever you're comfortable with (Kamal, Fly.io, a plain `docker
run` on a VPS, Nomad, whatever your platform team already uses). The moving parts
below are the same regardless of the tool driving them.

## Moving parts

| File | Purpose |
|---|---|
| `Dockerfile` | Two-stage build: compile client + server bundles, then a slim runtime with Litestream |
| `docker/entrypoint.sh` | Boot sequence: restore DB if missing → start server (optionally under Litestream) |
| `litestream.yml` | Optional: continuously replicates the SQLite DB to S3-compatible object storage under the `db-backups/` prefix |
| `src/routes/up/index.ts` | Health check endpoint (`/up`) — wire it into whatever proxy/load balancer you use |
| `src/db/migrate.ts` | Programmatic Drizzle migration runner (idempotent), called directly by the server on every start |
| `src/entry.node-server.tsx` | Production Node server entry, built to `server/entry.node-server.js`; runs migrations before it starts listening |

## The container's expectations

- **Persistent storage for SQLite.** The DB file lives at `DB_PATH` (e.g.
  `/data/db.sqlite`) — mount a volume there so it survives restarts/redeploys.
- **Migrations run automatically at boot, built into the app itself.**
  `entry.node-server.tsx` calls `runMigrations()` (`src/db/migrate.ts`) before it
  starts listening, so a normal redeploy applies any new committed migration in
  `drizzle/` — there's no separate migrate step or script in `docker/entrypoint.sh`.
  Keep migrations in sync with the schema via `npm run db:generate` (see CLAUDE.md
  § Core Rules).
- **`/up` only proves the process serves HTTP** — it deliberately checks no
  downstream services (DB, S3, SMTP). Point your platform's health check at it.
- **Env vars**: everything in `src/env.ts` must be set, including `S3_BASE_URL`
  (the public base URL for S3 objects) — it's a plain runtime var like the
  rest, resolved at request time rather than compiled into the client bundle,
  so changing it doesn't require a rebuild.
- **Litestream is optional.** If you want continuous SQLite → S3 replication for
  disaster recovery, set `DB_PATH`/`S3_BUCKET`/`AWS_*` and run the container as
  written (`entrypoint.sh` wraps the server in `litestream replicate -exec`). If
  you don't want it, strip that step out of `entrypoint.sh` and drop
  `litestream.yml` — nothing else depends on it.

## Building the image

```bash
docker build -t your-registry/cms:latest .
```

Push it to whatever registry your deploy tool expects, then run it with the env
vars from `src/env.ts` and a volume mounted at `DB_PATH`.

## Suggested approach

The public-facing look of the site lives entirely in `theme/` (see
[Building a Custom Theme](./theme-development.md)) — the core app underneath is
the same regardless of who's running it. Fork or wrap this repo, replace
`theme/` with your own branding/layout, build the Docker image from your
customized checkout, deploy it. For local iteration on a theme without a full
rebuild each time, see [Building a Custom Theme § Dev image + theme folder
mapping](./theme-development.md) instead.

There's no single "correct" deployment path baked into this repo on purpose —
this is meant to be adapted per-deployment, not a specific ops setup that
everyone has to reuse.
