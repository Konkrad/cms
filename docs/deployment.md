# Deployment

This repo ships everything needed to run as a single Docker container — how you
actually get that container onto a server is up to you. There's no prescribed
deploy tool: pick whatever you're comfortable with (Kamal, Fly.io, a plain `docker
run` on a VPS, Nomad, whatever your platform team already uses). The moving parts
below are the same regardless of the tool driving them.

## Moving parts

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build with two final targets (`docker build --target=<name>`): `runtime` (theme baked in, slim image) and `runtime-theme` (builds at container startup against a mounted theme/, see "Runtime theme build" below) |
| `docker/entrypoint.sh` | Boot sequence for the `runtime` target: restore DB if missing → start server (optionally under Litestream) |
| `docker/entrypoint-runtime-theme.sh` | Boot sequence for the `runtime-theme` target: overlay mounted theme (if any) → build → restore DB if missing → start server |
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
- **Env vars**: everything in `src/env.ts` must be set. `VITE_S3_BASE_URL` is the
  one exception — it's a *build-time* value baked into the client bundle
  (`import.meta.env`), so it must be passed as a Docker build arg, not a runtime
  env var; changing it requires a rebuild.
- **Litestream is optional.** If you want continuous SQLite → S3 replication for
  disaster recovery, set `DB_PATH`/`S3_BUCKET`/`AWS_*` and run the container as
  written (`entrypoint.sh` wraps the server in `litestream replicate -exec`). If
  you don't want it, strip that step out of `entrypoint.sh` and drop
  `litestream.yml` — nothing else depends on it.

## Building the image

```bash
docker build --target=runtime \
  --build-arg VITE_S3_BASE_URL=https://your-bucket.s3.your-region.amazonaws.com \
  -t your-registry/cms:latest .
```

Push it to whatever registry your deploy tool expects, then run it with the env
vars from `src/env.ts` and a volume mounted at `DB_PATH`. (`--target=runtime` is
this repo's default target too, so a bare `docker build` without `--target`
builds the same thing — pass it explicitly to be unambiguous about which of
the Dockerfile's two targets you mean; see "Runtime theme build" below for
the other one.)

## Suggested approach

The public-facing look of the site lives entirely in `theme/` (see
[Building a Custom Theme](./theme-development.md)) — the core app underneath is
the same regardless of who's running it. The default flow:

1. Fork or wrap this repo, replace `theme/` with your own branding/layout.
2. Build the Docker image from your customized checkout.
3. Deploy that image with whatever tooling fits your infrastructure.

There's no single "correct" deployment path baked into this repo on purpose —
this is meant to be adapted per-deployment, not a specific ops setup that
everyone has to reuse. The Dockerfile's `runtime-theme` target (below) is one
such alternative.

## Runtime theme build

The Dockerfile's `runtime-theme` target builds a different kind of image:
instead of baking a theme in at `docker build` time, it ships full build
tooling (`node_modules` with devDependencies, the native-module toolchain,
`vite` itself) and runs `npm run build.client && npm run build.server` at
**container startup**, via `docker/entrypoint-runtime-theme.sh`. The
deployer mounts their `theme/` directory at `/theme-src` (bind mount,
ConfigMap, PVC — whatever the orchestrator supports); the entrypoint
overlays it onto the image's own `theme/` before building. With nothing
mounted, it falls back to building the image's bundled default theme, so
the image is runnable standalone.

```bash
docker build --target=runtime-theme -t your-registry/cms:runtime-theme .

docker run \
  -v /path/to/my-theme:/theme-src:ro \
  -v cms-data:/data \
  -e DB_PATH=/data/db.sqlite \
  -e VITE_S3_BASE_URL=https://your-bucket.s3.your-region.amazonaws.com \
  <the rest of src/env.ts's required vars> \
  your-registry/cms:runtime-theme
```

This is a genuinely different tradeoff from the `runtime` target, not a
strict improvement:

- **One image, any theme.** Since the build happens against whatever's
  mounted in, the same published image tag serves every deployment — swap
  the mounted directory and restart the container. No per-theme image
  build, no chunk-naming/manifest-merge machinery to keep theme-owned and
  core-owned build output apart (contrast a hypothetical build-time overlay
  mechanism) — it's just one ordinary `vite build`, so there's no CSS
  wholesale-replace caveat either: Tailwind compiles core and theme
  together in the same pass, correctly, every time.
- **Startup latency.** Every container start (including a routine restart
  or a rolling deploy replica) pays for a full build — seconds at minimum,
  more depending on hardware and how much CI-style caching (if any) is
  wired up for `node_modules`/Vite's own cache in the deployment
  environment. Not a fit for aggressive autoscaling or restart-heavy
  workflows without addressing that first.
- **A larger, less locked-down runtime image.** The native-module
  toolchain (`python3 make g++`) and full `devDependencies` stay in the
  image that actually serves traffic, rather than being discarded after a
  build stage the way the `runtime` target does it.
- **`VITE_S3_BASE_URL` still works exactly as documented above** — it's
  read from the container's own runtime environment when the build runs
  inside the entrypoint, no build-arg plumbing needed.
