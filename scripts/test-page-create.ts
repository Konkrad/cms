/**
 * Playwright test: create a new page at /admin/global/pages/new/
 *
 * Run:  npx tsx scripts/test-page-create.ts
 *
 * Strategy: inject a real session row into the DB for the admin user,
 * set it as a cookie, then drive the form with Playwright.
 */

import { chromium } from "@playwright/test";
import Database from "better-sqlite3";
import crypto from "crypto";

const BASE_URL = "http://localhost:5173";
const DB_PATH = "my-database.db";

// ── 1. Create a session in the DB for the admin user ────────────────────────

const sqlite = new Database(DB_PATH);

const admin = sqlite
  .prepare("SELECT id FROM users WHERE role = 'admin' AND name = 'Konrad' LIMIT 1")
  .get() as { id: string } | undefined;

if (!admin) throw new Error("Admin user not found");

const sessionToken = crypto.randomBytes(48).toString("hex");
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const sessionId = crypto.randomUUID();

sqlite
  .prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
  )
  .run(sessionId, admin.id, sessionToken, expiresAt);

sqlite.close();

console.log(`Created session ${sessionId} for user ${admin.id}`);

// ── 2. Launch browser, inject cookie, test the form ─────────────────────────

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();

  // Set the session cookie before navigating
  await context.addCookies([
    {
      name: "session",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);

  const page = await context.newPage();

  // Capture all console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("[browser]", msg.text());
  });
  page.on("pageerror", (err) => console.error("[pageerror]", err.message));
  page.on("requestfailed", (req) =>
    console.error("[reqfailed]", req.url(), req.failure()?.errorText),
  );

  console.log("\nNavigating to /admin/global/pages/new/ ...");
  const response = await page.goto(`${BASE_URL}/admin/global/pages/new/`, {
    waitUntil: "networkidle",
  });

  console.log("Status:", response?.status());
  console.log("URL after nav:", page.url());

  // Screenshot of initial state
  await page.screenshot({ path: "tmp/page-create-before.png", fullPage: true });
  console.log("Screenshot saved: tmp/page-create-before.png");

  // Check what's on the page
  const heading = await page.textContent("h1").catch(() => null);
  console.log("Heading:", heading);

  // Wait for Qwik to hydrate — the submit button becomes interactive
  await page.waitForFunction(
    () => document.querySelector('button[type="submit"]')?.hasAttribute("disabled") === false,
    { timeout: 10000 }
  ).catch(() => console.warn("Timed out waiting for hydration"));

  const formExists = await page.locator("form").count();
  console.log("Forms found:", formExists);

  if (formExists === 0) {
    console.error("❌ No form found on the page – dumping body text:");
    console.error(await page.textContent("body"));
    await browser.close();
    process.exit(1);
  }


  // Intercept q-data (action response) to see raw server output
  page.on("response", async (res) => {
    if (res.url().includes("q-data.json")) {
      const text = await res.text().catch(() => "");
      console.log(`[q-data] ${res.status()} ${res.url()}\n`, text.substring(0, 500));
    }
  });

  // Dismiss any Vite error overlay that may be lingering
  const overlay = page.locator("vite-error-overlay");
  if (await overlay.count() > 0) {
    console.log("Dismissing Vite error overlay...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    // If still there, reload
    if (await overlay.count() > 0) {
      await page.reload({ waitUntil: "networkidle" });
    }
  }

  // Fill in the form
  console.log("\nFilling form...");

  await page.fill('input[name="title"]', "Test Page from Playwright");
  await page.fill('input[name="slug"]', "test-page-playwright");

  // Leave parentId as default (None)
  // Leave status as default (draft)

  await page.screenshot({ path: "tmp/page-create-filled.png", fullPage: true });
  console.log("Screenshot saved: tmp/page-create-filled.png");

  // Submit
  console.log("Submitting...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch((e) => {
      console.warn("Navigation after submit timed out or failed:", e.message);
    }),
    page.click('button[type="submit"]'),
  ]);

  console.log("URL after submit:", page.url());
  await page.screenshot({ path: "tmp/page-create-after.png", fullPage: true });
  console.log("Screenshot saved: tmp/page-create-after.png");

  const bodyText = await page.textContent("body");
  const errorEl = await page.locator(".bg-red-100").count();

  if (page.url().includes("/builder")) {
    console.log("\n✅ Success! Redirected to builder:", page.url());
  } else if (errorEl > 0) {
    const errText = await page.locator(".bg-red-100").first().textContent();
    console.error("\n❌ Error shown on page:", errText);
  } else {
    console.warn("\n⚠️  Unexpected state. URL:", page.url(), "\nBody snippet:", bodyText?.substring(0, 500));
  }

  await browser.close();

  // Clean up test session
  const db2 = new Database(DB_PATH);
  db2.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  db2.close();
  console.log("Cleaned up test session.");
})();
