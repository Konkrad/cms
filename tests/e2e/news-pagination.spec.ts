/**
 * E2E tests for PostsListBlock cursor-stack pagination on the /news page.
 *
 * The seed inserts exactly 13 posts (scripts/seed.ts postDefs), so at 10 per
 * page there are exactly two pages: page 1 (10 posts) and page 2 (3 posts).
 * There is no page 3.
 */

import { test, expect } from "../fixtures";

test.describe("News — cursor-stack pagination", () => {
  test("page 1 loads posts and page 2 button appears", async ({ memberPage: page }) => {
    await page.goto("/news");

    // Posts should render (wait for the first visible heading)
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 10_000,
    });

    // With 10 per page and >10 posts seeded, the pager must show a "2" button
    await expect(page.getByRole("button", { name: "2" })).toBeVisible({
      timeout: 5_000,
    });

    // Page 1 button is present and visually active (disabled)
    const btn1 = page.getByRole("button", { name: "1" });
    await expect(btn1).toBeVisible();
    await expect(btn1).toBeDisabled();
  });

  test("clicking page 2 replaces content with different posts", async ({ memberPage: page }) => {
    await page.goto("/news");

    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Record the title of the first post on page 1
    const firstTitlePage1 = await page
      .getByRole("heading", { level: 3 })
      .first()
      .textContent();

    // Click page 2
    await page.getByRole("button", { name: "2" }).click();

    // Content must change — first title on page 2 is different
    await expect(page.getByRole("heading", { level: 3 }).first()).not.toHaveText(
      firstTitlePage1!,
      { timeout: 10_000 },
    );

    // Page 2 button is now active (disabled), page 1 is clickable
    await expect(page.getByRole("button", { name: "2" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "1" })).not.toBeDisabled();
  });

  test("navigating back to page 1 restores original posts", async ({ memberPage: page }) => {
    await page.goto("/news");

    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 10_000,
    });

    const firstTitlePage1 = await page
      .getByRole("heading", { level: 3 })
      .first()
      .textContent();

    // Go to page 2
    await page.getByRole("button", { name: "2" }).click();
    await expect(page.getByRole("heading", { level: 3 }).first()).not.toHaveText(
      firstTitlePage1!,
      { timeout: 10_000 },
    );

    // Go back to page 1
    await page.getByRole("button", { name: "1" }).click();
    await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText(
      firstTitlePage1!,
      { timeout: 10_000 },
    );

    // Page 1 button is active again
    await expect(page.getByRole("button", { name: "1" })).toBeDisabled();
  });
});
