/**
 * Reviews (spec 4.9, 5.2): a chapter representative's public event is proposed with the active
 * events.proposal form, the coordinators of the region above get an email, one approves it in
 * the review queue, and the event is published with an announcement note. A rejection sends it
 * back to draft with the comment; public articles by representatives wait for review too, and a
 * coordinator's event needs none.
 */
import type { Browser, Page } from "@playwright/test";
import {
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deleteArticleByTitle,
	deleteScopeById,
	expect,
	getArticleByTitle,
	getEventStatus,
	getFormResultsBySubject,
	getLatestReview,
	getUserEmailById,
	grantScopeRole,
	test,
} from "../fixtures";
import { waitForEmailHtml } from "../utils/mailpit-client";

const suffix = Date.now().toString(36);

// Several pages, an editor and the review handlers' scheduler tick per test.
test.setTimeout(90_000);
const REGION = `e2e-rv-${suffix}`;

let region: ReturnType<typeof createScopeInDb>;
let chapter: ReturnType<typeof createScopeInDb>;
let rep: ReturnType<typeof createUserSession>;
let coordinator: ReturnType<typeof createUserSession>;
const events: Array<ReturnType<typeof createScopeEventInDb>> = [];
const articleTitles: string[] = [];

test.beforeAll(() => {
	region = createScopeInDb({
		parentPath: "/",
		slug: REGION,
		name: "Review Region",
		kind: "region",
	});
	chapter = createScopeInDb({
		parentPath: region.path,
		slug: "city",
		name: "Review City",
		kind: "chapter",
	});
	rep = createUserSession("user", "rv-rep", {
		name: "Rita",
		familyName: "Rep",
	});
	grantScopeRole(rep.userId, chapter.id, "representative");
	coordinator = createUserSession("user", "rv-coord", {
		name: "Cora",
		familyName: "Coordinator",
	});
	grantScopeRole(coordinator.userId, region.id, "coordinator");
});

