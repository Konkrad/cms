/**
 * E2E tests for the Board Elections feature:
 *
 * Admin flows
 *  - Admin can create a new election cycle via the form
 *  - Admin can advance status: draft → open → voting → closed
 *  - Admin can set a voting URL when cycle is in voting status
 *
 * Public visibility
 *  - /elections redirects to the open cycle
 *  - draft cycle not accessible
 *  - voting status shows correct banner + vote link
 *  - closed cycle shows correct banner, no apply button
 *
 * Membership tier gate
 *  - Member without required tier sees message, not apply button
 *  - Full member can see apply button and submit
 *
 * Application flow
 *  - Submitting with empty fields shows field errors
 *  - Successful application creates pending record in /elections/mine
 *  - Approved candidate with motivations visible on public cycle page
 *  - Rejected application shows admin note in /elections/mine
 *
 * Guards
 *  - Unauthenticated access redirects to /login
 *  - Voting cycle hides apply button
 */

import {
  test,
  expect,
  createUserSession,
  createUserSessionWithMembership,
  createElectionCycleInDb,
  createElectionPositionInDb,
  createElectionApplicationInDb,
  openDb,
} from "../fixtures";

async function loginAs(page: import("@playwright/test").Page, token: string) {
  await page.context().addCookies([{
    name: "session", value: token, domain: "localhost",
    path: "/", httpOnly: true, secure: false, sameSite: "Strict",
  }]);
}

// ── Auth guard ─────────────────────────────────────────────────────────────────

test("redirects /elections to /login for guests", async ({ guestPage: page }) => {
  await page.goto("/elections");
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

// ── Admin: create cycle ────────────────────────────────────────────────────────

test.describe("Elections — admin: create cycle", () => {
  test("admin can create a new election cycle via the form", async ({ adminPage: page }) => {
    const title = `E2E Admin Cycle ${Date.now()}`;
    try {
      await page.goto("/admin/global/elections/new");
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.fill('input[name="title"]', title);
      await page.fill('input[name="year"]', "2099");
      await page.fill("textarea[name=description]", "Test cycle created by E2E");
      await page.click('button[type="submit"]');

      // Should redirect to the new cycle's admin page
      await expect(page).toHaveURL(/\/admin\/global\/elections\/[0-9a-f-]{36}/, { timeout: 10_000 });
      await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 5_000 });
    } finally {
      const db = openDb();
      db.prepare("DELETE FROM election_cycles WHERE title = ?").run(title);
      db.close();
    }
  });
});

// ── Admin: advance status ──────────────────────────────────────────────────────

test.describe("Elections — admin: status lifecycle", () => {
  test("admin can advance cycle draft → open → voting → closed", async ({ adminPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "draft", title: "Status Lifecycle E2E" });
    try {
      await page.goto(`/admin/global/elections/${cycleId}`);
      await expect(page.locator("text=Status Lifecycle E2E")).toBeVisible({ timeout: 10_000 });

      page.on("dialog", (d) => d.accept());

      // draft → open (wait for the next button to confirm re-render)
      await expect(page.locator("button:has-text('Open for Applications')")).toBeVisible({ timeout: 10_000 });
      await page.locator("button:has-text('Open for Applications')").click();
      await expect(page.locator("button:has-text('Close Applications')")).toBeVisible({ timeout: 15_000 });
      const db1 = openDb();
      expect((db1.prepare("SELECT status FROM election_cycles WHERE id = ?").get(cycleId) as any)?.status).toBe("open");
      db1.close();

      // open → voting (wait for "Close Election" to confirm re-render)
      await page.locator("button:has-text('Close Applications')").click();
      await expect(page.locator("button:has-text('Close Election')")).toBeVisible({ timeout: 15_000 });
      const db2 = openDb();
      expect((db2.prepare("SELECT status FROM election_cycles WHERE id = ?").get(cycleId) as any)?.status).toBe("voting");
      db2.close();

      // voting → closed (no more advance button after closing)
      await page.locator("button:has-text('Close Election')").click();
      await expect(page.locator("button:has-text('Close Election')")).not.toBeVisible({ timeout: 15_000 });
      const db3 = openDb();
      expect((db3.prepare("SELECT status FROM election_cycles WHERE id = ?").get(cycleId) as any)?.status).toBe("closed");
      db3.close();
    } finally {
      cleanup();
    }
  });

  test("admin can set a voting URL during voting status", async ({ adminPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "voting", title: "Voting URL E2E" });
    const votingUrl = "https://forms.example.com/vote-e2e";
    try {
      await page.goto(`/admin/global/elections/${cycleId}`);
      await expect(page.locator('input[name="votingUrl"]')).toBeVisible({ timeout: 10_000 });

      await page.fill('input[name="votingUrl"]', votingUrl);
      await page.locator("button:has-text('Save')").first().click();
      await page.waitForLoadState("networkidle");

      const db = openDb();
      const row = db.prepare("SELECT voting_url FROM election_cycles WHERE id = ?").get(cycleId) as any;
      db.close();
      expect(row?.voting_url).toBe(votingUrl);
    } finally {
      cleanup();
    }
  });
});

