import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Runs once before the whole e2e suite.
 *
 * The test database is reseeded by the webServer command (see
 * playwright.config.ts) because Playwright launches the webServer before this
 * hook. Here we only remove stale auth state so a run never starts authenticated
 * against the previous DB's (now-gone) session — the `setup` project recreates a
 * fresh session afterwards.
 */
export default function globalSetup() {
  const authFile = path.join(ROOT, "playwright/.auth/user.json");
  if (fs.existsSync(authFile)) fs.rmSync(authFile);
}
