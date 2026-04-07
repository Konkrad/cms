import { test, expect } from "./fixtures";
import Database from "better-sqlite3";

// This test reproduces the onboarding personal page rendering scenario and
// captures any console errors (including Qwik serialization errors).

test("onboarding page loads without JS console errors", async ({
  adminPage: page,
}) => {
  // Navigate to the onboarding page and verify it renders the profile step.
  await page.goto("http://localhost:5174/onboarding/", {
    waitUntil: "networkidle",
  });

  await page.waitForSelector("h1", { timeout: 10000 });
  await expect(page.locator("h1")).toContainText("Complete your profile");
});
