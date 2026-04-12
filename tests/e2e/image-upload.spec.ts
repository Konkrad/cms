import { test, expect } from "../fixtures-e2e";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, "my-database.db");

// Valid 200×200 cornflower-blue PNG generated with Sharp — processed fine by the server pipeline
const TEST_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAD8UlEQVR4nO2UAQnAQACEFtZKi/kdVmJDdggmOOUu7hMtwNsZXG3aAnxwLoVVWKewiuD85V97LN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN/BJIXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5Y5AEsjrLZK0C6dwAAAABJRU5ErkJggg==";

function createAdminWithSession() {
  const db = new Database(DB_PATH);
  const userId = crypto.randomUUID();
  const loginId = crypto.randomUUID();
  const email = `admin-upload-test-${Date.now()}@example.com`;
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto.randomBytes(48).toString("hex");

  db.prepare(
    "INSERT INTO logins (id, email, expires_at) VALUES (?, ?, ?)",
  ).run(loginId, email, new Date(Date.now() + 3_600_000).toISOString());

  db.prepare(
    "INSERT INTO users (id, name, family_name, login_id, role) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, "Upload", "Tester", loginId, "admin");

  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
  ).run(sessionId, userId, sessionToken, new Date(Date.now() + 3_600_000).toISOString());

  db.close();

  return {
    userId,
    sessionToken,
    cleanup() {
      const db2 = new Database(DB_PATH);
      db2.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
      db2.prepare("DELETE FROM users WHERE id = ?").run(userId);
      db2.prepare("DELETE FROM logins WHERE id = ?").run(loginId);
      db2.close();
    },
  };
}

function getPostByTitle(title: string) {
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare("SELECT id, title, featured_image FROM posts WHERE title = ? ORDER BY created_at DESC LIMIT 1").get(title) as any;
  db.close();
  return row ?? null;
}

test.describe("ImageUpload — deferred upload (uploadRegistry)", () => {
  test("post create: image is uploaded and saved when form is submitted", async ({ page }) => {
    const { userId, sessionToken, cleanup } = createAdminWithSession();
    const postTitle = `Deferred Upload Test ${Date.now()}`;
    try {
      await page.context().addCookies([
        { name: "session", value: sessionToken, domain: "localhost", path: "/" },
      ]);

      await page.goto("/admin/global/posts/new");
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });

      await page.locator('input[name="title"]').fill(postTitle);

      // Attach test image to the hidden file input
      await page.locator('input[type="file"]').setInputFiles({
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

      // And the post must be persisted with a real image URL
      const savedPost = getPostByTitle(postTitle);
      expect(savedPost, "post was not saved to DB").not.toBeNull();
      expect(savedPost.featured_image, "featured_image should be an https/http URL after upload").toMatch(/^https?:\/\//i);
    } finally {
      // clean up the created post
      const db2 = new Database(DB_PATH);
      db2.prepare("DELETE FROM posts WHERE title = ?").run(postTitle);
      db2.close();
      cleanup();
    }
  });

  test("profile edit: profile picture is uploaded and saved when form is submitted", async ({ page }) => {
    const { userId, sessionToken, cleanup } = createAdminWithSession();
    try {
      await page.context().addCookies([
        { name: "session", value: sessionToken, domain: "localhost", path: "/" },
      ]);

      await page.goto("/profile/edit");
      await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10_000 });

      // Ensure required fields are filled
      await page.locator('input[name="name"]').fill("Upload");
      await page.locator('input[name="family_name"]').fill("Tester");

      // Attach test image
      await page.locator('input[type="file"]').setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_PNG_BASE64, "base64"),
      });

      await expect(page.locator('button:has-text("Confirm Crop")')).toBeVisible({ timeout: 5_000 });
      await page.locator('button:has-text("Confirm Crop")').click();
      await expect(
        page.locator("text=Image ready — will be uploaded on save."),
      ).toBeVisible({ timeout: 5_000 });

      // Submit
      await page.locator('button[type="submit"]').first().click();

      // Redirects to exactly /profile on success (not /profile/edit)
      await expect(page).toHaveURL(/\/profile\/?$/, { timeout: 15_000 });

      // Verify profile picture was persisted
      const db = new Database(DB_PATH, { readonly: true });
      const user = db.prepare("SELECT profile_picture FROM users WHERE id = ?").get(userId) as any;
      db.close();
      expect(user?.profile_picture, "profile_picture should be set after upload").toMatch(/^https?:\/\//i);
    } finally {
      cleanup();
    }
  });
});
