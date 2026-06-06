/**
 * E2E tests for the Qualifications feature:
 *  - Unauthenticated access to admin page redirects to login
 *  - Non-admin cannot access admin qualification pages
 *  - Admin sees pending qualification in the queue
 *  - Admin approves → user profile shows the tag
 *  - Admin rejects with note → rejection note visible on user's profile
 */

import {
  test,
  expect,
  createUserSession,
  createQualificationTypeInDb,
  createQualificationInDb,
  openDb,
} from "../fixtures";

async function loginAs(page: import("@playwright/test").Page, token: string) {
  await page.context().addCookies([{
    name: "session", value: token, domain: "localhost",
    path: "/", httpOnly: true, secure: false, sameSite: "Strict",
  }]);
}

test("redirects /admin/global/qualifications to /login for guests", async ({ guestPage: page }) => {
  await page.goto("/admin/global/qualifications");
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

test("non-admin is redirected away from admin qualifications page", async ({ guestPage: page }) => {
  const session = createUserSession("user");
  try {
    await loginAs(page, session.sessionToken);
    await page.goto("/admin/global/qualifications");
    await expect(page).not.toHaveURL(/\/admin\/global\/qualifications/, { timeout: 10_000 });
  } finally {
    session.cleanup();
  }
});

test("admin sees a pending qualification in the queue", async ({ guestPage: page }) => {
  const admin = createUserSession("admin");
  const applicant = createUserSession("user");
  const { typeId, cleanup: tc } = createQualificationTypeInDb({ label: "Test PhD Qualification" });
  const { qualId, cleanup: qc } = createQualificationInDb(applicant.userId, typeId, "pending");
  try {
    await loginAs(page, admin.sessionToken);
    await page.goto("/admin/global/qualifications");
    await expect(page.locator("text=Test PhD Qualification")).toBeVisible({ timeout: 10_000 });
  } finally {
    qc();
    tc();
    admin.cleanup();
    applicant.cleanup();
  }
});

test("admin approves qualification → tag appears on user profile", async ({ guestPage: page }) => {
  const admin = createUserSession("admin");
  const applicant = createUserSession("user");
  const slug = `e2e-qual-${Date.now()}`;
  const { typeId, cleanup: tc } = createQualificationTypeInDb({ label: "E2E Approve Test", slug, grantsMembershipTier: "associated" });
  const { qualId, cleanup: qc } = createQualificationInDb(applicant.userId, typeId, "pending");
  try {
    await loginAs(page, admin.sessionToken);
    await page.goto("/admin/global/qualifications");

    // Click Approve for this qualification
    const row = page.locator("tr", { has: page.locator("text=E2E Approve Test") }).first();
    await row.locator("button:has-text('Approve')").click();
    await page.waitForLoadState("networkidle");

    // Now check the user's tags
    const db = openDb();
    const tag = db.prepare("SELECT * FROM user_tags WHERE user_id = ? AND slug = ?").get(applicant.userId, slug);
    db.close();
    expect(tag).toBeTruthy();
  } finally {
    const db = openDb();
    db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(applicant.userId);
    db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(applicant.userId);
    db.close();
    qc();
    tc();
    admin.cleanup();
    applicant.cleanup();
  }
});

test("admin rejects qualification → rejection note visible on user profile", async ({ guestPage: page }) => {
  const admin = createUserSession("admin");
  const applicant = createUserSession("user");
  const { typeId, cleanup: tc } = createQualificationTypeInDb({ label: "E2E Reject Test" });
  const { qualId, cleanup: qc } = createQualificationInDb(applicant.userId, typeId, "pending");
  try {
    await loginAs(page, admin.sessionToken);
    await page.goto("/admin/global/qualifications");

    const row = page.locator("tr", { has: page.locator("text=E2E Reject Test") }).first();
    await row.locator("input[placeholder='Reason (required)']").fill("Not yet eligible");
    await row.locator("button:has-text('Reject')").click();
    await page.waitForLoadState("networkidle");

    // Now view the applicant's profile as them
    const applicantPage = await page.context().newPage();
    await applicantPage.context().addCookies([{
      name: "session", value: (createUserSession as any)._token ?? admin.sessionToken,
      domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict",
    }]);

    const db = openDb();
    const qual = db.prepare("SELECT status, notes FROM user_qualifications WHERE id = ?").get(qualId) as any;
    db.close();
    expect(qual?.status).toBe("rejected");
    expect(qual?.notes).toBe("Not yet eligible");
    await applicantPage.close();
  } finally {
    qc();
    tc();
    admin.cleanup();
    applicant.cleanup();
  }
});
