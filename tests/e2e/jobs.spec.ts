/**
 * E2E tests for the Job Portal feature:
 *  - Unauthenticated access is redirected to /login
 *  - Member submits a job → appears in /jobs/mine as pending, not in /jobs
 *  - Approved jobs appear on /jobs; pending and expired do not
 *  - Member can edit a pending job but not an approved one
 *  - Member can delete their own job
 *  - Admin can approve and delete jobs
 */

import {
  test,
  expect,
  createJobInDb,
  getJobById,
  deleteJobById,
  createUserSession,
  openDb,
} from "../fixtures";

/** Inject a session cookie into the current page context. */
async function loginAs(page: import("@playwright/test").Page, token: string) {
  await page.context().addCookies([
    {
      name: "session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);
}

// ── Unauthenticated access ─────────────────────────────────────────────────────

test.describe("Jobs — unauthenticated", () => {
  test("redirects /jobs to /login for guests", async ({ guestPage: page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("redirects /jobs/new to /login for guests", async ({ guestPage: page }) => {
    await page.goto("/jobs/new");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("redirects /jobs/mine to /login for guests", async ({ guestPage: page }) => {
    await page.goto("/jobs/mine");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ── Member submission flow ─────────────────────────────────────────────────────

test.describe("Jobs — member submission", () => {
  test("submitted job appears in /jobs/mine as pending", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const ts = Date.now();
    const title = `E2E Job ${ts}`;

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs/new");
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.locator('input[name="title"]').fill(title);
      await page.locator('button:has-text("Submit for Review")').click();

      // Should redirect to /jobs/mine
      await expect(page).toHaveURL(/\/jobs\/mine/, { timeout: 15_000 });
      await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=Pending review").first()).toBeVisible();
    } finally {
      // Clean up job by title
      const sqlite = openDb();
      const row = sqlite
        .prepare("SELECT id FROM jobs WHERE title = ? ORDER BY created_at DESC LIMIT 1")
        .get(title) as { id: string } | undefined;
      sqlite.close();
      if (row) deleteJobById(row.id);
      session.cleanup();
    }
  });

  test("pending job is not visible on /jobs list", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Hidden Pending Job",
      status: "pending",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs");
      await expect(page).toHaveURL("/jobs", { timeout: 10_000 });
      await expect(page.locator("text=Hidden Pending Job")).not.toBeVisible();
    } finally {
      cleanup();
      session.cleanup();
    }
  });
});

// ── My submissions page ────────────────────────────────────────────────────────

test.describe("Jobs — my submissions", () => {
  test("pending job shows Edit link in /jobs/mine", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Editable Pending Job",
      status: "pending",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs/mine");
      await expect(page.locator("text=Editable Pending Job")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(`a[href="/jobs/mine/${jobId}/edit"]`)).toBeVisible();
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("approved job does not show Edit link in /jobs/mine", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Approved No Edit Job",
      status: "approved",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs/mine");
      await expect(page.locator("text=Approved No Edit Job")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(`a[href="/jobs/mine/${jobId}/edit"]`)).not.toBeVisible();
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("member can delete their own pending job", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId } = createJobInDb({
      suggestedBy: session.userId,
      title: "Job To Delete",
      status: "pending",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs/mine");
      const row = page.locator("tr", { hasText: "Job To Delete" });
      await expect(row).toBeVisible({ timeout: 10_000 });

      page.on("dialog", (d) => d.accept());
      await row.locator("button:has-text('Delete')").click();

      await expect(page.locator("text=Job To Delete")).not.toBeVisible({ timeout: 10_000 });
      expect(getJobById(jobId)).toBeUndefined();
    } finally {
      try { deleteJobById(jobId); } catch {}
      session.cleanup();
    }
  });

  test("editing a pending job via /jobs/mine/[id]/edit updates the title", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Original Title",
      status: "pending",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/jobs/mine/${jobId}/edit`);
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.locator('input[name="title"]').fill("Updated Title");
      await page.locator('button:has-text("Save Changes")').click();

      await expect(page).toHaveURL(/\/jobs\/mine/, { timeout: 15_000 });
      await expect(page.locator("text=Updated Title")).toBeVisible({ timeout: 10_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("editing another user's job redirects to /jobs/mine", async ({ guestPage: page }) => {
    const owner = createUserSession("user");
    const attacker = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: owner.userId,
      title: "Other User Job",
      status: "pending",
    });

    try {
      await loginAs(page, attacker.sessionToken);
      await page.goto(`/jobs/mine/${jobId}/edit`);
      await expect(page).toHaveURL(/\/jobs\/mine/, { timeout: 10_000 });
    } finally {
      cleanup();
      owner.cleanup();
      attacker.cleanup();
    }
  });

  test("navigating to edit page for an approved job redirects to /jobs/mine", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Approved Job Guard",
      status: "approved",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto(`/jobs/mine/${jobId}/edit`);
      await expect(page).toHaveURL(/\/jobs\/mine/, { timeout: 10_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });
});

// ── Public job list visibility ─────────────────────────────────────────────────

test.describe("Jobs — public list", () => {
  test("approved non-expired job appears on /jobs", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Visible Approved Job",
      status: "approved",
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs");
      await expect(page.locator("text=Visible Approved Job")).toBeVisible({ timeout: 10_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });

  test("expired approved job is not shown on /jobs", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: session.userId,
      title: "Expired Approved Job",
      status: "approved",
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    });

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs");
      await expect(page.locator("text=Expired Approved Job")).not.toBeVisible({ timeout: 10_000 });
    } finally {
      cleanup();
      session.cleanup();
    }
  });
});

// ── Admin management ───────────────────────────────────────────────────────────

test.describe("Jobs — admin", () => {
  test("admin sees pending job in /admin/global/jobs and can approve it", async ({ adminPage: page }) => {
    const member = createUserSession("user");
    const { jobId, cleanup } = createJobInDb({
      suggestedBy: member.userId,
      title: "Needs Admin Approval",
      status: "pending",
    });

    try {
      await page.goto("/admin/global/jobs");
      const row = page.locator("tr", { hasText: "Needs Admin Approval" });
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row.locator("text=Pending")).toBeVisible();

      await row.locator("button:has-text('Approve')").click();

      await expect(row.locator("text=Approved")).toBeVisible({ timeout: 10_000 });
      expect(getJobById(jobId)?.status).toBe("approved");
    } finally {
      cleanup();
      member.cleanup();
    }
  });

  test("admin can delete a job from the admin list", async ({ adminPage: page }) => {
    const member = createUserSession("user");
    const { jobId } = createJobInDb({
      suggestedBy: member.userId,
      title: "Admin Delete Job",
      status: "pending",
    });

    try {
      await page.goto("/admin/global/jobs");
      const row = page.locator("tr", { hasText: "Admin Delete Job" });
      await expect(row).toBeVisible({ timeout: 10_000 });

      page.on("dialog", (d) => d.accept());
      await row.locator("button:has-text('Delete')").click();

      await expect(page.locator("text=Admin Delete Job")).not.toBeVisible({ timeout: 10_000 });
      expect(getJobById(jobId)).toBeUndefined();
    } finally {
      try { deleteJobById(jobId); } catch {}
      member.cleanup();
    }
  });

  test("Jobs nav item is visible in global admin nav", async ({ adminPage: page }) => {
    await page.goto("/admin/global");
    await expect(page.locator("a[href='/admin/global/jobs']")).toBeVisible({ timeout: 10_000 });
  });
});
