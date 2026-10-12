/**
 * Notes and articles (spec 4.4): two core types. A note is short text with its author (no
 * title, no image) at `/notes/<id>`; an article has a title and an optional image at
 * `/articles/<id>`. Stream blocks mix both or show one type; admins write notes from a quick
 * form and articles from the editor.
 */
import {
	createArticleInDb,
	createNoteInDb,
	createPageInDb,
	createUserSession,
	deleteArticleById,
	deleteArticleByTitle,
	deleteNoteById,
	deletePageAndMenuItems,
	ensureNewsPage,
	expect,
	getArticleByTitle,
	getNotesByBodyText,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const NOTE_TEXT = `Doors open at 18:00 ${suffix}`;
const ARTICLE_TITLE = `Spring recap ${suffix}`;
const MEMBERS_NOTE = `Members only reminder ${suffix}`;

let author: ReturnType<typeof createUserSession>;
let noteId: string;
let articleId: string;
let membersNoteId: string;
let shortStream: { pageId: string };
const SHORT_STREAM_URL = `/e2e-short-${suffix}`;
const noteIds: string[] = [];
const articleTitles: string[] = [];

test.beforeAll(() => {
	ensureNewsPage();
	author = createUserSession("user", "stream", {
		name: "Pia",
		familyName: "Poster",
	});
	articleId = createArticleInDb({
		title: ARTICLE_TITLE,
		body: `<p>A long look back at spring ${suffix}.</p>`,
		featuredImage: "public/articles/e2e-spring.webp",
		userId: author.userId,
	});
	noteId = createNoteInDb({
		body: `<p>${NOTE_TEXT}</p>`,
		userId: author.userId,
	});
	membersNoteId = createNoteInDb({
		body: `<p>${MEMBERS_NOTE}</p>`,
		userId: author.userId,
		visibility: "members",
	});
	// A "short stream": a page with a Stream block that shows notes only.
	shortStream = createPageInDb({
		title: "Short stream",
		url: SHORT_STREAM_URL,
		menuName: "main",
		status: "published",
		content: [
			{
				id: crypto.randomUUID(),
				componentType: "StreamBlock",
				order: 0,
				data: { show: "notes", limit: 10 },
			},
		],
	});
});

test.afterAll(() => {
	deleteArticleById(articleId);
	for (const id of [noteId, membersNoteId, ...noteIds]) deleteNoteById(id);
	for (const title of articleTitles) deleteArticleByTitle(title);
	deletePageAndMenuItems(shortStream.pageId);
	author.cleanup();
});

test.describe("Note and article pages", () => {
	test("a note renders as a note: text and author, no title", async ({
		guestPage: page,
	}) => {
		await page.goto(`/notes/${noteId}`);
		const note = page.locator('[data-layout="note"]');
		await expect(note).toBeVisible({ timeout: 10_000 });
		await expect(note).toContainText(NOTE_TEXT);
		// The author is shown with the note (first name for guests); there is no title.
		await expect(note).toContainText("Pia");
		await expect(page.locator("h1")).toHaveCount(0);
	});

	test("an article renders its title, text and image, with og:image", async ({
		guestPage: page,
	}) => {
		await page.goto(`/articles/${articleId}`);
		const article = page.locator('[data-layout="article"]');
		await expect(article).toBeVisible({ timeout: 10_000 });
		await expect(page.locator("h1")).toHaveText(ARTICLE_TITLE);
		await expect(article.locator(".prose")).toContainText("A long look back");
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			"content",
			/public\/articles\/e2e-spring\.webp$/,
		);
		await expect(
			article.locator('img[src$="public/articles/e2e-spring.webp"]').first(),
		).toBeAttached();
	});

	test("missing items show the not-found state", async ({
		guestPage: page,
	}) => {
		await page.goto("/articles/does-not-exist-123");
		await expect(
			page.getByRole("heading", { name: "Article Not Found" }),
		).toBeVisible({ timeout: 10_000 });
		// A note id is no article.
		const res = await page.goto(`/articles/${noteId}`);
		expect(res?.status()).toBe(404);
	});

	test("a members-only note is hidden from guests and shown to members of its scope", async ({
		guestPage,
		adminPage,
	}) => {
		const res = await guestPage.goto(`/notes/${membersNoteId}`);
		expect(res?.status()).toBe(404);
		expect(await guestPage.content()).not.toContain(MEMBERS_NOTE);
		await guestPage.goto("/news");
		await expect(
			guestPage.locator('[data-stream-type="note"]', { hasText: NOTE_TEXT }),
		).toBeVisible({ timeout: 10_000 });
		await expect(guestPage.getByText(MEMBERS_NOTE)).toHaveCount(0);
		// Root admins hold a role on the root: they see members-only content there.
		await adminPage.goto(`/notes/${membersNoteId}`);
		await expect(adminPage.locator('[data-layout="note"]')).toContainText(
			MEMBERS_NOTE,
			{ timeout: 10_000 },
		);
	});
});

