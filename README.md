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

## Theming

Public-facing presentation (design tokens, layout chrome, page blocks, and
route views) lives in [`theme/`](theme/README.md) and is licensed separately
from the rest of the app — a community can fork or swap that folder to reskin
the public site without touching core logic. The admin panel is **not**
themeable. See [CLAUDE.md](CLAUDE.md) for the theme/core boundary rules.

### Using a Custom Theme

The application publishes a base Docker image to `ghcr.io/konkrad/cms:latest` that contains
a generic starting theme. You have several options for using a custom theme:

**Option 1: Build from source (Recommended for full customization)**

If you need a custom theme that may use server-side features, you must build from source
because some theme files are TypeScript/JSX that depend on Qwik and must be compiled with
the application:

```bash
# Clone the repository
git clone https://github.com/konkrad/cms.git
cd cms

# Replace the theme directory with your custom theme
rm -rf theme/
cp -r my-custom-theme/ theme/

# Install dependencies and build
npm install
npm run build

# Run locally
npm run preview

# Or build Docker image
docker build -t my-cms .
docker run -p 3000:3000 my-cms
```

**Option 2: Runtime theme loading (Client-side only)**

If your theme contains only client-side components (no server-side Node.js APIs),
you can compile it separately and load it at runtime:

```bash
# Step 1: Compile your theme to ESM JavaScript
# Your theme project should output files like:
#   output/
#   ├── routes/
#   │   └── posts/
#   │       └── PostView.js
#   ├── chrome/
#   │   └── Navigation/
#   │       └── Navigation.js
#   └── ...

# Step 2: Start the application with runtime theme enabled
docker run -p 3000:3000 \
  -e THEME_BASE_URL=/custom-theme/ \
  -v /path/to/compiled-theme:/app/public/custom-theme \
  ghcr.io/konkrad/cms:latest
```

Then in your route components, use the runtime theme hooks:
```tsx
import { useRuntimeThemeComponent$ } from '~/utils/runtime-theme-loader';

const PostView = useRuntimeThemeComponent$('routes/posts/PostView');
<PostView.value post={post} />
```

**Note:** Runtime theme files must:
- Be pre-compiled to ESM JavaScript (.js)
- Contain only client-side code (no `node:fs`, `node:path`, `server$`, etc.)
- Use Qwik's `component$` and other client-side primitives

**Option 3: Use the base image with the default theme**

```bash
# Run with the generic theme
docker run -p 3000:3000 ghcr.io/konkrad/cms:latest
```

**Theme Structure:**

Your custom theme must maintain the same structure as the original `theme/` directory:
```
theme/
├── blocks/          # Page builder blocks
├── chrome/          # Layout components (Navigation, SiteFooter)
├── routes/          # Route view components
├── emails/          # Email templates
├── shared/          # Shared components
├── tokens/          # Design tokens (colors, typography)
└── README.md        # Theme documentation
```

**How it works:**
- Theme components use dynamic imports via `useThemeComponent$` and `useThemeNamedExports$` hooks (built-in)
  or `useRuntimeThemeComponent$` and `useRuntimeThemeNamedExports$` hooks (runtime loading)
- Built-in themes are TypeScript/JSX files compiled together with the application by Qwik's optimizer
- Runtime themes are pre-compiled ESM JavaScript files loaded dynamically at runtime
- The theme is kept separate from core application logic, but built-in themes must be built together with the app

For details on the theme structure and contract, see [theme/README.md](theme/README.md).

## Deployment

The app deploys with Kamal (single server, Docker, SQLite + Litestream backups). See [docs/deployment.md](docs/deployment.md).
