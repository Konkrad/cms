/**
 * E2E tests for the Memberships feature:
 *  - Admin can set a user's membership tier
 *  - Admin can upgrade a tier
 *  - hasTier: full member satisfies associated requirement
 */

import {
  test,
  expect,
  createUserSession,
  createMembershipInDb,
  openDb,
} from "../fixtures";

async function loginAs(page: import("@playwright/test").Page, token: string) {
  await page.context().addCookies([{
    name: "session", value: token, domain: "localhost",
    path: "/", httpOnly: true, secure: false, sameSite: "Strict",
  }]);
}

test("admin can set a user membership tier to associated", async ({ guestPage: page }) => {
  const admin = createUserSession("admin");
  const member = createUserSession("user");
  try {
    await loginAs(page, admin.sessionToken);
    await page.goto("/admin/global/members");

    // Find the member's row and set tier to associated
    const row = page.locator("tr", { has: page.locator(`text=Test User`) }).first();
    await row.locator("select[name=tier]").selectOption("associated");
    await row.locator("button:has-text('Set')").click();
    await page.waitForLoadState("networkidle");

    const db = openDb();
    const m = db.prepare("SELECT tier FROM user_memberships WHERE user_id = ?").get(member.userId) as any;
    db.close();
    expect(m?.tier).toBe("associated");
  } finally {
    const db = openDb();
    db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(member.userId);
    db.close();
    admin.cleanup();
    member.cleanup();
  }
});

test("admin can upgrade a user from associated to full", async ({ guestPage: page }) => {
  const admin = createUserSession("admin");
  const member = createUserSession("user");
  const { membershipId, cleanup: mc } = createMembershipInDb(member.userId, "associated");
  try {
    await loginAs(page, admin.sessionToken);
    await page.goto("/admin/global/members");

    const row = page.locator("tr", { has: page.locator("text=Test User") }).first();
    await row.locator("select[name=tier]").selectOption("full");
    await row.locator("button:has-text('Set')").click();
    await page.waitForLoadState("networkidle");

    const db = openDb();
    const m = db.prepare("SELECT tier FROM user_memberships WHERE user_id = ?").get(member.userId) as any;
    db.close();
    expect(m?.tier).toBe("full");
  } finally {
    const db = openDb();
    db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(member.userId);
    db.close();
    mc();
    admin.cleanup();
    member.cleanup();
  }
});
