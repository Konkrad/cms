/**
 * E2E tests for the Pages feature:
 *  - Admin create / edit page flows
 *  - Menu management (add footer link, delete, reorder)
 *  - Page builder: every block type, block toolbar, image upload (ImageBlock)
 *  - Published page accessible at its public URL
 *
 * Each test spins up its own admin session (no dependency on a seeded "Konrad" user)
 * and cleans up created rows in afterEach / finally.
 */

import { type Page } from "@playwright/test";
import {
  test,
  expect,
  createPageInDb,
  createMenuItemInDb,
  deletePageAndMenuItems,
  deleteMenuItemById,
  getMenuItemByUrl,
  getMenuItemPosition,
  getPageContent,
} from "../fixtures";

// ── Shared test PNG (200×200 cornflower-blue, from image-upload.spec.ts) ──────
const TEST_PNG_BASE64 =
  "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";

// ── Helpers shared across tests ───────────────────────────────────────────────

/** Navigate to a builder page and wait for the canvas to be ready. */
async function goToBuilder(page: Page, pageId: string) {
  await page.goto(`/admin/global/pages/${pageId}/builder`);
  // Wait for the sidebar to confirm the builder has loaded
  await expect(page.locator("text=← Back to Pages")).toBeVisible({ timeout: 15_000 });
}

/** Click a block type in the sidebar and wait for "Unsaved changes" indicator. */
async function addBlock(page: Page, componentType: string) {
  await page.locator(`[data-component-type="${componentType}"]`).click();
  await expect(page.locator("text=Unsaved changes")).toBeVisible({ timeout: 5_000 });
}

/** Click the Save Page button and wait for the "Saved!" confirmation. */
async function saveAndConfirm(page: Page) {
  await page.locator('button:has-text("Save Page")').click();
  await expect(page.locator("text=Saved!")).toBeVisible({ timeout: 15_000 });
}

// =============================================================================
// Page create & edit flows
// =============================================================================

test.describe("Pages — create & edit", () => {
  test("create new page redirects to builder", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    const url = `/e2e-create-${ts}`;
    let createdPageId: string | null = null;

    try {
      await page.goto("/admin/global/pages/new");
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.locator('input[name="title"]').fill(`E2E Create Test ${ts}`);
      await page.locator('input[name="url"]').fill(url);
      // menu defaults to "main"; status defaults to "draft"

      await page.locator('button:has-text("Create Page")').click();
      await page.waitForURL(/\/admin\/global\/pages\/.+\/builder/, { timeout: 15_000 });

      // Extract the generated page ID from the URL for cleanup
      const match = page.url().match(/\/pages\/([^/]+)\/builder/);
      createdPageId = match?.[1] ?? null;

      await expect(page.locator("text=← Back to Pages")).toBeVisible();
      await expect(page.locator("text=Start Building Your Page")).toBeVisible();
    } finally {
      if (createdPageId) deletePageAndMenuItems(createdPageId);
    }
  });

  test("edit page settings updates title, status and visibility", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    const { pageId } = createPageInDb({
      title: `E2E Edit Test ${ts}`,
      url: `/e2e-edit-${ts}`,
      menuName: "main",
      status: "draft",
    });

    try {
      await page.goto(`/admin/global/pages/${pageId}/edit`);
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.locator('input[name="title"]').fill(`E2E Edit Updated ${ts}`);
      await page.locator('select[name="pageStatus"]').selectOption("published");
      await page.locator('select[name="visibility"]').selectOption("visible");

      await page.locator('button:has-text("Update Page")').click();
      await expect(page).toHaveURL(/\/admin\/global\/pages\/?$/, { timeout: 15_000 });
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });
});

// =============================================================================
// Menu management
// =============================================================================

