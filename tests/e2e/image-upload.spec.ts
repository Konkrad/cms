import { createUserSession, expect, getUserById, test } from "../fixtures";

// Valid 200×200 cornflower-blue PNG generated with Sharp — processed fine by the server pipeline
const TEST_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAD8UlEQVR4nO2UAQnAQACEFtZKi/kdVmJDdggmOOUu7hMtwNsZXG3aAnxwLoVVWKewiuD85V97LN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN8BixSW74BFCst3wCKF5TtgkcLyHbBIYfkOWKSwfAcsUli+AxYpLN/BJIXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5YpLB8ByxSWL4DFiks3wGLFJbvgEUKy3fAIoXlO2CRwvIdsEhh+Q5Y5AEsjrLZK0C6dwAAAABJRU5ErkJggg==";

test.describe("ImageUpload — deferred upload (uploadRegistry)", () => {
	test("profile: profile picture is uploaded and saved in place, no navigation", async ({
		browser,
	}) => {
		const session = createUserSession("admin");
		const context = await browser.newContext();
		await context.addCookies([
			{
				name: "session",
				value: session.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		const page = await context.newPage();
		try {
			await page.goto("/profile");
			await expect(
				page.locator('button[aria-label="Change profile picture"]'),
			).toBeVisible({ timeout: 10_000 });
			await page.locator('button[aria-label="Change profile picture"]').click();

			// Attach test image (autoUpload mode — no separate submit button)
			await page
				.locator('input[type="file"]')
				.first()
				.setInputFiles({
					name: "avatar.png",
					mimeType: "image/png",
					buffer: Buffer.from(TEST_PNG_BASE64, "base64"),
				});

			await expect(page.locator('button:has-text("Confirm Crop")')).toBeVisible(
				{ timeout: 5_000 },
			);
			await page.locator('button:has-text("Confirm Crop")').click();

			// autoUpload fires immediately after crop confirm, then the widget
			// submits the update action itself and closes its own popover on success.
			await expect(
				page.locator('button[aria-label="Close photo editor"]'),
			).toBeHidden({ timeout: 15_000 });

			// Stayed on /profile throughout — in-place editing, no page navigation
			await expect(page).toHaveURL(/\/profile\/?$/);

			// Verify profile picture was persisted (stored as S3 key or full URL)
			const userRow = getUserById(session.userId);
			expect(
				userRow?.profile_picture,
				"profile_picture should be set after upload",
			).toBeTruthy();
			expect(
				userRow?.profile_picture as string,
				"profile_picture should be a webp S3 key or URL",
			).toMatch(/\.webp($|\?)/i);
		} finally {
			await context.close();
			session.cleanup();
		}
	});
});
