import {
  test,
  expect,
  createTestUser,
  createTestEvent,
  deleteUserByEmail,
  setUserConsentByEmail,
  getUserById,
} from "../fixtures";
import { waitForEmailHtml, extractAllLinks } from "../utils/mailpit-client";

// ── helpers ──────────────────────────────────────────────────────────────────

function uniqueEmail(prefix = "setup") {
  return `${prefix}+${Date.now()}@example.com`;
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
    deleteUserByEmail(email);
  });

  test("user with complete consent goes to / after login", async ({ page }) => {
    const email = uniqueEmail("complete");
    await signInViaMagicLink(page, email);

    // Set full consent
    const now = new Date().toISOString();
    setUserConsentByEmail(email, { lastProfileUpdate: now, locationVerification: now });

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
    deleteUserByEmail(email);
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

    const userRow = getUserById(userId);
    const consent = JSON.parse(String(userRow?.consent ?? "{}"));
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

