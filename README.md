# Community Management System

Opinionated, minimal Content Management System for community management.

Features:
- Zod for schemas
- Drizzle for ORM
- Turso for database
- Qwik with QwikCity as a framework

## Getting Started

### Prerequisites
- Node.js (^18.17.0 || ^20.3.0 || >=21.0.0)
- Docker (for Mailpit, MinIO, stripe-mock)

### Setup

```sh
# 1. Install dependencies
npm install

# 2. Start local services (Mailpit, MinIO, stripe-mock)
docker compose up -d

# 3. Copy env and fill in values
cp .env.example .env

# 4. Seed the database (creates a fresh SQLite DB with test data)
npm run db:seed

# 5. Start the dev server
npm run dev
```

### Seeded Admin Account

The seed creates an admin account you can use to log in:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Auth  | Magic link (check Mailpit at http://localhost:8025) |

Go to the login page, enter `admin@example.com`, then open Mailpit to click the magic link.

### Local Services (docker compose)

| Service | URL | Purpose |
|---------|-----|---------|
| Mailpit UI | http://localhost:8025 | Email inbox (catches all outgoing mail) |
| Mailpit SMTP | localhost:1025 | SMTP server |
| MinIO Console | http://localhost:9001 | S3-compatible file storage (user: `test`, pass: `testtest`) |
| MinIO API | http://localhost:9000 | S3 API |
| stripe-mock | http://localhost:12111 | Stripe API mock |

### npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server |
| `npm run db:seed` | Seed database (fresh, deletes existing) |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run test` | Run Playwright tests |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run biome` | Lint & format |

Environment variables
---------------------

All environment variables for the application are managed in one central place and validated at startup using Zod to ensure the app fails fast on misconfiguration.

Central file
- `src/env.ts`:
  - Loads `.env` in non-production environments.
  - Validates and parses environment variables using Zod (schema-driven).
  - Exposes a typed `env` object for the rest of the app (e.g. `env.APP_URL`, `env.SMTP_HOST`, `env.isProduction`).
  - Produces clear, structured error output and prevents the server from starting if the configuration is invalid.

Development
- Copy `.env.example` to `.env` and fill in values for local development.
- Keep real secrets out of version control and use your deployment platform's secret store in production.

Usage
- Import the validated environment from anywhere in the codebase:
  - `import { env } from '~/env'`
- Use `env` instead of `process.env.*` so you get typed access and guaranteed validation.
- When adding new environment variables, update the schema in `src/env.ts` and (optionally) add examples to `.env.example`.

Why this matters
- Centralizing environment variables makes configuration consistent and easier to maintain.
- Zod validation ensures misconfiguration is caught early with actionable errors.

## Deployment

The app deploys with Kamal (single server, Docker, SQLite + Litestream backups). See [docs/deployment.md](docs/deployment.md).
