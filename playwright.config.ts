import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "playwright/.auth/user.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: process.env.CI ? 60000 : 30000,
  reporter: "list",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      // Route Telegram calls to the in-process mock server started by tests.
      // This variable is only injected when Playwright launches the dev server;
      // it has no effect on production or normal `npm run dev` sessions.
      TELEGRAM_API_URL: "http://localhost:8099",
    },
  },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
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
      testIgnore: ["**/auth.spec.ts", "**/profile-setup.spec.ts", "**/auth.setup.ts"],
    },
  ],
});