test.afterAll(() => {
	for (const e of events) e.cleanup();
	for (const title of articleTitles) deleteArticleByTitle(title);
	deleteScopeById(region.id);
	rep.cleanup();
	coordinator.cleanup();
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

function draftEvent(title: string, slug: string) {
	const event = createScopeEventInDb({
		organizerId: rep.userId,
		title,
		slug,
		scopeId: chapter.id,
		status: "draft",
	});
	events.push(event);
	return event;
}

const chapterAdmin = () => `/admin/${region.segment}.city`;
const regionAdmin = () => `/admin/${region.segment}`;

/** Fills the seeded events.proposal form and submits it. */
async function propose(page: Page, eventId: string) {
	await page.goto(`${chapterAdmin()}/events/${eventId}/review`);
	const form = page.getByTestId("event-proposal");
	await expect(form).toBeVisible({ timeout: 15_000 });
	await form.getByLabel("What is the event for?").fill("Meet new members");
	await form.getByLabel("Expected attendance").fill("40");
	await form
		.locator('[data-question="funding_needed"]')
		.getByLabel("No")
		.check();
	await form.getByRole("button", { name: "Submit for review" }).click();
	await expect(page.getByText("Sent for review.")).toBeVisible({
		timeout: 15_000,
	});
}

/** Decides the queued item for `ref` in the region's review queue. */
async function decide(
	page: Page,
	ref: string,
	decision: "Approve" | "Reject",
	comment?: string,
) {
	await page.goto(`${regionAdmin()}/reviews`);
	const item = page.locator(`[data-ref="${ref}"]`).first();
	await expect(item).toBeVisible({ timeout: 15_000 });
	if (comment) await item.locator('textarea[name="comment"]').fill(comment);
	await item.getByRole("button", { name: decision }).click();
	await expect(
		page.getByTestId("review-queue").locator(`[data-ref="${ref}"]`),
	).toHaveCount(0, { timeout: 15_000 });
}

test("a representative proposes a public event; the coordinator is emailed, approves it, and it is published with an announcement", async ({
	browser,
	guestPage,
}) => {
	const title = `Proposed meetup ${suffix}`;
	const slug = `proposed-${suffix}`;
	const event = draftEvent(title, slug);
	const ref = `events:event:${event.eventId}`;
	const eventPath = `/${REGION}/city/events/${slug}`;

	// A draft is not public.
	const draftResponse = await guestPage.goto(eventPath);
	expect(draftResponse?.status()).toBe(404);

	const since = new Date();
	const { ctx, page } = await pageAs(browser, rep);
	try {
		await propose(page, event.eventId);
	} finally {
		await ctx.close();
	}
	expect(getEventStatus(event.eventId)).toBe("in_review");
	const [proposal] = getFormResultsBySubject(ref);
	expect(proposal?.answers).toMatchObject({
		purpose: "Meet new members",
		expected_attendance: 40,
		funding_needed: false,
	});

	const coordinatorEmail = getUserEmailById(coordinator.userId);
	if (!coordinatorEmail) throw new Error("coordinator has no email");
	const html = await waitForEmailHtml(coordinatorEmail, 30_000, since);
	expect(html).toContain("Review requested");
	expect(html).toContain(title);

	const coord = await pageAs(browser, coordinator);
	try {
		// Coordinators reach their review queue from /admin.
		await coord.page.goto("/admin");
		await expect(coord.page).toHaveURL(/\/reviews\/?$/, { timeout: 15_000 });
		await decide(coord.page, ref, "Approve");
	} finally {
		await coord.ctx.close();
	}

	await expect
		.poll(() => getEventStatus(event.eventId), { timeout: 20_000 })
		.toBe("published");
	await guestPage.goto(eventPath);
	await expect(guestPage.locator("h1")).toContainText(title, {
		timeout: 15_000,
	});
	await expect(guestPage.getByText(`New event: ${title}`)).toBeVisible({
		timeout: 15_000,
	});
});

test("a rejected proposal goes back to draft with the comment and can be resubmitted", async ({
	browser,
}) => {
	const title = `Rejected meetup ${suffix}`;
	const event = draftEvent(title, `rejected-${suffix}`);
	const ref = `events:event:${event.eventId}`;
	const { ctx, page } = await pageAs(browser, rep);
	const coord = await pageAs(browser, coordinator);
	try {
		await propose(page, event.eventId);
		await decide(coord.page, ref, "Reject", "Please add the venue");
		await expect
			.poll(() => getEventStatus(event.eventId), { timeout: 20_000 })
			.toBe("draft");

		await page.goto(`${chapterAdmin()}/events/${event.eventId}/review`);
		await expect(page.getByTestId("review-comment")).toHaveText(
			"Please add the venue",
			{ timeout: 15_000 },
		);
		await propose(page, event.eventId);
		expect(getEventStatus(event.eventId)).toBe("in_review");
		expect(getLatestReview(ref)?.status).toBe("in_review");
	} finally {
		await ctx.close();
		await coord.ctx.close();
	}
});

test("a public event of a coordinator-level manager (region admin) is published without review", async ({
	browser,
}) => {
	const event = createScopeEventInDb({
		organizerId: coordinator.userId,
		title: `Coordinator event ${suffix}`,
		slug: `coord-${suffix}`,
		scopeId: chapter.id,
		status: "draft",
	});
	events.push(event);
	// Coordinators have no event admin; core says no review is needed for them.
	const { ctx, page } = await pageAs(browser, coordinator);
	try {
		const res = await page.goto(
			`${chapterAdmin()}/events/${event.eventId}/review`,
		);
		expect(res?.status()).toBe(403);
	} finally {
		await ctx.close();
	}
	// A region admin's draft (a manager at the coordinator level) skips review on submit.
	const admin = createUserSession("user", "rv-admin");
	grantScopeRole(admin.userId, region.id, "admin");
	const adminPage = await pageAs(browser, admin);
	try {
		await adminPage.page.goto(
			`${regionAdmin()}.city/events/${event.eventId}/review`,
		);
		const form = adminPage.page.getByTestId("event-proposal");
		await expect(form).toBeVisible({ timeout: 15_000 });
		await form.getByLabel("What is the event for?").fill("Board meeting");
		await form.getByLabel("Expected attendance").fill("10");
		await form
			.locator('[data-question="funding_needed"]')
			.getByLabel("No")
			.check();
		await form.getByRole("button", { name: "Submit for review" }).click();
		await expect(
			adminPage.page.locator("output", { hasText: "Published." }),
		).toBeVisible({
			timeout: 15_000,
		});
		expect(getEventStatus(event.eventId)).toBe("published");
		expect(getLatestReview(`events:event:${event.eventId}`)).toBeUndefined();
	} finally {
		await adminPage.ctx.close();
		admin.cleanup();
	}
});

test("a representative's public article is hidden until a coordinator approves it", async ({
	browser,
	guestPage,
}) => {
	const title = `Chapter article ${suffix}`;
	articleTitles.push(title);
	const { ctx, page } = await pageAs(browser, rep);
	try {
		await page.goto(`${chapterAdmin()}/articles/new`);
		await page.locator('input[name="title"]').fill(title);
		const editor = page.locator('[contenteditable="true"]').first();
		await expect(editor).toBeVisible({ timeout: 15_000 });
		await editor.click();
		await page.keyboard.type(`Body of ${title}`);
		await expect(page.locator('input[name="body"]')).toHaveValue(/Body of/, {
			timeout: 5_000,
		});
		await page.getByRole("radio", { name: /^Public/ }).check();
		await page.getByRole("button", { name: "Publish" }).click();
		await expect(page).toHaveURL(/\/articles\/?$/, { timeout: 15_000 });
		await expect(
			page.locator('[data-review-status="in_review"]'),
		).toBeVisible();
	} finally {
		await ctx.close();
	}
	const article = getArticleByTitle(title);
	if (!article) throw new Error("article not saved");
	const url = `/${REGION}/city/articles/${article.id}`;
	expect((await guestPage.goto(url))?.status()).toBe(404);
	await guestPage.goto(`/${REGION}/city`);
	await expect(guestPage.getByText(title)).toHaveCount(0);

	const coord = await pageAs(browser, coordinator);
	try {
		// The reviewer may preview it before deciding.
		await coord.page.goto(url);
		await expect(coord.page.locator("h1")).toHaveText(title, {
			timeout: 15_000,
		});
		await decide(coord.page, `core:article:${article.id}`, "Approve");
	} finally {
		await coord.ctx.close();
	}
	await expect
		.poll(async () => (await guestPage.goto(url))?.status(), {
			timeout: 20_000,
		})
		.toBe(200);
	await expect(guestPage.locator("h1")).toHaveText(title);
});
