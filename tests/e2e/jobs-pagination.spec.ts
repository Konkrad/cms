/**
 * E2E tests for /jobs cursor pagination history behavior:
 *  - Clicking Next updates the URL with ?cursor=<opaque token>
 *  - Browser back returns to the previous page (URL + Previous/Next state)
 *  - Browser forward replays the page change
 *  - Opening a ?cursor= URL directly (no prior page-1 visit) lands on that page
 */

import { test, expect, createJobInDb, createUserSession } from "../fixtures";

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

test.describe("Jobs — pagination history", () => {
  test("back/forward navigate between pages", async ({ guestPage: page }) => {
    const session = createUserSession("user");
    // PAGE_SIZE is 10 (src/routes/jobs/index.tsx); seed 11 approved jobs so a
    // second page exists regardless of any other approved jobs in the DB.
    const seeded = Array.from({ length: 11 }, (_, i) =>
      createJobInDb({
        suggestedBy: session.userId,
        title: `Pager Test Job ${i}`,
        status: "approved",
      }),
    );

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs");
      await expect(page).toHaveURL("/jobs", { timeout: 10_000 });

      const nextButton = page.locator('button:has-text("Next")');
      const prevButton = page.locator('button:has-text("Previous")');
      await expect(nextButton).toBeVisible({ timeout: 10_000 });
      await expect(nextButton).toBeEnabled();
      await expect(prevButton).toBeDisabled();

      // Click Next → URL should carry the opaque cursor token, Previous becomes
      // enabled. (Whether Next itself is still enabled depends on how many
      // approved jobs exist beyond what this test seeded, so it isn't asserted.)
      await nextButton.click();
      await expect(page).toHaveURL(/\?cursor=[^&]+$/, { timeout: 10_000 });
      const page2Url = page.url();
      await expect(prevButton).toBeEnabled();

      // Browser back → URL reverts to /jobs, Previous disabled again.
      await page.goBack();
      await expect(page).toHaveURL(/\/jobs$/, { timeout: 10_000 });
      await expect(prevButton).toBeDisabled();

      // Browser forward → URL goes back to the same cursor, Previous enabled again.
      await page.goForward();
      await expect(page).toHaveURL(page2Url, { timeout: 10_000 });
      await expect(prevButton).toBeEnabled();
    } finally {
      seeded.forEach((j) => j.cleanup());
      session.cleanup();
    }
  });

  test("back from a job detail page (full route nav) restores page 2, not page 1", async ({
    guestPage: page,
  }) => {
    const session = createUserSession("user");
    const seeded = Array.from({ length: 11 }, (_, i) =>
      createJobInDb({
        suggestedBy: session.userId,
        title: `Pager Detail Job ${i}`,
        status: "approved",
      }),
    );

    try {
      await loginAs(page, session.sessionToken);
      await page.goto("/jobs");

      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toBeVisible({ timeout: 10_000 });
      await nextButton.click();
      await expect(page).toHaveURL(/\?cursor=[^&]+$/, { timeout: 10_000 });
      const page2Url = page.url();

      // Navigate into a job detail page — a full route change, which remounts
      // /jobs from scratch (fresh routeLoader$, fresh component instance) on the
      // way back. This is the case the in-memory cursor chain alone can't survive.
      const firstTitleOnPage2 = await page
        .locator('a[href^="/jobs/"]')
        .first()
        .textContent();
      await page.locator('a[href^="/jobs/"]').first().click();
      await expect(page).toHaveURL(/\/jobs\/[^/]+$/, { timeout: 10_000 });

      await page.goBack();
      await expect(page).toHaveURL(page2Url, { timeout: 10_000 });
      await expect(page.locator('button:has-text("Previous")')).toBeEnabled({
        timeout: 10_000,
      });
      // The job visible should still be one from page 2, not page 1.
      await expect(
        page.locator(`a[href^="/jobs/"]:has-text("${firstTitleOnPage2}")`),
      ).toBeVisible();
    } finally {
      seeded.forEach((j) => j.cleanup());
      session.cleanup();
    }
  });

  test("opening a shared ?cursor= link directly lands on that page in one query", async ({
    guestPage: page,
  }) => {
    const session = createUserSession("user");
    const seeded = Array.from({ length: 11 }, (_, i) =>
      createJobInDb({
        suggestedBy: session.userId,
        title: `Pager Deeplink Job ${i}`,
        status: "approved",
      }),
    );

    try {
      await loginAs(page, session.sessionToken);

      // Visit /jobs once to discover page 2's cursor URL, the way a user would
      // before sharing the link.
      await page.goto("/jobs");
      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toBeVisible({ timeout: 10_000 });
      await nextButton.click();
      await expect(page).toHaveURL(/\?cursor=[^&]+$/, { timeout: 10_000 });
      const sharedUrl = page.url();
      const firstTitleOnPage2 = await page
        .locator('a[href^="/jobs/"]')
        .first()
        .textContent();

      // Simulate a different visitor opening the shared link fresh — no prior
      // navigation, no in-memory cursor chain.
      const session2 = createUserSession("user");
      try {
        await loginAs(page, session2.sessionToken);
        await page.goto(sharedUrl);
        await expect(page).toHaveURL(sharedUrl, { timeout: 10_000 });
        await expect(
          page.locator(`a[href^="/jobs/"]:has-text("${firstTitleOnPage2}")`),
        ).toBeVisible({ timeout: 10_000 });
        // Previous is available, but only returns to page 1 — the fresh visitor
        // never learned the cursor for anything before this page.
        await expect(page.locator('button:has-text("Previous")')).toBeEnabled();
      } finally {
        session2.cleanup();
      }
    } finally {
      seeded.forEach((j) => j.cleanup());
      session.cleanup();
    }
  });
});
