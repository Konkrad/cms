# Community Management System

Opinionated, minimal Content Management System for community management.

Features:
- Zod for schemas
- Drizzle for ORM
- Turso for database
- Qwik with QwikCity as a framework

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