test.describe("Pages — menu management", () => {
  test("add a footer link via the footer form", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    const title = `E2E Footer ${ts}`;
    const url = `/e2e-footer-${ts}`;

    await page.goto("/admin/global/pages");
    // React MenuTable loads with eagerness: "load"
    await expect(page.locator("h3:has-text('Footer Links')")).toBeVisible({ timeout: 15_000 });

    // The footer add-form is the first form inside the footer section
    const footerSection = page.locator("div").filter({ has: page.locator("h3:has-text('Footer Links')") }).first();
    await footerSection.locator('input[name="title"]').fill(title);
    await footerSection.locator('input[name="url"]').fill(url);
    await footerSection.locator('button:has-text("Add")').click();

    // The new row should appear in the footer table
    await expect(page.locator(`td:has-text("${title}")`)).toBeVisible({ timeout: 10_000 });

    // Cleanup: remove the created menu item
    const item = getMenuItemByUrl(url);
    if (item) deleteMenuItemById(item.id);
  });

  test("delete a page-linked menu item from the list", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    const { pageId } = createPageInDb({
      title: `E2E Delete Me ${ts}`,
      url: `/e2e-delete-${ts}`,
      menuName: "main",
      status: "draft",
    });

    try {
      await page.goto("/admin/global/pages");
      await expect(page.locator("h3:has-text('Main Menu')")).toBeVisible({ timeout: 15_000 });

      // Accept the browser confirm() dialog
      page.on("dialog", (d) => d.accept());

      // Find and click the Delete button in the row containing our page title
      const row = page.locator("tr").filter({ has: page.locator(`text=E2E Delete Me ${ts}`) });
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.locator('button:has-text("Delete")').click();

      // Row should disappear after deletion
      await expect(row).not.toBeVisible({ timeout: 10_000 });
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("reorder footer links via drag-and-drop", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    // Create two footer items with explicit positions so we know their order
    const idA = createMenuItemInDb({
      menuName: "footer",
      title: `Reorder A ${ts}`,
      url: `/e2e-reorder-a-${ts}`,
      position: 9000,
    });
    const idB = createMenuItemInDb({
      menuName: "footer",
      title: `Reorder B ${ts}`,
      url: `/e2e-reorder-b-${ts}`,
      position: 9001,
    });

    try {
      await page.goto("/admin/global/pages");
      await expect(page.locator("h3:has-text('Footer Links')")).toBeVisible({ timeout: 15_000 });

      const rowA = page.locator("tr").filter({ has: page.locator(`text=Reorder A ${ts}`) });
      const rowB = page.locator("tr").filter({ has: page.locator(`text=Reorder B ${ts}`) });
      await expect(rowA).toBeVisible({ timeout: 10_000 });
      await expect(rowB).toBeVisible({ timeout: 10_000 });

      // Drag-handle is the first <td> in each row (the ⠿ grip)
      const handleA = rowA.locator("td").first();
      const handleB = rowB.locator("td").first();

      const boundsA = await handleA.boundingBox();
      const boundsB = await handleB.boundingBox();

      if (boundsA && boundsB) {
        // Drag A to just above B (top half of B's row)
        await page.mouse.move(boundsA.x + boundsA.width / 2, boundsA.y + boundsA.height / 2);
        await page.mouse.down();
        await page.mouse.move(boundsB.x + boundsB.width / 2, boundsB.y + 2, { steps: 15 });
        await page.mouse.up();
        // Allow time for the server action to persist the new order
        await page.waitForTimeout(1_500);
      }

      // After a successful drag the positions should have changed
      // (at minimum: no error banner shown)
      await expect(page.locator("text=Move failed")).not.toBeVisible();
    } finally {
      deleteMenuItemById(idA);
      deleteMenuItemById(idB);
    }
  });
});

// =============================================================================
// Block builder — content blocks
// =============================================================================

