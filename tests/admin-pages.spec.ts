/**
 * Tests for the admin page-management flow:
 *
 *  1. Pages list is visible
 *  2. Create a new page → redirected to builder
 *  3. Created page appears in the list as draft
 *  4. Edit the page (title, slug, status → published)
 *  5. Edited page appears as published with a View link
 *  6. Delete the page → no longer in the list
 *  7. Duplicate slug is rejected with an error message
 *  8. Reserved slug is rejected with an error message
 */

import { test, expect, deletePageBySlug, getPageBySlug } from "./fixtures";

const BASE_SLUG = "pw-test-page";
const BASE_TITLE = "Playwright Test Page";
const EDITED_TITLE = "Playwright Test Page (Edited)";
const EDITED_SLUG = "pw-test-page-edited";
const LIST_URL = "/admin/global/pages";
const NEW_URL = "/admin/global/pages/new";

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Wait for Qwik to finish hydrating.
 * Qwik sets `q:container="resumed"` on the root container element once it has
 * taken over the page from SSR.
 */
async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      document.querySelector("[q\\:container]")?.getAttribute("q:container") ===
      "resumed",
    { timeout: 10000 },
  );
}

/** Fill and submit the create/edit page form. */
async function fillPageForm(
  page: import("@playwright/test").Page,
  title: string,
  slug: string,
  status: "draft" | "published" = "draft",
) {
  await waitForHydration(page);
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="slug"]').fill(slug);
  await page.selectOption('select[name="status"]', status);
  await page.locator('button[type="submit"]').click();
}

// ── setup / teardown ──────────────────────────────────────────────────────────

test.beforeAll(() => {
  deletePageBySlug(BASE_SLUG);
  deletePageBySlug(EDITED_SLUG);
});

test.afterAll(() => {
  deletePageBySlug(BASE_SLUG);
  deletePageBySlug(EDITED_SLUG);
});

// ── 1. Pages list ─────────────────────────────────────────────────────────────

test("pages list loads for admin", async ({ adminPage: page }) => {
  await page.goto(LIST_URL, { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Manage Pages" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create New Page" }),
  ).toBeVisible();
});

// ── 2. Create page → builder redirect ────────────────────────────────────────

test("creates a new page and redirects to builder", async ({
  adminPage: page,
}) => {
  await page.goto(NEW_URL, { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Create New Page" }),
  ).toBeVisible();

  await fillPageForm(page, BASE_TITLE, BASE_SLUG);

  await page.waitForURL(/\/admin\/global\/pages\/.+\/builder/, {
    timeout: 10000,
  });
  expect(page.url()).toMatch(/\/admin\/global\/pages\/.+\/builder/);
});

// ── 3. Page appears in list as draft ─────────────────────────────────────────

test("new page appears in the pages list as draft", async ({
  adminPage: page,
}) => {
  await page.goto(LIST_URL, { waitUntil: "networkidle" });

  await expect(page.getByText(BASE_TITLE)).toBeVisible();
  const row = page.locator("tr", { has: page.getByText(BASE_TITLE) });
  await expect(row.getByText("draft")).toBeVisible();
});

// ── 4. Edit page ──────────────────────────────────────────────────────────────

test("edits the page title, slug and publishes it", async ({
  adminPage: page,
}) => {
  const row = getPageBySlug(BASE_SLUG);
  if (!row) throw new Error(`Page '${BASE_SLUG}' not found – did test 2 pass?`);

  await page.goto(`/admin/global/pages/${row.id}/edit`, {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { name: "Edit Page Info" }),
  ).toBeVisible();

  await fillPageForm(page, EDITED_TITLE, EDITED_SLUG, "published");

  // Redirect goes to /admin/global/pages (may have trailing slash)
  await page.waitForURL(/\/admin\/global\/pages\/?$/, { timeout: 10000 });
  expect(page.url()).toContain("/admin/global/pages");
});

// ── 5. Edited page is published with View link ────────────────────────────────

test("edited page appears as published with View link", async ({
  adminPage: page,
}) => {
  await page.goto(LIST_URL, { waitUntil: "networkidle" });

  await expect(page.getByText(EDITED_TITLE)).toBeVisible();
  const row = page.locator("tr", { has: page.getByText(EDITED_TITLE) });
  await expect(row.getByText("published")).toBeVisible();
  await expect(row.getByRole("link", { name: "View" })).toBeVisible();
});

// ── 6. Delete page ────────────────────────────────────────────────────────────

test("deletes the page and it disappears from the list", async ({
  adminPage: page,
}) => {
  await page.goto(LIST_URL, { waitUntil: "networkidle" });

  const row = page.locator("tr", { has: page.getByText(EDITED_TITLE) });
  await expect(row).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();

  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EDITED_TITLE)).not.toBeVisible();
});

// ── 7. Duplicate slug rejected ────────────────────────────────────────────────

test("rejects a duplicate slug", async ({ adminPage: page }) => {
  const DUPE_SLUG = "pw-dupe-slug-test";
  deletePageBySlug(DUPE_SLUG);

  try {
    // Create the page first
    await page.goto(NEW_URL, { waitUntil: "networkidle" });
    await fillPageForm(page, "Dupe Base Page", DUPE_SLUG);
    await page.waitForURL(/\/builder/, { timeout: 10000 });

    // Try to create another with the same slug
    await page.goto(NEW_URL, { waitUntil: "networkidle" });
    await fillPageForm(page, "Dupe Attempt", DUPE_SLUG);

    // Should stay on the form and show an error
    await expect(page).toHaveURL(new RegExp(NEW_URL));
    await expect(page.locator(".bg-red-100")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".bg-red-100")).toContainText(
      /slug.*use|already/i,
    );
  } finally {
    deletePageBySlug(DUPE_SLUG);
  }
});

// ── 8. Reserved slug rejected ─────────────────────────────────────────────────

test("rejects a reserved slug", async ({ adminPage: page }) => {
  await page.goto(NEW_URL, { waitUntil: "networkidle" });
  await fillPageForm(page, "Reserved Slug Attempt", "admin");

  await expect(page).toHaveURL(new RegExp(NEW_URL));
  await expect(page.locator(".bg-red-100")).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".bg-red-100")).toContainText(/slug/i);
});
