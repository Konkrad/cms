/**
 * The event page is the hub (spec 5.2): posts about the event (core posts with the event as
 * subject) show underneath it. Organisers write them on the event's admin Posts tab.
 */
import type { Browser } from "@playwright/test";
import {
	addScopeMember,
	createPostInDb,
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deletePostById,
	deleteScopeById,
	expect,
	getPostsByBodyText,
	grantScopeRole,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const CHAPTER = `e2e-evp-${suffix}`;

let chapter: ReturnType<typeof createScopeInDb>;
let organiser: ReturnType<typeof createUserSession>;
let member: ReturnType<typeof createUserSession>;
let event: ReturnType<typeof createScopeEventInDb>;
const postIds: string[] = [];

test.beforeAll(() => {
	chapter = createScopeInDb({
		parentPath: "/",
		slug: CHAPTER,
		name: "Event Posts Chapter",
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
	for (const id of postIds) deletePostById(id);
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

test("an organiser posts about the event and it shows under the event", async ({
	browser,
	guestPage,
}) => {
	const text = `Doors open at 18:00 ${suffix}`;
	const { ctx, page } = await pageAs(browser, organiser);
	try {
		await page.goto(`/admin/${CHAPTER}/events/${event.eventId}/posts`);
		const editor = page.locator('[contenteditable="true"]').first();
		await expect(editor).toBeVisible({ timeout: 15_000 });
		await editor.click();
		await page.keyboard.type(text);
		await expect(page.locator('input[name="body"]')).toHaveValue(
			new RegExp(text),
			{ timeout: 5_000 },
		);
		// The event is public, so the organiser's default is public too.
		await expect(
			page.locator('input[name="visibility"][value="public"]'),
		).toBeChecked();
		await page.getByRole("button", { name: "Publish post" }).click();
		await expect(page.getByTestId("event-admin-posts")).toContainText(text, {
			timeout: 10_000,
		});
	} finally {
		await ctx.close();
	}
	const [saved] = getPostsByBodyText(text);
	expect(saved?.subject_type).toBe("events:event");
	expect(saved?.subject_id).toBe(event.eventId);
	expect(saved?.title).toBeNull();
	postIds.push(saved.id);

	await guestPage.goto(eventUrl());
	const posts = guestPage.getByTestId("event-posts");
	await expect(posts).toBeVisible({ timeout: 10_000 });
	await expect(posts.locator('[data-post-kind="note"]')).toContainText(text);
});

test("a members-only post about the event is hidden from guests", async ({
	browser,
	guestPage,
}) => {
	const text = `Members meet at the gate ${suffix}`;
	postIds.push(
		createPostInDb({
			title: null,
			body: `<p>${text}</p>`,
			userId: organiser.userId,
			scopeId: chapter.id,
			visibility: "members",
			subject: { type: "events:event", id: event.eventId },
		}),
	);

	await guestPage.goto(eventUrl());
	await expect(guestPage.getByRole("heading", { level: 1 })).toBeVisible({
		timeout: 10_000,
	});
	await expect(guestPage.getByText(text)).toHaveCount(0);

	const { ctx, page } = await pageAs(browser, member);
	try {
		await page.goto(eventUrl());
		await expect(page.getByTestId("event-posts")).toContainText(text, {
			timeout: 10_000,
		});
	} finally {
		await ctx.close();
	}
});
