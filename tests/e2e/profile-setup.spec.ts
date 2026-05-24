import { test, expect } from "../fixtures-e2e";
import { waitForEmailHtml, extractAllLinks } from "../utils/mailpit-client";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, "my-database.db");

// ── helpers ──────────────────────────────────────────────────────────────────

function uniqueEmail(prefix = "setup") {
  return `${prefix}+${Date.now()}@example.com`;
}

interface TestUser {
  userId: string;
  sessionToken: string;
  cleanup: () => void;
}

/** Create a user with controlled consent + session, return cleanup fn. */
function createTestUser(opts: {
  consent: Record<string, string>;
  foodPreference?: string | null;
  photoConsentGiven?: boolean | null;
}): TestUser {
  const db = new Database(DB_PATH);
  const userId = crypto.randomUUID();
  const loginId = crypto.randomUUID();
  const email = `test-${userId}@example.com`;

  db.prepare(
    "INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)",
  ).run(loginId, email, new Date(Date.now() + 3600000).toISOString());

  db.prepare(
    `INSERT INTO users (id, name, family_name, login_id, consent, food_preference, photo_consent_given)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    "Test",
    "User",
    loginId,
    JSON.stringify(opts.consent),
    opts.foodPreference ?? null,
    opts.photoConsentGiven == null ? null : opts.photoConsentGiven ? 1 : 0,
  );

  const sessionToken = crypto.randomBytes(48).toString("hex");
  const sessionId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
  ).run(sessionId, userId, sessionToken, new Date(Date.now() + 3600000).toISOString());

  db.close();

  return {
    userId,
    sessionToken,
    cleanup() {
      const db2 = new Database(DB_PATH);
      db2.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
      db2.prepare("DELETE FROM users WHERE id = ?").run(userId);
      db2.prepare("DELETE FROM logins WHERE id = ?").run(loginId);
      db2.close();
    },
  };
}

interface TestEvent {
  eventId: string;
  cleanup: () => void;
}

/** Create a minimal event with one product via raw SQL. */
function createTestEvent(userId: string): TestEvent {
  const db = new Database(DB_PATH);
  const eventId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const start = new Date(Date.now() + 14 * 86400000).toISOString();
  const end = new Date(Date.now() + 14 * 86400000 + 7200000).toISOString();

  db.prepare(
    `INSERT INTO events (id, title, body, start_date, end_date, location_type, user_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(eventId, "Consent Test Event", "<p>test</p>", start, end, "online", userId, "global");

  db.prepare(
    `INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(groupId, eventId, "General", 100, 1);

  db.prepare(
    `INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(productId, eventId, groupId, "Standard", 10.0, 1, 1, "[]");

  db.close();

  return {
    eventId,
    cleanup() {
      const db2 = new Database(DB_PATH);
      db2.prepare("DELETE FROM products WHERE id = ?").run(productId);
      db2.prepare("DELETE FROM inventory_groups WHERE id = ?").run(groupId);
      db2.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      db2.close();
    },
  };
}

async function signInViaMagicLink(page: any, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.click('button[type="submit"]');
  const html = await waitForEmailHtml(email);
  const links = extractAllLinks(html).filter((l) => l.includes("/auth/verify"));
  if (!links.length) throw new Error("No magic link found");
  await page.goto(links[0]);
  await page.waitForLoadState("networkidle");
}

// ── /profile/setup redirect tests (require mailpit + running server) ──────────

test.describe("profile/setup — redirect behaviour", () => {
  test("new user (empty consent) is redirected to /profile/setup after login", async ({ page }) => {
    const email = uniqueEmail("new");
    await signInViaMagicLink(page, email);

    await expect(page).toHaveURL(/\/profile\/setup/, { timeout: 10000 });

    // cleanup
    const db = new Database(DB_PATH);
    const login = db.prepare("SELECT id FROM logins WHERE email = ?").get(email) as any;
    if (login) {
      const user = db.prepare("SELECT id FROM users WHERE login_id = ?").get(login.id) as any;
      if (user) db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
      db.prepare("DELETE FROM logins WHERE id = ?").run(login.id);
    }
    db.close();
  });

  test("user with complete consent goes to / after login", async ({ page }) => {
    const email = uniqueEmail("complete");
    await signInViaMagicLink(page, email);

    // Set full consent
    const db = new Database(DB_PATH);
    const login = db.prepare("SELECT id FROM logins WHERE email = ?").get(email) as any;
    const user = db.prepare("SELECT id FROM users WHERE login_id = ?").get(login.id) as any;
    const now = new Date().toISOString();
    db.prepare("UPDATE users SET consent = ? WHERE id = ?").run(
      JSON.stringify({ lastProfileUpdate: now, locationVerification: now }),
      user.id,
    );
    db.close();

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    const since = new Date();
    await page.click('button[type="submit"]');
    const html = await waitForEmailHtml(email, 30000, since);
    const links = extractAllLinks(html).filter((l) => l.includes("/auth/verify"));
    await page.goto(links[0]);
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/\/profile\/setup/);
    await expect(page).toHaveURL("/");

    // cleanup
    const db2 = new Database(DB_PATH);
    const l2 = db2.prepare("SELECT id FROM logins WHERE email = ?").get(email) as any;
    if (l2) {
      const u2 = db2.prepare("SELECT id FROM users WHERE login_id = ?").get(l2.id) as any;
      if (u2) db2.prepare("DELETE FROM users WHERE id = ?").run(u2.id);
      db2.prepare("DELETE FROM logins WHERE id = ?").run(l2.id);
    }
    db2.close();
  });
});

// ── /profile/setup page content ───────────────────────────────────────────────

test.describe("profile/setup — page content", () => {
  test("shows both steps when neither consent is set", async ({ browser }) => {
    const { sessionToken, cleanup } = createTestUser({ consent: {} });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto("/profile/setup");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("input[name='name']")).toBeVisible();
    await expect(page.locator("text=Location verification")).toBeVisible();

    await ctx.close();
    cleanup();
  });

  test("shows only location step when profile consent already set", async ({ browser }) => {
    const now = new Date().toISOString();
    const { sessionToken, cleanup } = createTestUser({ consent: { lastProfileUpdate: now } });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto("/profile/setup");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("input[name='name']")).not.toBeVisible();
    await expect(page.locator("text=Location verification")).toBeVisible();

    await ctx.close();
    cleanup();
  });

  test("shows only profile step when location consent already set", async ({ browser }) => {
    const now = new Date().toISOString();
    const { sessionToken, cleanup } = createTestUser({ consent: { locationVerification: now } });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto("/profile/setup");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("input[name='name']")).toBeVisible();
    await expect(page.locator("text=Location verification")).not.toBeVisible();

    await ctx.close();
    cleanup();
  });
});

