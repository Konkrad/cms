/**
 * E2E parity coverage for the single-post detail route `/posts/[id]`, whose
 * presentation now lives in the theme layer (theme/routes/posts/PostView.tsx).
 * The route keeps its loader/head/auth in core and delegates rendering to the
 * theme — this test exercises that path end-to-end through the real server.
 *
 * Self-contained: creates its own /news page (if missing) and its own post,
 * independent of scripts/seed.ts (demo content is not a test fixture).
 */

import {
	createPostInDb,
	createUserSession,
	deletePostByTitle,
	ensureNewsPage,
	expect,
	test,
} from "../fixtures";

const POST_TITLE = "E2E Post Detail Fixture Post";

let author: ReturnType<typeof createUserSession>;

test.beforeAll(() => {
	ensureNewsPage();
	author = createUserSession("user");
	createPostInDb({
		title: POST_TITLE,
		body: "<p>Fixture post for the post-detail e2e spec.</p>",
		userId: author.userId,
	});
});

test.afterAll(() => {
	deletePostByTitle(POST_TITLE);
	author.cleanup();
});

test.describe("Post detail (themed view)", () => {
	test("renders a seeded post via the theme PostView", async ({
		memberPage: page,
	}) => {
		await page.goto("/news");

		// Wait for the list to render, then follow the first post link by URL (the
		// anchor may be a hidden hover affordance, so we navigate rather than click).
		await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
			timeout: 10_000,
		});
		const href = await page
			.locator('a[href^="/posts/"]')
			.first()
			.getAttribute("href");
		expect(href).toMatch(/^\/posts\/.+/);

		await page.goto(href!);
		await expect(page).toHaveURL(/\/posts\/.+/, { timeout: 10_000 });

		// The themed view renders the title as the single h1 and the sanitized body.
		await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });
		await expect(page.locator(".prose")).toBeVisible();
	});

	test("shows the themed not-found state for a missing post", async ({
		memberPage: page,
	}) => {
		await page.goto("/posts/does-not-exist-123");
		await expect(
			page.getByRole("heading", { name: "Post Not Found" }),
		).toBeVisible({ timeout: 10_000 });
	});
});
