import {
	createMenuItemInDb,
	createPostInDb,
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deleteMenuItemById,
	deletePostByTitle,
	deleteScopeById,
	expect,
	renameScopeInDb,
	test,
} from "../fixtures";

// Spec 4.3: every item has one canonical URL under its owning scope, and stored internal
// links are references that follow renames and moves.
test.describe("canonical item URLs and references", () => {
	const ts = Date.now().toString(36);
	let scope: { id: string; path: string };
	let organizer: ReturnType<typeof createUserSession>;

	test.beforeAll(() => {
		scope = createScopeInDb({ parentPath: "/", slug: `e2e-refs-${ts}` });
		organizer = createUserSession("user", "refs");
	});

	test.afterAll(() => {
		deleteScopeById(scope.id);
		organizer.cleanup();
	});

	test("an event lives at its scope's URL; other URLs answer 301 there", async ({
		guestPage: page,
	}) => {
		const title = `Refs BBQ ${ts}`;
		const ev = createScopeEventInDb({
			organizerId: organizer.userId,
			title,
			slug: `summer-bbq-${ts}`,
			scopeId: scope.id,
		});
		try {
			const canonical = `${scope.path}events/summer-bbq-${ts}`;
			const res = await page.goto(canonical);
			expect(res?.status()).toBe(200);
			await expect(page.getByText(title).first()).toBeVisible();

			// The root URL by id (old links) and by slug, and another scope's prefix.
			for (const path of [
				`/events/${ev.eventId}`,
				`/events/summer-bbq-${ts}`,
				`/events/${ev.eventId}/checkout`,
			]) {
				const r = await page.request.get(path, { maxRedirects: 0 });
				expect(r.status(), path).toBe(301);
				expect(new URL(r.headers().location, "http://x").pathname).toBe(
					path.endsWith("/checkout") ? `${canonical}/checkout` : canonical,
				);
			}
			// Following the redirect lands on the canonical page.
			await page.goto(`/events/${ev.eventId}`);
			await expect(page).toHaveURL(new RegExp(`${canonical}$`));
		} finally {
			ev.cleanup();
		}
	});

	test("a post lives at its scope's URL", async ({ guestPage: page }) => {
		const title = `Refs post ${ts}`;
		const postId = createPostInDb({
			title,
			body: "<p>Scoped post</p>",
			userId: organizer.userId,
			scopeId: scope.id,
		});
		try {
			const r = await page.request.get(`/posts/${postId}`, {
				maxRedirects: 0,
			});
			expect(r.status()).toBe(301);
			expect(new URL(r.headers().location, "http://x").pathname).toBe(
				`${scope.path}posts/${postId}`,
			);
			const res = await page.goto(`${scope.path}posts/${postId}`);
			expect(res?.status()).toBe(200);
			await expect(page.getByRole("heading", { name: title })).toBeVisible();
		} finally {
			deletePostByTitle(title);
		}
	});

	test("a menu item stored as a reference follows a scope rename", async ({
		guestPage: page,
	}) => {
		const local = createScopeInDb({
			parentPath: scope.path,
			slug: `menu-${ts}`,
			name: "Menu Target",
		});
		const label = `Refs Menu ${ts}`;
		const itemId = createMenuItemInDb({
			menuName: "main",
			title: label,
			url: `ref:scope:${local.id}`,
			position: 9500,
			status: "visible",
		});
		try {
			await page.goto("/");
			const link = page.locator("nav").getByRole("link", { name: label });
			await expect(link.first()).toHaveAttribute(
				"href",
				`${scope.path}menu-${ts}`,
			);

			renameScopeInDb(local.id, `renamed-${ts}`);
			await page.goto("/");
			await expect(link.first()).toHaveAttribute(
				"href",
				`${scope.path}renamed-${ts}`,
			);
		} finally {
			deleteMenuItemById(itemId);
		}
	});

	test("rich-text references render current URLs; links to deleted items are dropped", async ({
		guestPage: page,
	}) => {
		const moved = createScopeInDb({
			parentPath: scope.path,
			slug: `rt-${ts}`,
			name: "Rich Text Target",
		});
		const title = `Refs rich text ${ts}`;
		const gone = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
		const postId = createPostInDb({
			title,
			body: `<p>Visit <a href="ref:scope:${moved.id}">our chapter</a> or read <a href="ref:core:post:${gone}">the old news</a>.</p>`,
			userId: organizer.userId,
		});
		try {
			await page.goto(`/posts/${postId}`);
			const article = page.locator("article, main").first();
			await expect(
				article.getByRole("link", { name: "our chapter" }),
			).toHaveAttribute("href", `${scope.path}rt-${ts}`);
			// The deleted post's link is gone, its text stays.
			await expect(article.getByText("the old news")).toBeVisible();
			await expect(
				article.getByRole("link", { name: "the old news" }),
			).toHaveCount(0);

			renameScopeInDb(moved.id, `rt-moved-${ts}`);
			await page.goto(`/posts/${postId}`);
			await expect(
				article.getByRole("link", { name: "our chapter" }),
			).toHaveAttribute("href", `${scope.path}rt-moved-${ts}`);
		} finally {
			deletePostByTitle(title);
		}
	});
});
