/**
 * Content by scope (spec 4.2/4.3): content flows down from a region to its chapters (labelled
 * with its source) and public content flows up; members-only content stays with members; CMS
 * pages live under their scope's path; moving a scope answers 301 for its old URLs; a
 * representative manages their own chapter's jobs and events but not a sibling's.
 */
import type { Browser } from "@playwright/test";
import {
	addScopeMember,
	createJobInDb,
	createPageInDb,
	createPostInDb,
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deletePageAndMenuItems,
	deletePostByTitle,
	deleteScopeById,
	expect,
	getScopeByPath,
	grantScopeRole,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const REGION = `e2e-flow-${suffix}`;
const CHAPTER_A = `e2e-fla-${suffix}`;
const CHAPTER_B = `e2e-flb-${suffix}`;
const URL_REGION = `/${REGION}`;
const URL_A = `/${REGION}/${CHAPTER_A}`;
const SEG_A = `${REGION}.${CHAPTER_A}`;

let region: ReturnType<typeof createScopeInDb>;
let chapterA: ReturnType<typeof createScopeInDb>;
let chapterB: ReturnType<typeof createScopeInDb>;
let author: ReturnType<typeof createUserSession>;
const cleanups: Array<() => void> = [];

test.beforeAll(() => {
	region = createScopeInDb({
		parentPath: "/",
		slug: REGION,
		name: "Flow Region",
		kind: "region",
	});
	chapterA = createScopeInDb({
		parentPath: region.path,
		slug: CHAPTER_A,
		name: "Flow Chapter A",
		kind: "chapter",
	});
	chapterB = createScopeInDb({
		parentPath: region.path,
		slug: CHAPTER_B,
		name: "Flow Chapter B",
		kind: "chapter",
	});
	author = createUserSession("user");
});

test.afterAll(() => {
	for (const c of cleanups.splice(0).reverse()) c();
	deleteScopeById(region.id);
	author.cleanup();
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

test.describe("Content flows between levels", () => {
	test("a region's public post shows on its chapter's page, labelled with the region", async ({
		guestPage: page,
	}) => {
		const title = `Region news ${suffix}`;
		cleanups.push(() => deletePostByTitle(title));
		createPostInDb({
			title,
			body: "<p>For every chapter of the region</p>",
			userId: author.userId,
			scopeId: region.id,
			visibility: "public",
		});
		await page.goto(URL_A);
		const card = page.locator("a", { hasText: title });
		await expect(card).toBeVisible();
		// The source label names the owning scope.
		await expect(card).toContainText("Flow Region");
	});

	test("a chapter's public post flows up to the region, a sibling's members-only post does not", async ({
		guestPage: page,
	}) => {
		const up = `Chapter B public ${suffix}`;
		const hidden = `Chapter B members ${suffix}`;
		cleanups.push(
			() => deletePostByTitle(up),
			() => deletePostByTitle(hidden),
		);
		createPostInDb({
			title: up,
			body: "<p>public</p>",
			userId: author.userId,
			scopeId: chapterB.id,
			visibility: "public",
		});
		createPostInDb({
			title: hidden,
			body: "<p>members</p>",
			userId: author.userId,
			scopeId: chapterB.id,
			visibility: "members",
		});
		await page.goto(URL_REGION);
		await expect(page.locator("a", { hasText: up })).toBeVisible();
		await expect(page.locator("a", { hasText: hidden })).toHaveCount(0);
		// Siblings never see each other's content.
		await page.goto(URL_A);
		await expect(page.locator("a", { hasText: up })).toHaveCount(0);
	});

	test("members-only content of a region is hidden from guests and outsiders, shown to members below", async ({
		browser,
		guestPage,
	}) => {
		const title = `Region members-only ${suffix}`;
		cleanups.push(() => deletePostByTitle(title));
		createPostInDb({
			title,
			body: "<p>members of the region</p>",
			userId: author.userId,
			scopeId: region.id,
			visibility: "members",
		});
		const event = createScopeEventInDb({
			organizerId: author.userId,
			title: `Region members event ${suffix}`,
			scopeId: region.id,
			visibility: "members",
		});
		cleanups.push(event.cleanup);

		await guestPage.goto(URL_A);
		await expect(guestPage.locator("a", { hasText: title })).toHaveCount(0);
		// The event teaser (three soonest events) is checked on the region's own page, where
		// earlier public events of the root cannot crowd it out.
		await guestPage.goto(URL_REGION);
		await expect(
			guestPage.locator("a", { hasText: `Region members event ${suffix}` }),
		).toHaveCount(0);

		const outsider = createUserSession("user");
		const member = createUserSession("user");
		cleanups.push(outsider.cleanup, member.cleanup);
		addScopeMember(member.userId, chapterA.id);

		const o = await pageAs(browser, outsider);
		try {
			await o.page.goto(URL_A);
			await expect(o.page.locator("a", { hasText: title })).toHaveCount(0);
		} finally {
			await o.ctx.close();
		}
		const m = await pageAs(browser, member);
		try {
			await m.page.goto(URL_A);
			await expect(m.page.locator("a", { hasText: title })).toBeVisible();
			await m.page.goto(URL_REGION);
			await expect(
				m.page.locator("a", { hasText: `Region members event ${suffix}` }),
			).toBeVisible();
		} finally {
			await m.ctx.close();
		}
	});
});

test.describe("CMS pages per scope", () => {
	test("a chapter's page is served under the chapter's path only", async ({
		guestPage: page,
	}) => {
		const { pageId } = createPageInDb({
			title: `Chapter visit ${suffix}`,
			url: "/visit",
			menuName: "main",
			status: "published",
			scopeId: chapterA.id,
		});
		cleanups.push(() => deletePageAndMenuItems(pageId));
		const res = await page.goto(`${URL_A}/visit`);
		expect(res?.status()).toBe(200);
		await expect(page.locator("h1")).toContainText(`Chapter visit ${suffix}`);
		expect((await page.goto(`/${REGION}/${CHAPTER_B}/visit`))?.status()).toBe(
			404,
		);
	});

	test("a representative creates a page in their chapter's admin", async ({
		browser,
	}) => {
		const rep = createUserSession("user");
		cleanups.push(rep.cleanup);
		grantScopeRole(rep.userId, chapterA.id, "representative");
		const { ctx, page } = await pageAs(browser, rep);
		try {
			await page.goto(`/admin/${SEG_A}/pages/new`);
			await page.locator('input[name="title"]').fill(`Rep page ${suffix}`);
			await page.locator('input[name="url"]').fill("/rep-page");
			await page.locator('select[name="status"]').selectOption("published");
			await page.locator('button[type="submit"]').click();
			await page.waitForURL(/\/pages\/.+\/builder/);
			const res = await page.goto(`${URL_A}/rep-page`);
			expect(res?.status()).toBe(200);
			await expect(page.locator("h1")).toContainText(`Rep page ${suffix}`);

			// The region's admin (and so its pages) is closed to a chapter representative.
			expect((await page.goto(`/admin/${REGION}/pages/new`))?.status()).toBe(
				403,
			);
		} finally {
			await ctx.close();
		}
	});
});

test.describe("Page and scope slugs never collide", () => {
	test("a page cannot take a child group's slug", async ({
		adminPage: page,
	}) => {
		await page.goto(`/admin/${REGION}/pages/new`);
		await page.locator('input[name="title"]').fill("Shadowed");
		await page.locator('input[name="url"]').fill(`/${CHAPTER_A}`);
		await page.locator('button[type="submit"]').click();
		await expect(
			page.getByText(`A group called "${CHAPTER_A}" already exists here`),
		).toBeVisible();
	});
});

test.describe("Moving a scope", () => {
	test("old URLs answer 301 to the new path", async ({ adminPage: page }) => {
		const other = createScopeInDb({
			parentPath: "/",
			slug: `e2e-dest-${suffix}`,
			name: "Destination",
			kind: "region",
		});
		const mover = createScopeInDb({
			parentPath: region.path,
			slug: `e2e-mover-${suffix}`,
			name: "Mover",
			kind: "chapter",
		});
		cleanups.push(() => deleteScopeById(other.id));
		const oldUrl = `/${REGION}/e2e-mover-${suffix}`;
		const newUrl = `/e2e-dest-${suffix}/e2e-mover-${suffix}`;

		await page.goto(`/admin/${mover.segment}/scope`);
		await page
			.locator('select[name="parentId"]')
			.selectOption({ label: other.path });
		await page.getByRole("button", { name: "Move group" }).click();
		await expect(page).toHaveURL(
			new RegExp(`/admin/e2e-dest-${suffix}.e2e-mover-${suffix}/scope$`),
		);
		expect(getScopeByPath(`${newUrl}/`)?.id).toBe(mover.id);

		const res = await page.request.get(`${oldUrl}/jobs`, { maxRedirects: 0 });
		expect(res.status()).toBe(301);
		expect(res.headers().location).toBe(`${newUrl}/jobs`);
		await page.goto(oldUrl);
		await expect(page).toHaveURL(newUrl);
	});
});

test.describe("Representatives manage their own scope only", () => {
	test("a chapter representative manages the chapter's jobs and events, not a sibling's", async ({
		browser,
	}) => {
		const rep = createUserSession("user");
		cleanups.push(rep.cleanup);
		grantScopeRole(rep.userId, chapterA.id, "representative");
		const ownJob = createJobInDb({
			suggestedBy: author.userId,
			title: `Job of A ${suffix}`,
			scopeId: chapterA.id,
		});
		const siblingJob = createJobInDb({
			suggestedBy: author.userId,
			title: `Job of B ${suffix}`,
			scopeId: chapterB.id,
		});
		const ownEvent = createScopeEventInDb({
			organizerId: author.userId,
			title: `Event of A ${suffix}`,
			scopeId: chapterA.id,
		});
		const siblingEvent = createScopeEventInDb({
			organizerId: author.userId,
			title: `Event of B ${suffix}`,
			scopeId: chapterB.id,
		});
		cleanups.push(
			ownJob.cleanup,
			siblingJob.cleanup,
			ownEvent.cleanup,
			siblingEvent.cleanup,
		);

		const { ctx, page } = await pageAs(browser, rep);
		try {
			await page.goto(`/admin/${SEG_A}/jobs`);
			await expect(page.getByText(`Job of A ${suffix}`)).toBeVisible();
			await expect(page.getByText(`Job of B ${suffix}`)).toHaveCount(0);
			expect(
				(
					await page.goto(`/admin/${SEG_A}/jobs/${ownJob.jobId}/edit`)
				)?.status(),
			).toBe(200);
			expect(
				(
					await page.goto(`/admin/${SEG_A}/jobs/${siblingJob.jobId}/edit`)
				)?.status(),
			).toBe(404);

			await page.goto(`/admin/${SEG_A}/events`);
			await expect(page.getByText(`Event of A ${suffix}`)).toBeVisible();
			await expect(page.getByText(`Event of B ${suffix}`)).toHaveCount(0);
			const sibling = await page.goto(
				`/admin/${SEG_A}/events/${siblingEvent.eventId}/edit`,
			);
			expect([403, 404]).toContain(sibling?.status());
			// The sibling's own admin is closed to them.
			expect(
				(await page.goto(`/admin/${REGION}.${CHAPTER_B}/jobs`))?.status(),
			).toBe(403);
		} finally {
			await ctx.close();
		}
	});
});
