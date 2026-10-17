/**
 * The event page is the hub (spec 5.2): updates about the event (core notes and articles with
 * the event as subject) show underneath it, merged newest first. Organisers write them on the
 * event's admin Updates tab ("Write note", "Write article").
 */
import type { Browser } from "@playwright/test";
import {
	addScopeMember,
	createArticleInDb,
	createNoteInDb,
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deleteArticleByTitle,
	deleteNoteById,
	deleteScopeById,
	expect,
	getArticleByTitle,
	getNotesByBodyText,
	grantScopeRole,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const CHAPTER = `e2e-evp-${suffix}`;

let chapter: ReturnType<typeof createScopeInDb>;
let organiser: ReturnType<typeof createUserSession>;
let member: ReturnType<typeof createUserSession>;
let event: ReturnType<typeof createScopeEventInDb>;
const noteIds: string[] = [];
const articleTitles: string[] = [];

test.beforeAll(() => {
	chapter = createScopeInDb({
		parentPath: "/",
		slug: CHAPTER,
		name: "Event Updates Chapter",
		kind: "region",
	});
	organiser = createUserSession("user", "evp-org", {
		name: "Olga",
		familyName: "Organiser",
	});
	grantScopeRole(organiser.userId, chapter.id, "admin");
	member = createUserSession("user", "evp-member");
	addScopeMember(member.userId, chapter.id);
	event = createScopeEventInDb({
		organizerId: organiser.userId,
		title: `Summer BBQ ${suffix}`,
		slug: `bbq-${suffix}`,
		scopeId: chapter.id,
	});
});

test.afterAll(() => {
	for (const id of noteIds) deleteNoteById(id);
	for (const title of articleTitles) deleteArticleByTitle(title);
	event.cleanup();
	deleteScopeById(chapter.id);
	organiser.cleanup();
	member.cleanup();
});

async function pageAs(
	browser: Browser,
	session: ReturnType<typeof createUserSession>,
) {
	const ctx = await browser.newContext();
	await ctx.addCookies([
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
	return { ctx, page: await ctx.newPage() };
}

const eventUrl = () => `/${CHAPTER}/events/bbq-${suffix}`;

/** Opens a form with its button; retried, as a click can get lost while the page still loads. */
async function openForm(
	page: import("@playwright/test").Page,
	button: string,
	form: string,
) {
	await expect(async () => {
		await page.getByRole("button", { name: button }).click();
		await expect(page.getByTestId(form)).toBeVisible({ timeout: 3_000 });
	}).toPass({ timeout: 20_000 });
}

async function typeBody(page: import("@playwright/test").Page, text: string) {
	const editor = page.locator('[contenteditable="true"]').first();
	await expect(editor).toBeVisible({ timeout: 15_000 });
	await editor.click();
	await page.keyboard.type(text);
	await expect(page.locator('input[name="body"]')).toHaveValue(
		new RegExp(text),
		{ timeout: 5_000 },
	);
}

test("an organiser writes a note and an article about the event; both show under it", async ({
	browser,
	guestPage,
}) => {
	const text = `Doors open at 18:00 ${suffix}`;
	const title = `BBQ recap ${suffix}`;
	articleTitles.push(title);
	const { ctx, page } = await pageAs(browser, organiser);
	try {
		await page.goto(`/admin/${CHAPTER}/events/${event.eventId}/updates`);
		await openForm(page, "Write note", "note-form");
		await typeBody(page, text);
		// The event is public, so the organiser's default is public too.
		await expect(
			page.locator('input[name="visibility"][value="public"]'),
		).toBeChecked();
		await page.getByRole("button", { name: "Publish note" }).click();
		await expect(page.getByTestId("event-admin-updates")).toContainText(text, {
			timeout: 10_000,
		});

		await openForm(page, "Write article", "article-form");
		await page.locator('input[name="title"]').fill(title);
		await typeBody(page, `The recap of ${title}`);
		await page.getByRole("button", { name: "Publish article" }).click();
		await expect(page.getByTestId("event-admin-updates")).toContainText(title, {
			timeout: 15_000,
		});
	} finally {
		await ctx.close();
	}
	const [note] = getNotesByBodyText(text);
	expect(note?.subject_type).toBe("events:event");
	expect(note?.subject_id).toBe(event.eventId);
	noteIds.push(note.id);
	const article = getArticleByTitle(title);
	expect(article?.subject_type).toBe("events:event");
	expect(article?.subject_id).toBe(event.eventId);

	await guestPage.goto(eventUrl());
	const updates = guestPage.getByTestId("event-updates");
	await expect(updates).toBeVisible({ timeout: 10_000 });
	await expect(updates.locator('[data-stream-type="note"]')).toContainText(
		text,
	);
	await expect(updates.locator('[data-stream-type="article"]')).toContainText(
		title,
	);
	// Newest first: the article was written after the note.
	await expect(updates.locator("[data-stream-type]").first()).toHaveAttribute(
		"data-stream-type",
		"article",
	);
});

test("a members-only note about the event is hidden from guests", async ({
	browser,
	guestPage,
}) => {
	const text = `Members meet at the gate ${suffix}`;
	noteIds.push(
		createNoteInDb({
			body: `<p>${text}</p>`,
			userId: organiser.userId,
			scopeId: chapter.id,
			visibility: "members",
			subject: { type: "events:event", id: event.eventId },
		}),
	);
	const title = `Public programme ${suffix}`;
	articleTitles.push(title);
	createArticleInDb({
		title,
		body: "<p>Programme</p>",
		userId: organiser.userId,
		scopeId: chapter.id,
		subject: { type: "events:event", id: event.eventId },
	});

	await guestPage.goto(eventUrl());
	await expect(guestPage.getByTestId("event-updates")).toContainText(title, {
		timeout: 10_000,
	});
	await expect(guestPage.getByText(text)).toHaveCount(0);

	const { ctx, page } = await pageAs(browser, member);
	try {
		await page.goto(eventUrl());
		await expect(page.getByTestId("event-updates")).toContainText(text, {
			timeout: 10_000,
		});
	} finally {
		await ctx.close();
	}
});