// ── /profile/setup saving ─────────────────────────────────────────────────────

test.describe("profile/setup — saving", () => {
  test("filling profile and clicking Continue persists lastProfileUpdate consent", async ({ browser }) => {
    const { sessionToken, userId, cleanup } = createTestUser({ consent: {} });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto("/profile/setup");
    await page.waitForLoadState("networkidle");

    await page.locator("input[name='name']").fill("Alice");
    await page.locator("input[name='family_name']").fill("Smith");
    await page.locator("button:has-text('Continue')").click();
    await page.waitForLoadState("networkidle");

    const db = new Database(DB_PATH);
    const row = db.prepare("SELECT consent FROM users WHERE id = ?").get(userId) as any;
    db.close();
    const consent = JSON.parse(row.consent);
    expect(consent.lastProfileUpdate).toBeTruthy();

    await ctx.close();
    cleanup();
  });
});

// ── checkout consent steps ────────────────────────────────────────────────────

test.describe("checkout — consent steps", () => {
  test("shows food and photo consent when neither set, blocks payment", async ({ browser }) => {
    const now = new Date().toISOString();
    const { sessionToken, userId, cleanup: cleanupUser } = createTestUser({
      consent: { lastProfileUpdate: now, locationVerification: now },
      foodPreference: null,
      photoConsentGiven: null,
    });
    const { eventId, cleanup: cleanupEvent } = createTestEvent(userId);

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto(`/events/${eventId}/checkout`);
    await page.waitForLoadState("networkidle");

    // Select first product and proceed to payment step
    const radio = page.locator('input[type="radio"]').first();
    await expect(radio).toBeVisible({ timeout: 8000 });
    await radio.check();
    await page.locator("button:has-text('Proceed to Payment'), button:has-text('Continue')").first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Dietary preference")).toBeVisible();
    await expect(page.locator("text=Photo consent")).toBeVisible();
    await expect(page.locator("button:has-text('Complete Payment')")).toBeDisabled();

    await ctx.close();
    cleanupUser();
    cleanupEvent();
  });

  test("hides food section when already set, shows only photo consent", async ({ browser }) => {
    const now = new Date().toISOString();
    const { sessionToken, userId, cleanup: cleanupUser } = createTestUser({
      consent: { lastProfileUpdate: now, locationVerification: now },
      foodPreference: "vegetarian",
      photoConsentGiven: null,
    });
    const { eventId, cleanup: cleanupEvent } = createTestEvent(userId);

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto(`/events/${eventId}/checkout`);
    await page.waitForLoadState("networkidle");

    const radio = page.locator('input[type="radio"]').first();
    await expect(radio).toBeVisible({ timeout: 8000 });
    await radio.check();
    await page.locator("button:has-text('Proceed to Payment'), button:has-text('Continue')").first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Dietary preference")).not.toBeVisible();
    await expect(page.locator("text=Photo consent")).toBeVisible();
    await expect(page.locator("button:has-text('Complete Payment')")).toBeDisabled();

    await ctx.close();
    cleanupUser();
    cleanupEvent();
  });

  test("Complete Payment enabled when both food and photo consent already set", async ({ browser }) => {
    const now = new Date().toISOString();
    const { sessionToken, userId, cleanup: cleanupUser } = createTestUser({
      consent: { lastProfileUpdate: now, locationVerification: now, foodPreference: now, photoConsent: now },
      foodPreference: "vegan",
      photoConsentGiven: true,
    });
    const { eventId, cleanup: cleanupEvent } = createTestEvent(userId);

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();

    await page.goto(`/events/${eventId}/checkout`);
    await page.waitForLoadState("networkidle");

    const radio = page.locator('input[type="radio"]').first();
    await expect(radio).toBeVisible({ timeout: 8000 });
    await radio.check();
    await page.locator("button:has-text('Proceed to Payment'), button:has-text('Continue')").first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Dietary preference")).not.toBeVisible();
    await expect(page.locator("text=Photo consent")).not.toBeVisible();
    await expect(page.locator("button:has-text('Complete Payment')")).toBeEnabled();

    await ctx.close();
    cleanupUser();
    cleanupEvent();
  });
});

