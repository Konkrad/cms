# Getting Started

This guide is for running the CMS for your own community: install it, configure it, customize the branding/theme, and deploy it.

## 1. Install & configure

```bash
git clone <this-repo>
cd cms
npm install
cp .env.example .env
```

All configuration is centralized in `src/env.ts` (validated with Zod at startup) — fill in `.env` with your own SMTP, S3/AWS, Stripe, and Telegram credentials. `docker-compose.yml` provides local stand-ins (Mailpit, MinIO, stripe-mock) if you don't want to wire up real services yet.

## 2. Set up the database

```bash
npm run db:generate   # only if you changed the schema
npm run migrate       # apply committed migrations (drizzle/)
npm run db:seed       # optional: seed sample content
```

## 3. Customize the branding/theme

Everything a logged-in or logged-out member sees on the public site — layout, colors, fonts, page-builder blocks, emails — lives in the separately-licensed [`theme/`](./theme) directory. The admin panel is core and is intentionally **not** themeable. Replace `theme/` with your own to reskin the site without touching core logic — see [Building a Custom Theme](./docs/theme-development.md) for the full folder-by-folder guide.

## 4. Deploy it

The repo ships as a single Docker image (multi-stage build, SQLite + optional Litestream replication to S3, migrations run automatically at boot). There's no prescribed deploy tool — build the image and run it with whatever fits your infrastructure (Fly.io, Kamal, a plain VPS, etc.). See [Deployment](./docs/deployment.md) for the full checklist (persistent volume for the DB, required env vars, health check endpoint, build-time vs runtime vars).

```bash
docker build \
  --build-arg VITE_S3_BASE_URL=https://your-bucket.s3.your-region.amazonaws.com \
  -t your-registry/cms:latest .
```

For a tour of what's manageable from the admin panel once it's running, see the [Admin Guide](./docs/admin-guide.md).
