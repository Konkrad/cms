/**
 * E2E tests for PostsListBlock bidirectional cursor pagination on /news.
 *
 * The seed inserts exactly 13 posts (scripts/seed.ts postDefs), so at 10 per
 * page there are exactly two pages: page 1 (10 posts) and page 2 (3 posts).
 */

import { test, expect } from "../fixtures";

test.describe("News — cursor pagination", () => {
  test("page 1 loads posts and Next is enabled, Previous disabled", async ({
    memberPage: page,
  }) => {
    await page.goto("/news");

    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.locator('button:has-text("Next")')).toBeEnabled({
      timeout: 5_000,
    });
    await expect(page.locator('button:has-text("Previous")')).toBeDisabled();
  });

  test("clicking Next replaces content and updates the URL cursor", async ({
    memberPage: page,
  }) => {
    await page.goto("/news");

    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 10_000,
    });

    const firstTitlePage1 = await page
      .getByRole("heading", { level: 3 })
      .first()
      .textContent();

    await page.locator('button:has-text("Next")').click();
    await expect(page).toHaveURL(/\?cursor=[^&]+$/, { timeout: 10_000 });

    await expect(page.getByRole("heading", { level: 3 }).first()).not.toHaveText(
      firstTitlePage1!,
      { timeout: 10_000 },
    );
    await expect(page.locator('button:has-text("Previous")')).toBeEnabled();
  });

  test("clicking Previous restores page 1 and clears the cursor from the URL", async ({
    memberPage: page,
  }) => {
    await page.goto("/news");

    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 10_000,
    });

    const firstTitlePage1 = await page
      .getByRole("heading", { level: 3 })
      .first()
      .textContent();

    await page.locator('button:has-text("Next")').click();
    await expect(page).toHaveURL(/\?cursor=[^&]+$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 3 }).first()).not.toHaveText(
      firstTitlePage1!,
      { timeout: 10_000 },
    );

    await page.locator('button:has-text("Previous")').click();
    await expect(page).toHaveURL(/\/news$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText(
      firstTitlePage1!,
      { timeout: 10_000 },
    );
    await expect(page.locator('button:has-text("Previous")')).toBeDisabled();
    await expect(page.locator('button:has-text("Next")')).toBeEnabled();
  });
});
