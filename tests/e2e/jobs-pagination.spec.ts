/**
 * E2E tests for /jobs cursor pagination history behavior:
 *  - Clicking a page button updates the URL with ?page=N
 *  - Browser back returns to the previous page (URL + active pager button)
 *  - Browser forward replays the page change
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

      const page2Button = page.locator('button:text-is("2")');
      await expect(page2Button).toBeVisible({ timeout: 10_000 });

      // Click page 2 → URL should reflect it, button 2 becomes the active/disabled one.
      await page2Button.click();
      await expect(page).toHaveURL(/\?page=2$/, { timeout: 10_000 });
      await expect(page.locator('button:text-is("2")')).toBeDisabled();

      // Browser back → URL reverts to /jobs and page 1 is active again.
      await page.goBack();
      await expect(page).toHaveURL(/\/jobs$/, { timeout: 10_000 });
      await expect(page.locator('button:text-is("1")')).toBeDisabled();

      // Browser forward → URL goes back to ?page=2 and page 2 is active again.
      await page.goForward();
      await expect(page).toHaveURL(/\?page=2$/, { timeout: 10_000 });
      await expect(page.locator('button:text-is("2")')).toBeDisabled();
    } finally {
      seeded.forEach((j) => j.cleanup());
      session.cleanup();
    }
  });
});
