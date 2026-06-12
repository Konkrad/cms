# Deployment (Kamal)

The app deploys as a single Docker container to one server using [Kamal](https://kamal-deploy.org/). Kamal's built-in proxy terminates TLS (automatic Let's Encrypt) and routes traffic to the app on port 3000. SQLite lives on a persistent Docker volume and is continuously replicated to S3-compatible object storage via [Litestream](https://litestream.io/).

## Moving parts

| File | Purpose |
|---|---|
| `config/deploy.yml` | Kamal config: server, registry, proxy/TLS, env vars, volume |
| `.kamal/secrets` | Secret *values* (git-ignored); names are declared in `deploy.yml` under `env.secret` |
| `Dockerfile` | Two-stage build: compile client + server bundles, then a slim runtime with Litestream |
| `docker/entrypoint.sh` | Boot sequence: restore DB if missing → run migrations → start server under Litestream |
| `litestream.yml` | Replicates the SQLite DB to the app's S3 bucket under the `db-backups/` prefix |
| `src/routes/up/index.ts` | Health check endpoint (`/up`) used by the Kamal proxy |
| `scripts/migrate.js` | Programmatic Drizzle migration runner (idempotent), run on every container start |
| `src/entry.node-server.tsx` | Production Node server entry, built to `server/entry.node-server.js` |

## Prerequisites

- A server reachable over SSH as root (Kamal installs Docker itself on first `kamal setup`).
- A DNS A record for your domain pointing at the server IP (required for Let's Encrypt).
- A container registry (default in config: `ghcr.io`) and a token with push rights (`write:packages` for GHCR).
- An S3-compatible bucket (e.g. OVH Object Storage, AWS S3) — shared by app uploads and Litestream backups.
- Kamal installed locally: `gem install kamal` (or run it via Docker, see Kamal docs).

## One-time setup

### 1. Fill in `config/deploy.yml`

Replace every `<PLACEHOLDER>`:

- `image`: repo path without the registry host, e.g. `acme/cms` for `ghcr.io/acme/cms`
- `servers.web`: the server IP
- `proxy.host`: the public domain
- `registry.username`: your registry username
- `builder.args.VITE_S3_BASE_URL`: public base URL of the bucket — this is **baked into the client bundle at build time**, not a runtime var
- `env.clear`: `APP_URL`/`ORIGIN` (your domain), S3 region/endpoint/bucket, SMTP host/from

### 2. Provide secrets in `.kamal/secrets`

The file is git-ignored and ships as a pass-through template (`NAME=$NAME`): either export the variables in your shell before deploying, or replace the right-hand sides with literal values. Required secrets:

- `KAMAL_REGISTRY_PASSWORD` — registry token
- `MAGIC_LINK_SECRET`, `ALTCHA_HMAC_KEY` — app auth/captcha
- `SMTP_USER`, `SMTP_PASS`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — used by both app uploads and Litestream
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`
- `PUBLIC_MAPBOX_ACCESS_TOKEN`

### 3. First deploy

```bash
kamal setup
```

This installs Docker on the server, boots the kamal-proxy, builds and pushes the image, and starts the app. TLS certificates are provisioned automatically once DNS resolves.

## Deploying changes

```bash
kamal deploy
```

Builds the image (amd64), pushes it, and performs a zero-downtime swap: the new container must answer `200` on `/up` before the proxy switches traffic over.

Migrations run automatically at container start (see boot sequence below), so a normal deploy applies any new committed migration in `drizzle/` before the server starts. Keep migrations in sync with the schema via `npm run db:generate` (see CLAUDE.md § Core Rules).

## What happens at container boot

`docker/entrypoint.sh` runs on every start:

1. **Restore if needed** — if `/data/db.sqlite` doesn't exist (fresh server or replaced volume), Litestream restores the latest snapshot from the bucket. No-op on the very first boot when no replica exists yet.
2. **Migrate** — `node scripts/migrate.js` applies committed Drizzle migrations (idempotent, tracked in `__drizzle_migrations`).
3. **Serve** — the Node server starts under `litestream replicate -exec`, so the SQLite WAL is continuously streamed to `s3://<bucket>/db-backups/` while the app runs.

The database file sits on the named volume `cms_data` (mounted at `/data`), so it survives deploys and container restarts; Litestream is disaster recovery, not the primary storage.

## Day-to-day commands

Aliases defined in `config/deploy.yml`:

```bash
kamal logs              # follow app logs
kamal console           # interactive shell in the running container
kamal migrate           # re-run the migration runner manually
```

Other useful Kamal commands:

```bash
kamal app details       # container status
kamal rollback <ver>    # roll back to a previously deployed image version
kamal proxy logs        # TLS / routing issues
```

## Disaster recovery

To rebuild on a new server (or after losing the volume): point DNS at the new IP, update `servers.web` in `deploy.yml`, and run `kamal setup`. The entrypoint finds no database on the fresh volume and restores the latest Litestream snapshot from the bucket automatically. Verify with `kamal logs` — you should see "attempting Litestream restore from replica".

To restore manually to a point in time, use `litestream restore` inside the container (`kamal console`); see the [Litestream docs](https://litestream.io/reference/restore/).

## Gotchas

- **`VITE_S3_BASE_URL` is a build-time value.** Changing it requires a rebuild (`kamal deploy`), not just an env change — it's compiled into the client bundle via `builder.args`.
- **The image build skips type checking** (`build.client` + `build.server` only, no `build.types`). Run `npm run build.types` locally/in CI; a deploy will not catch type errors.
- **`/up` only proves the process serves HTTP** — it deliberately checks no downstream services (DB, S3, SMTP).
- **Secrets never go in `deploy.yml`** — it only lists names under `env.secret`; values live exclusively in the git-ignored `.kamal/secrets`.
- **For AWS S3 proper** (instead of an S3-compatible provider), leave `AWS_ENDPOINT` empty and set `force-path-style: false` in `litestream.yml`.
