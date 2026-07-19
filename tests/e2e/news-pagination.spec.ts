/**
 * E2E tests for PostsListBlock bidirectional cursor pagination on /news.
 *
 * Fully self-contained: creates its own /news page (if missing) and 13 of its
 * own posts, independent of scripts/seed.ts (demo content is not a test
 * fixture — see tests/fixtures.ts `ensureNewsPage`/`createPostInDb`). At 10
 * per page, 13 posts means exactly two pages: page 1 (10 posts), page 2 (3).
 */

import {
	createPostInDb,
	createUserSession,
	deletePostByTitle,
	ensureNewsPage,
	expect,
	test,
} from "../fixtures";

const POST_COUNT = 13;
const TITLE_PREFIX = "E2E News Pagination Post";

let author: ReturnType<typeof createUserSession>;
const postTitles: string[] = [];

test.beforeAll(() => {
	ensureNewsPage();
	author = createUserSession("user");

	for (let i = 0; i < POST_COUNT; i++) {
		const title = `${TITLE_PREFIX} ${i + 1}`;
		postTitles.push(title);
		createPostInDb({
			title,
			body: `<p>Fixture post ${i + 1} for news pagination e2e.</p>`,
			userId: author.userId,
			// Stagger createdAt by one minute per post so timestamps are strictly
			// distinct and descending — cursor pagination keys on createdAt, so a
			// batch sharing the same millisecond would break page boundaries at ties.
			createdAt: new Date(Date.now() - i * 60_000).toISOString(),
		});
	}
});

test.afterAll(() => {
	for (const title of postTitles) deletePostByTitle(title);
	author.cleanup();
});

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

		await expect(
			page.getByRole("heading", { level: 3 }).first(),
		).not.toHaveText(firstTitlePage1!, { timeout: 10_000 });
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
		await expect(
			page.getByRole("heading", { level: 3 }).first(),
		).not.toHaveText(firstTitlePage1!, { timeout: 10_000 });

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