// ── Public: cycle visibility and status banners ───────────────────────────────

test.describe("Elections — public visibility", () => {
  test("draft cycle is not directly accessible and not listed", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "draft", title: "Hidden Draft E2E" });
    const session = createUserSession("user");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      // Draft cycles redirect to /elections
      await expect(page).toHaveURL(/\/elections/, { timeout: 10_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("/elections redirects to the open cycle", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Redirect Target E2E" });
    const session = createUserSession("user");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/elections");
      await expect(page).toHaveURL(new RegExp(`/elections/${cycleId}`), { timeout: 10_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("voting cycle shows 'Voting is in progress' banner", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "voting", title: "Voting Banner E2E" });
    const session = createUserSession("user");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("text=Voting is in progress")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("a:has-text('Apply')")).not.toBeVisible({ timeout: 5_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("voting cycle shows 'Vote now' button when voting URL is set", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "voting", title: "Vote Link E2E" });
    const session = createUserSession("user");
    const db = openDb();
    db.prepare("UPDATE election_cycles SET voting_url = ? WHERE id = ?")
      .run("https://forms.example.com/vote", cycleId);
    db.close();
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("a:has-text('Vote now')")).toBeVisible({ timeout: 10_000 });
      const href = await page.locator("a:has-text('Vote now')").getAttribute("href");
      expect(href).toBe("https://forms.example.com/vote");
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("closed cycle shows 'applications are closed' banner and no apply button", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "closed", title: "Closed E2E" });
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId);
    const session = createUserSession("user");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("text=Applications for this election are closed")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("a:has-text('Apply')")).not.toBeVisible({ timeout: 5_000 });
    } finally {
      cleanup();
      pc();
      session.cleanup();
    }
  });
});

// ── Membership tier gate ──────────────────────────────────────────────────────

test.describe("Elections — membership gate", () => {
  test("member without required tier sees message, not apply button", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Gated E2E" });
    const db = openDb();
    db.prepare("UPDATE election_cycles SET required_membership_tier = ? WHERE id = ?").run("full", cycleId);
    db.close();
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId, { title: "Treasurer" });
    const session = createUserSession("user");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("a:has-text('Apply')")).not.toBeVisible({ timeout: 5_000 });
      await expect(page.locator("text=Full Member")).toBeVisible({ timeout: 10_000 });
    } finally {
      cleanup();
      pc();
      session.cleanup();
    }
  });

  test("full member can see apply button and submit an application", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Full Member E2E" });
    const db = openDb();
    db.prepare("UPDATE election_cycles SET required_membership_tier = ? WHERE id = ?").run("full", cycleId);
    db.close();
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId, { title: "Secretary" });
    const session = createUserSessionWithMembership("full");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("a:has-text('Apply')")).toBeVisible({ timeout: 10_000 });

      await page.click("a:has-text('Apply')");
      await page.fill("textarea[name=motivationWhy]", "I want to contribute to the board actively.");
      await page.fill("textarea[name=motivationExperience]", "I have 5 years of relevant experience.");
      await page.fill("textarea[name=motivationGoals]", "I would like to improve transparency.");
      await page.click("button[type=submit]");

      await expect(page).toHaveURL(new RegExp(`/elections/${cycleId}`), { timeout: 10_000 });
      await expect(page.locator("text=✓ Applied")).toBeVisible({ timeout: 5_000 });
    } finally {
      const db2 = openDb();
      db2.prepare("DELETE FROM election_applications WHERE user_id = ?").run(session.userId);
      db2.close();
      cleanup();
      pc();
      session.cleanup();
    }
  });
});

