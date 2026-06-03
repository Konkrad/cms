import { test, expect } from "../fixtures";

test("onboarding page loads without JS console errors", async ({
  adminPage: page,
}) => {
  await page.goto("/onboarding/", { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 10000 });
  await expect(page.locator("h1")).toContainText("Complete your profile");
});
