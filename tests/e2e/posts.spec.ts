/**
 * Posts (spec 4.4): one type with an optional title. An untitled post renders as a note, a
 * titled one as an article; listings mix both; admins write either from the post editor.
 */
import {
	createPostInDb,
	createUserSession,
	deletePostById,
	ensureNewsPage,
	expect,
	getPostByTitle,
	getPostsByBodyText,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const NOTE_TEXT = `Doors open at 18:00 ${suffix}`;
const ARTICLE_TITLE = `Spring recap ${suffix}`;

let author: ReturnType<typeof createUserSession>;
let noteId: string;
let articleId: string;
const createdIds: string[] = [];

test.beforeAll(() => {
	ensureNewsPage();
	author = createUserSession("user", "posts", {
		name: "Pia",
		familyName: "Poster",
	});
	articleId = createPostInDb({
		title: ARTICLE_TITLE,
		body: `<p>A long look back at spring ${suffix}.</p>`,
		userId: author.userId,
	});
	noteId = createPostInDb({
		title: null,
		body: `<p>${NOTE_TEXT}</p>`,
		userId: author.userId,
	});
});

test.afterAll(() => {
	for (const id of [noteId, articleId, ...createdIds]) deletePostById(id);
	author.cleanup();
});

test.describe("Note and article layouts", () => {
	test("an untitled post renders as a note", async ({ guestPage: page }) => {
		await page.goto(`/posts/${noteId}`);
		const note = page.locator('[data-post-layout="note"]');
		await expect(note).toBeVisible({ timeout: 10_000 });
		await expect(note).toContainText(NOTE_TEXT);
		// The author is shown with the note (first name for guests); there is no title.
		await expect(note).toContainText("Pia");
		await expect(page.locator("h1")).toHaveCount(0);
		await expect(page.locator('[data-post-layout="article"]')).toHaveCount(0);
	});

	test("a titled post renders as an article", async ({ guestPage: page }) => {
		await page.goto(`/posts/${articleId}`);
		const article = page.locator('[data-post-layout="article"]');
		await expect(article).toBeVisible({ timeout: 10_000 });
		await expect(page.locator("h1")).toHaveText(ARTICLE_TITLE);
		await expect(article.locator(".prose")).toContainText("A long look back");
	});

	test("the news listing shows notes and articles together", async ({
		memberPage: page,
	}) => {
		await page.goto("/news");
		const note = page.locator('[data-post-kind="note"]', {
			hasText: NOTE_TEXT,
		});
		const article = page.locator('[data-post-kind="article"]', {
			hasText: ARTICLE_TITLE,
		});
		await expect(note).toBeVisible({ timeout: 10_000 });
		await expect(article).toBeVisible();
		// A note is shown whole; an article links to its page.
		await expect(article).toHaveAttribute("href", `/posts/${articleId}`);
	});
});

test.describe("Admin post editor", () => {
	async function writeBody(
		page: import("@playwright/test").Page,
		text: string,
	) {
		const editor = page.locator('[contenteditable="true"]').first();
		await expect(editor).toBeVisible({ timeout: 15_000 });
		await editor.click();
		await page.keyboard.type(text);
		// The hidden body field follows the editor.
		await expect(page.locator('input[name="body"]')).toHaveValue(
			new RegExp(text),
			{ timeout: 5_000 },
		);
	}

	test("an admin publishes a note (no title) and an article", async ({
		adminPage: page,
	}) => {
		const noteText = `Admin note ${suffix}`;
		await page.goto("/admin/root/posts/new");
		await writeBody(page, noteText);
		await page.getByRole("button", { name: "Publish" }).click();
		await expect(page).toHaveURL(/\/admin\/root\/posts\/?$/, {
			timeout: 15_000,
		});
		const [note] = getPostsByBodyText(noteText);
		expect(note, "note saved").toBeTruthy();
		expect(note.title).toBeNull();
		createdIds.push(note.id);

		const title = `Admin article ${suffix}`;
		await page.goto("/admin/root/posts/new");
		await page.locator('input[name="title"]').fill(title);
		await writeBody(page, `Body of ${title}`);
		await page.getByRole("button", { name: "Publish" }).click();
		await expect(page).toHaveURL(/\/admin\/root\/posts\/?$/, {
			timeout: 15_000,
		});
		const article = getPostByTitle(title);
		expect(article, "article saved").toBeTruthy();
		createdIds.push(article!.id);

		await page.goto(`/posts/${note.id}`);
		await expect(page.locator('[data-post-layout="note"]')).toContainText(
			noteText,
			{ timeout: 10_000 },
		);
		await page.goto(`/posts/${article!.id}`);
		await expect(page.locator("h1")).toHaveText(title, { timeout: 10_000 });
	});

	test("clearing the title turns an article into a note", async ({
		adminPage: page,
	}) => {
		const title = `Edit me ${suffix}`;
		const id = createPostInDb({
			title,
			body: `<p>Edited body ${suffix}</p>`,
			userId: author.userId,
		});
		createdIds.push(id);
		await page.goto(`/admin/root/posts/${id}/edit`);
		await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.locator('input[name="body"]')).toHaveValue(
			/Edited body/,
			{ timeout: 10_000 },
		);
		await page.locator('input[name="title"]').fill("");
		await page.getByRole("button", { name: "Save Changes" }).click();
		await expect(page.getByText("Post updated successfully!")).toBeVisible({
			timeout: 10_000,
		});
		await page.goto(`/posts/${id}`);
		await expect(page.locator('[data-post-layout="note"]')).toBeVisible({
			timeout: 10_000,
		});
	});
});
