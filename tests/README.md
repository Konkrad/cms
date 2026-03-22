Playwright E2E test instructions

Prerequisites:
- Start Mailpit: docker-compose up -d mailpit
- Ensure stripe-mock is available (npm i -D stripe-mock) or use the start:stripe-mock npm script

Seeding / DB bootstrap

There are two seeding runners for different purposes:

- Test seeder (used by CI and Playwright): runs schema push + rich E2E seed
	- `scripts/run-seed.js` — intended for E2E tests. Requires `E2E_ALLOW_DB_WRITE=true`.
	- Use:
		```bash
		export E2E_ALLOW_DB_WRITE=true
		node ./scripts/run-seed.js
		```

- Dev seeder (local development): runs schema push, then lightweight dev-only creators
	- `scripts/run-seed-dev.js` — intended for local dev. Does not require `E2E_ALLOW_DB_WRITE`.
	- Use:
		```bash
		node ./scripts/run-seed-dev.js
		```

Run tests:
- npx playwright test tests/e2e

Notes:
- The seeder and test helpers expect your DB file at ./my-database.db
- Seed SQL is a template; adjust columns to match your schema
- Mailpit API base can be set with `MAILPIT_API_URL` environment variable
