import {
  test,
  expect,
  createUserSession,
  getPostByTitle,
  deletePostByTitle,
  getUserById,
} from "../fixtures";

// Valid 200×200 cornflower-blue PNG generated with Sharp — processed fine by the server pipeline
const TEST_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAD8UlEQVR4nO2UAQnAQACEFtZKi/kdVmJDdggmOOUu7hMtwNsZXG3aAnxwLoVVWKewiuD85V97LN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN/BJIXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5Y5AEsjrLZK0C6dwAAAABJRU5ErkJggg==";

test.describe("ImageUpload — deferred upload (uploadRegistry)", () => {
  test("post create: image is uploaded and saved when form is submitted", async ({ adminPage: page }) => {
    const postTitle = `Deferred Upload Test ${Date.now()}`;
    try {

      await page.goto("/admin/global/posts/new");
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.locator('input[name="title"]').fill(postTitle);

      // Attach test image to the hidden file input
      await page.locator('input[type="file"]').first().setInputFiles({
        name: "test.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_PNG_BASE64, "base64"),
      });

      // Crop UI should appear; wait for the confirm button
      await expect(page.locator('button:has-text("Confirm Crop")')).toBeVisible({ timeout: 5_000 });

      // Confirm the crop (deferred — no upload yet)
      await page.locator('button:has-text("Confirm Crop")').click();

      // Component shows the deferred-ready message
      await expect(
        page.locator("text=Image ready — will be uploaded on save."),
      ).toBeVisible({ timeout: 5_000 });

      // Submit the form
      await page.locator('button:has-text("Create Post")').click();

      // Must redirect to the post LIST, not stay on /new
      await expect(page).toHaveURL(/\/admin\/global\/posts\/?$/, { timeout: 15_000 });

      // And the post must be persisted with a processed image (S3 key or full URL)
      const savedPost = getPostByTitle(postTitle);
      expect(savedPost, "post was not saved to DB").not.toBeNull();
      expect(savedPost?.featured_image, "featured_image should be set after upload").toBeTruthy();
      expect(savedPost?.featured_image, "featured_image should be a webp S3 key or URL").toMatch(/\.webp($|\?)/i);
    } finally {
      // clean up the created post
      deletePostByTitle(postTitle);
    }
  });

  test("profile: profile picture is uploaded and saved in place, no navigation", async ({ browser }) => {
    const session = createUserSession("admin");
    const context = await browser.newContext();
    await context.addCookies([
      { name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" },
    ]);
    const page = await context.newPage();
    try {

      await page.goto("/profile");
      await expect(page.locator('button[aria-label="Change profile picture"]')).toBeVisible({ timeout: 10_000 });
      await page.locator('button[aria-label="Change profile picture"]').click();

      // Attach test image (autoUpload mode — no separate submit button)
      await page.locator('input[type="file"]').first().setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_PNG_BASE64, "base64"),
      });

      await expect(page.locator('button:has-text("Confirm Crop")')).toBeVisible({ timeout: 5_000 });
      await page.locator('button:has-text("Confirm Crop")').click();

      // autoUpload fires immediately after crop confirm, then the widget
      // submits the update action itself and closes its own popover on success.
      await expect(page.locator('button[aria-label="Cancel"]')).toBeHidden({ timeout: 15_000 });

      // Stayed on /profile throughout — in-place editing, no page navigation
      await expect(page).toHaveURL(/\/profile\/?$/);

      // Verify profile picture was persisted (stored as S3 key or full URL)
      const userRow = getUserById(session.userId);
      expect(userRow?.profile_picture, "profile_picture should be set after upload").toBeTruthy();
      expect(userRow?.profile_picture as string, "profile_picture should be a webp S3 key or URL").toMatch(/\.webp($|\?)/i);
    } finally {
      await context.close();
      session.cleanup();
    }
  });
});