test.describe("Stream blocks", () => {
	test("the news stream shows notes and articles together", async ({
		memberPage: page,
	}) => {
		await page.goto("/news");
		const note = page.locator('[data-stream-type="note"]', {
			hasText: NOTE_TEXT,
		});
		const article = page.locator('[data-stream-type="article"]', {
			hasText: ARTICLE_TITLE,
		});
		await expect(note).toBeVisible({ timeout: 10_000 });
		await expect(article).toBeVisible();
		// A note is shown whole; an article links to its page and shows its image.
		await expect(article).toHaveAttribute("href", `/articles/${articleId}`);
		await expect(article.locator("img")).toHaveAttribute(
			"src",
			/public\/articles\/e2e-spring\.webp$/,
		);
	});

	test("a notes-only stream shows notes and no articles", async ({
		guestPage: page,
	}) => {
		await page.goto(SHORT_STREAM_URL);
		await expect(
			page.locator('[data-stream-type="note"]', { hasText: NOTE_TEXT }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('[data-stream-type="article"]')).toHaveCount(0);
	});

	test("the archives list both or one type", async ({ guestPage: page }) => {
		await page.goto("/archive/articles");
		await expect(
			page.locator('[data-stream-type="article"]', { hasText: ARTICLE_TITLE }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('[data-stream-type="note"]')).toHaveCount(0);
	});
});

test.describe("Admin: notes and articles", () => {
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

	test("an admin writes a note from the quick form", async ({
		adminPage: page,
	}) => {
		const text = `Admin note ${suffix}`;
		await page.goto("/admin/root/notes");
		await writeBody(page, text);
		await expect(page.getByTestId("note-length")).toContainText(
			`${text.length} / 1000`,
		);
		await page.getByRole("button", { name: "Publish note" }).click();
		await expect(page.locator("table")).toContainText(text, {
			timeout: 15_000,
		});
		const [note] = getNotesByBodyText(text);
		expect(note, "note saved").toBeTruthy();
		noteIds.push(note.id);

		await page.goto(`/notes/${note.id}`);
		await expect(page.locator('[data-layout="note"]')).toContainText(text, {
			timeout: 10_000,
		});
	});

	test("an admin writes an article from the editor", async ({
		adminPage: page,
	}) => {
		const title = `Admin article ${suffix}`;
		articleTitles.push(title);
		await page.goto("/admin/root/articles/new");
		await page.locator('input[name="title"]').fill(title);
		await writeBody(page, `Body of ${title}`);
		await page.getByRole("button", { name: "Publish" }).click();
		await expect(page).toHaveURL(/\/admin\/root\/articles\/?$/, {
			timeout: 15_000,
		});
		const article = getArticleByTitle(title);
		if (!article) throw new Error("article not saved");
		expect(article.featured_image).toBeNull();

		await page.goto(`/articles/${article.id}`);
		await expect(page.locator("h1")).toHaveText(title, { timeout: 10_000 });

		// Editing keeps the title required.
		await page.goto(`/admin/root/articles/${article.id}/edit`);
		await expect(page.locator('input[name="body"]')).toHaveValue(/Body of/, {
			timeout: 15_000,
		});
		await page.locator('input[name="title"]').fill(`${title} (edited)`);
		articleTitles.push(`${title} (edited)`);
		await page.getByRole("button", { name: "Save Changes" }).click();
		await expect(page.getByText("Article updated.")).toBeVisible({
			timeout: 15_000,
		});
		expect(getArticleByTitle(`${title} (edited)`)?.id).toBe(article.id);
	});
});