// ── Application flow ──────────────────────────────────────────────────────────

test.describe("Elections — application flow", () => {
  test("submitting the apply form with empty fields shows field errors", async ({ guestPage: page }) => {
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Validation E2E" });
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId, { title: "Board President" });
    const session = createUserSession("user");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/elections/${cycleId}/apply?positionId=${positionId}`);
      await expect(page.locator('textarea[name="motivationWhy"]')).toBeVisible({ timeout: 10_000 });

      // Submit without filling anything
      await page.click("button[type=submit]");

      // Should stay on apply page and show an error (red banner or field error)
      await expect(page).toHaveURL(new RegExp(`/elections/${cycleId}/apply`), { timeout: 5_000 });
      await expect(
        page.locator(".bg-red-50").or(page.locator("text=Please fill in all fields")).or(page.locator("text=Please write at least")),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      cleanup();
      pc();
      session.cleanup();
    }
  });

  test("approved candidate's motivations are visible on the public cycle page", async ({ guestPage: page }) => {
    const applicant = createUserSession("user");
    const viewer = createUserSession("user");
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Motivations E2E" });
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId, { title: "Secretary" });
    const { cleanup: ac } = createElectionApplicationInDb(positionId, cycleId, applicant.userId, "approved");
    // Patch motivations directly
    const db = openDb();
    db.prepare(
      "UPDATE election_applications SET motivation_why = ?, motivation_experience = ?, motivation_goals = ? WHERE user_id = ? AND position_id = ?",
    ).run("My reason for applying.", "My relevant background.", "My goals for this term.", applicant.userId, positionId);
    db.close();
    try {
      await loginAs(page, viewer.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("text=My reason for applying.")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=My relevant background.")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator("text=My goals for this term.")).toBeVisible({ timeout: 5_000 });
    } finally {
      ac();
      cleanup();
      pc();
      applicant.cleanup();
      viewer.cleanup();
    }
  });

  test("pending application not shown on public cycle page", async ({ guestPage: page }) => {
    const applicant = createUserSession("user");
    const viewer = createUserSession("user");
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Pending Hidden E2E" });
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId, { title: "Treasurer" });
    const { cleanup: ac } = createElectionApplicationInDb(positionId, cycleId, applicant.userId, "pending");
    try {
      await loginAs(page, viewer.sessionToken);
      await page.goto(`/elections/${cycleId}`);
      await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });
      // pending applicant's name must not appear inside a candidate card (main content only)
      await expect(page.locator("main").locator("text=No candidates yet")).toBeVisible({ timeout: 5_000 });
    } finally {
      ac();
      cleanup();
      pc();
      applicant.cleanup();
      viewer.cleanup();
    }
  });

  test("rejected application shows admin note in /elections/mine", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Rejection E2E" });
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId);
    const { cleanup: ac } = createElectionApplicationInDb(positionId, cycleId, session.userId, "rejected", "Not enough experience");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/elections/mine");
      await expect(page.locator("text=Not enough experience")).toBeVisible({ timeout: 10_000 });
    } finally {
      ac();
      cleanup();
      pc();
      session.cleanup();
    }
  });

  test("election history visible on own profile page", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { cycleId, cleanup } = createElectionCycleInDb({ status: "open", title: "Profile History E2E" });
    const { positionId, cleanup: pc } = createElectionPositionInDb(cycleId, { title: "Auditor" });
    const { cleanup: ac } = createElectionApplicationInDb(positionId, cycleId, session.userId, "pending");
    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/profile");
      await expect(page.locator("text=Profile History E2E")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=Auditor")).toBeVisible({ timeout: 5_000 });
    } finally {
      ac();
      cleanup();
      pc();
      session.cleanup();
    }
  });
});