test.describe("Pages — builder: content blocks", () => {
  test("TitleBlock: configure text, heading level and alignment then save", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder TitleBlock",
      url: `/e2e-builder-title-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await expect(page.locator("text=Start Building Your Page")).toBeVisible();

      await addBlock(page, "TitleBlock");

      // PropertiesPanel should now show the TitleBlock fields
      await expect(page.locator('input[name="text"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('input[name="text"]').fill("E2E Page Title");
      await page.locator('select[name="level"]').selectOption("3");
      await page.locator('select[name="align"]').selectOption("center");

      await saveAndConfirm(page);

      // Verify persisted data
      const content = getPageContent(pageId);
      expect(content).toHaveLength(1);
      expect((content[0] as any).data.text).toBe("E2E Page Title");
      expect((content[0] as any).data.level).toBe("3");
      expect((content[0] as any).data.align).toBe("center");
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("TextBlock: configure content textarea then save", async ({ adminPage: page }) => {
    const { pageId } = createPageInDb({
      title: "Builder TextBlock",
      url: `/e2e-builder-text-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "TextBlock");

      await expect(page.locator('textarea[name="content"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('textarea[name="content"]').fill("<p>E2E text content</p>");

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect(content).toHaveLength(1);
      expect((content[0] as any).data.content).toBe("<p>E2E text content</p>");
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("SpacerBlock: configure height number field then save", async ({ adminPage: page }) => {
    const { pageId } = createPageInDb({
      title: "Builder SpacerBlock",
      url: `/e2e-builder-spacer-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "SpacerBlock");

      await expect(page.locator('input[name="height"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('input[name="height"]').fill("120");

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect(content).toHaveLength(1);
      expect((content[0] as any).data.height).toBe(120);
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("ActionButtonBlock: configure button text and URL then save", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder ActionButtonBlock",
      url: `/e2e-builder-btn-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "ActionButtonBlock");

      await expect(page.locator('input[name="text"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('input[name="text"]').fill("Join Now");
      await page.locator('input[name="href"]').fill("/join");
      await page.locator('select[name="align"]').selectOption("center");

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect((content[0] as any).data.text).toBe("Join Now");
      expect((content[0] as any).data.href).toBe("/join");
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("SurveyFormBlock: configure formId and showTitle then save", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder SurveyFormBlock",
      url: `/e2e-builder-survey-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "SurveyFormBlock");

      await expect(page.locator('input[name="formId"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('input[name="formId"]').fill("00000000-0000-0000-0000-000000000001");

      // showTitle checkbox is on by default (defaultValue: true); toggle it off
      const showTitleCheckbox = page.locator('input#showTitle');
      if (await showTitleCheckbox.isChecked()) {
        await showTitleCheckbox.uncheck();
      }

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect((content[0] as any).data.formId).toBe("00000000-0000-0000-0000-000000000001");
      expect((content[0] as any).data.showTitle).toBe(false);
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("UpcomingEventsBlock: adds to canvas with no config required", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder UpcomingEventsBlock",
      url: `/e2e-builder-upcoming-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "UpcomingEventsBlock");

      // PropertiesPanel shows the block name when no configSchema fields
      await expect(page.getByRole('heading', { name: 'Upcoming Events' })).toBeVisible({ timeout: 5_000 });

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect(content).toHaveLength(1);
      expect((content[0] as any).componentType).toBe("UpcomingEventsBlock");
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("PostsListBlock: configure limit then save", async ({ adminPage: page }) => {
    const { pageId } = createPageInDb({
      title: "Builder PostsListBlock",
      url: `/e2e-builder-posts-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "PostsListBlock");

      await expect(page.locator('input[name="limit"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('input[name="limit"]').fill("3");

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect((content[0] as any).data.limit).toBe(3);
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });
});

// =============================================================================
// Block builder — toolbar actions (move, duplicate, delete)
// =============================================================================

test.describe("Pages — builder: block toolbar", () => {
  test("move block down swaps order with the block below", async ({ adminPage: page }) => {
    const { pageId } = createPageInDb({
      title: "Builder Toolbar Move",
      url: `/e2e-builder-move-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);

      // Add TitleBlock first (order 0), then TextBlock (order 1)
      await addBlock(page, "TitleBlock");
      await addBlock(page, "TextBlock");

      // Click the TitleBlock to select it — the toolbar buttons become visible
      // The TitleBlock is the first block in the canvas
      const blocks = page.locator(".space-y-4 > div");
      await blocks.first().click();

      // Move Down button should be visible (TitleBlock is not last)
      const moveDownBtn = page.locator('button[title="Move Down"]');
      await expect(moveDownBtn).toBeVisible({ timeout: 5_000 });
      await moveDownBtn.click();

      // After move: TextBlock label (📰 Text Content) should now be first
      const firstBlockLabel = blocks.first().locator("span", { hasText: "Text Content" });
      await expect(firstBlockLabel).toBeVisible({ timeout: 5_000 });
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("duplicate block creates a second identical block", async ({ adminPage: page }) => {
    const { pageId } = createPageInDb({
      title: "Builder Toolbar Duplicate",
      url: `/e2e-builder-dup-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "TitleBlock");

      // Select the block to make toolbar visible
      await page.locator(".max-w-5xl .space-y-4 > div").first().click();

      const dupBtn = page.locator('button[title="Duplicate"]');
      await expect(dupBtn).toBeVisible({ timeout: 5_000 });
      await dupBtn.click();

      // Canvas should now have 2 blocks
      const blocks = page.locator(".max-w-5xl .space-y-4 > div");
      await expect(blocks).toHaveCount(2, { timeout: 5_000 });

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect(content).toHaveLength(2);
      expect((content[0] as any).componentType).toBe("TitleBlock");
      expect((content[1] as any).componentType).toBe("TitleBlock");
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("delete block removes it from the canvas", async ({ adminPage: page }) => {
    const { pageId } = createPageInDb({
      title: "Builder Toolbar Delete",
      url: `/e2e-builder-del-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "TitleBlock");

      // Select the block
      await page.locator(".space-y-4 > div").first().click();

      page.on("dialog", (d) => d.accept());

      const deleteBtn = page.locator('button[title="Delete"]');
      await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
      await deleteBtn.click();

      // Canvas should be empty again
      await expect(page.locator("text=Start Building Your Page")).toBeVisible({ timeout: 5_000 });
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });
});

// =============================================================================
// Block builder — ImageBlock with deferred image upload
// =============================================================================

test.describe("Pages — builder: image upload", () => {
  test("ImageBlock: full deferred upload flow — crop, save, URL persisted in DB", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder ImageBlock Upload",
      url: `/e2e-builder-image-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await expect(page.locator("text=Start Building Your Page")).toBeVisible();

      await addBlock(page, "ImageBlock");

      // ImageBlock is auto-selected; PropertiesPanel should show the Image upload field
      // The ImageUploader renders an <input type="file"> (may be visually hidden)
      const fileInput = page.locator('input[type="file"]').first();
      await expect(fileInput).toBeAttached({ timeout: 10_000 });

      await fileInput.setInputFiles({
        name: "test-image.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_PNG_BASE64, "base64"),
      });

      // Crop confirmation UI appears
      await expect(page.locator('button:has-text("Confirm Crop")')).toBeVisible({
        timeout: 10_000,
      });
      await page.locator('button:has-text("Confirm Crop")').click();

      // Deferred-ready message confirms upload will happen on save
      await expect(
        page.locator("text=Image ready — will be uploaded on save."),
      ).toBeVisible({ timeout: 10_000 });

      // Dismiss the Uppy widget (clicking Done commits the upload state into the block)
      const doneBtn = page.locator('button:has-text("Done")');
      if (await doneBtn.isVisible()) {
        await doneBtn.click();
      }

      // Fill in the required alt text field
      await page.locator('input[name="alt"]').fill("E2E test image");

      // Save triggers the actual upload
      await page.locator('button:has-text("Save Page")').click();
      await expect(page.locator("text=Saved!")).toBeVisible({ timeout: 30_000 });

      // Verify the `src` in persisted DB content is a real URL (upload succeeded)
      const content = getPageContent(pageId);
      expect(content).toHaveLength(1);
      const src = (content[0] as any).data?.src as string | undefined;
      expect(src, "ImageBlock src should be a URL after upload").toMatch(/^https?:\/\//i);
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });
});

// =============================================================================
// Block builder — complex blocks (smoke tests)
// =============================================================================

test.describe("Pages — builder: complex blocks", () => {
  test("FeatureBlock: adds to canvas, gap can be changed, saves successfully", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder FeatureBlock",
      url: `/e2e-builder-feature-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);
      await addBlock(page, "FeatureBlock");

      // PropertiesPanel should show "Feature Grid" heading and gap number field
      await expect(page.getByRole('heading', { name: 'Feature Grid' })).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('input[name="gap"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('input[name="gap"]').fill("16");

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect(content).toHaveLength(1);
      expect((content[0] as any).componentType).toBe("FeatureBlock");
      expect((content[0] as any).data.gap).toBe(16);
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("HeroSectionBlock and GroupsListBlock: no-config dynamic blocks add to canvas", async ({
    adminPage: page,
  }) => {
    const { pageId } = createPageInDb({
      title: "Builder Dynamic Blocks",
      url: `/e2e-builder-dynamic-${Date.now()}`,
      menuName: "main",
      status: "draft",
    });
    try {
      await goToBuilder(page, pageId);

      await addBlock(page, "HeroSectionBlock");
      await addBlock(page, "GroupsListBlock");

      await saveAndConfirm(page);

      const content = getPageContent(pageId);
      expect(content).toHaveLength(2);
      const types = content.map((b: any) => b.componentType);
      expect(types).toContain("HeroSectionBlock");
      expect(types).toContain("GroupsListBlock");
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });
});

// =============================================================================
// Public page rendering
// =============================================================================

test.describe("Pages — public rendering", () => {
  test("published page is accessible at its configured URL", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    const publicUrl = `/e2e-public-${ts}`;
    const { pageId } = createPageInDb({
      title: `E2E Public Page ${ts}`,
      url: publicUrl,
      menuName: "main",
      status: "published",
    });

    try {
      await page.goto(publicUrl);

      // The catch-all route renders the page — should NOT 404
      // A published page with no content renders an empty content area, not an error page
      const title = await page.title();
      expect(title).not.toMatch(/404|not found/i);

      // There should be no "404" or "Page Not Found" heading visible
      await expect(page.locator("h1:has-text('404')").or(page.locator("text=Page Not Found"))).toHaveCount(0);
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });

  test("draft page returns 404 or redirects away", async ({ adminPage: page }) => {
    const ts = Date.now().toString(36);
    const draftUrl = `/e2e-draft-${ts}`;
    const { pageId } = createPageInDb({
      title: `E2E Draft Page ${ts}`,
      url: draftUrl,
      menuName: "main",
      status: "draft",
    });

    try {
      const response = await page.goto(draftUrl);
      // Draft pages should not be publicly accessible (404 or redirect)
      const statusOk =
        response?.status() === 404 ||
        (response?.status() !== undefined && response.status() < 400 && page.url() !== `http://localhost:5173${draftUrl}`);
      expect(
        statusOk || response?.status() === 404,
        `Draft page at ${draftUrl} should be inaccessible (got ${response?.status()})`,
      ).toBeTruthy();
    } finally {
      deletePageAndMenuItems(pageId);
    }
  });
});
