# Contributing

Need a feature that isn't here, or found a bug? Help us build it.

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d   # local email/storage/payments stand-ins
npm start                                          # http://localhost:5173
```

Seed sample content any time with `npm run db:seed`.

If you change a schema file under `src/db/schemas/`, run `npm run db:generate` once to write the migration and commit it under `drizzle/`; the next `npm start` applies it automatically. Never use `drizzle-kit push` — a DB it creates isn't tracked in `__drizzle_migrations`, so the migration runner will later fail trying to recreate tables that already exist. If that happens (or you're picking up an old checkout), delete `my-database.db*` and let `npm start` rebuild it from `drizzle/`.

A [`.devcontainer`](./.devcontainer) is included if you'd rather work inside Codespaces/VS Code Dev Containers — it wires up the same services and starts the dev server automatically.

## Before opening a PR

```bash
npm run test:unit    # Vitest unit tests
npx playwright test  # Playwright e2e tests (needs the docker-compose services running)
npm run biome        # lint + autofix
```

A pre-commit hook (installed via `npm install`) runs Biome and the unit suite on staged files automatically. See [CLAUDE.md](./CLAUDE.md) for the project's architectural conventions (Qwik patterns, the theme/core boundary, security rules, testing requirements) and [docs/](./docs) for deeper internal documentation on specific flows (events, ticketing, roles & permissions).
