import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "playwright/.auth/user.json");

// ── Isolated test environment ──────────────────────────────────────────────
// The e2e suite runs against its OWN database file and its OWN dev server on a
// dedicated port — fully separate from local development (my-database.db on
// :5173). This avoids the failure mode where `npm run db:seed --fresh` unlinks
// and recreates the DB file while a `npm start` is running: that server keeps
// an open handle to the old (deleted) inode and never sees the reseeded data or
// the auth session, so every authenticated test silently runs as a guest.
//
// The webServer command wipes+reseeds this DB fresh via `db:seed:test --fresh`
// (self-contained e2e fixtures only — NOT scripts/seed.ts's demo content; specs
// that need a group/page/post create their own via tests/fixtures.ts) and then
// starts a dedicated server bound to it (reuseExistingServer:false, so we never
// reuse a stale ambient server). Seeding lives in the command — not globalSetup —
// because Playwright launches the webServer before globalSetup runs.
const TEST_DB =
	process.env.DB_PATH ?? path.join(__dirname, "my-database.test.db");
// Make the test DB the default for the Playwright runner process too, so worker
// fixtures and any app code imported in-process (services in test-data.ts, etc.)
// open the same file the server uses.
process.env.DB_PATH = TEST_DB;

const PORT = process.env.E2E_PORT ?? "5179";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./tests/e2e",
	// Clears stale auth state before the run (the test DB itself is reseeded by
	// the webServer command, which Playwright launches before globalSetup).
	globalSetup: "./tests/e2e/global-setup.ts",
	fullyParallel: false,
	// Heavy tests can intermittently lose a lock or time out under load; retry
	// once locally (twice on CI) so confirmed-flaky tests don't fail the run.
	retries: process.env.CI ? 2 : 1,
	timeout: process.env.CI ? 60000 : 30000,
	reporter: "list",
	webServer: {
		// Wipe + reseed the isolated test DB (self-contained e2e fixtures, not the
		// demo seed), then start the dedicated server bound to it.
		command: `npm run db:seed:test -- --fresh && npm start -- --port ${PORT}`,
		url: BASE_URL,
		// Never reuse an ambient dev server — always start a dedicated one bound to
		// the freshly-seeded test DB. Fails loudly if the port is already taken.
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			// Bind the server to the isolated test DB.
			DB_PATH: TEST_DB,
			// Build magic links / redirects against the test server, not the default
			// :5173 — otherwise emailed links point at the dev server + dev DB.
			APP_URL: BASE_URL,
			// Route Telegram calls to the in-process mock server started by tests.
			TELEGRAM_API_URL: "http://localhost:8099",
		},
	},
	use: {
		baseURL: BASE_URL,
		headless: true,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		// Run once before all authenticated tests to create shared session
		{ name: "setup", testMatch: "**/auth.setup.ts" },

		// Tests that exercise the login flow itself — no pre-stored credentials
		{
			name: "auth-flows",
			use: { ...devices["Desktop Chrome"] },
			testMatch: ["**/auth.spec.ts", "**/profile-setup.spec.ts"],
		},

		// All other tests start with the shared authenticated session
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
			dependencies: ["setup"],
			testIgnore: [
				"**/auth.spec.ts",
				"**/profile-setup.spec.ts",
				"**/auth.setup.ts",
			],
		},
	],
});
