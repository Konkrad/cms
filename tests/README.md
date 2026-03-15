Playwright E2E test instructions

Prerequisites:
- Start Mailpit: docker-compose up -d mailpit
- Ensure stripe-mock is available (npm i -D stripe-mock) or use the start:stripe-mock npm script
- Set environment variable: E2E_ALLOW_DB_WRITE=true

Run seeds:
- node ./scripts/run-seed.js

Run tests:
- npx playwright test tests/e2e

Notes:
- The seeder and test helpers expect your DB file at ./my-database.db
- Seed SQL is a template; adjust columns to match your schema
- Mailpit API base can be set with MAILPIT_API_URL environment variable
