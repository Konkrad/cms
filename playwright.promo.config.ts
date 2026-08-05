import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Nothing else in the test infra loads .env for the test-runner process
// itself (only the spawned app server loads it, via src/env.ts) — the specs'
// own Stripe client (confirming the mocked payment, generating the webhook
// signature) needs STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET directly in this
// process, so load it explicitly rather than assuming the shell already has
// it exported.
dotenv.config({ path: path.join(__dirname, ".env") });

// ── Promo video recording ───────────────────────────────────────────────────
// Drives the scripts in scripts/promo-videos/ that record real screen video of
// the product app for the marketing site (promo-site). Lives here (not in
// promo-site) because it exercises this app directly via tests/fixtures.ts —
// keeping it in-repo means specs use local imports instead of reaching across
// a sibling repo. The final .mp4 output still gets copied into promo-site's
// public/videos/ by hand after recording (rarely-regenerated marketing
// assets, not worth a cross-repo pipeline).
//
// Runs against its own isolated, freshly-seeded DB (same pattern as
// playwright.config.ts's e2e suite) so recordings never touch local dev data,
// and always captures video regardless of pass/fail.
const PROMO_DB = path.join(__dirname, "my-database.promo.db");
process.env.DB_PATH = PROMO_DB;

const PORT = process.env.PROMO_PORT ?? "5180";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./scripts/promo-videos",
	fullyParallel: false,
	// Both specs share one DB and the member spec depends on the event the
	// admin spec creates — running them concurrently across workers would race
	// or skip that dependency, so force full serialization, not just per-file.
	workers: 1,
	retries: 0,
	timeout: 120_000,
	reporter: "list",
	// Playwright deletes a passing test's output dir (including its video) by
	// default — the opposite of what we want here, since we're specifically
	// recording successful runs.
	preserveOutput: "always",
	webServer: {
		command: `npm run db:seed:promo -- --fresh && npm start -- --port ${PORT}`,
		// Playwright's readiness poll requires a response status < 404, and this
		// app has no root route (no src/routes/index.tsx — "/" 404s unless a CMS
		// homepage page happens to be seeded). /login always renders regardless
		// of seed content, so poll that instead; actual test navigation still
		// uses the plain BASE_URL via `use.baseURL` below.
		url: `${BASE_URL}/login`,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			DB_PATH: PROMO_DB,
			APP_URL: BASE_URL,
		},
	},
	use: {
		baseURL: BASE_URL,
		headless: true,
		viewport: { width: 1100, height: 750 },
		video: {
			mode: "on",
			size: { width: 1100, height: 750 },
		},
	},
	outputDir: "./scripts/promo-videos/output",
	projects: [
		{
			name: "promo-videos",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
