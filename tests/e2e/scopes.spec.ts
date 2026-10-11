/**
 * Groups are scopes: a region with two chapters, created per run (independent of the seeds).
 * Public: the scope home page at the scope path, joining, members-only content flowing to the
 * members of the scopes below. Admin: /admin/[scope] for representatives (own chapter only)
 * and root admins (create child scopes, grant roles).
 */
import type { Browser } from "@playwright/test";
import {
	addScopeMember,
	adminSegmentOf,
	createArticleInDb,
	createRedirectInDb,
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deleteScopeById,
	expect,
	getScopeByPath,
	getScopeRoles,
	grantScopeRole,
	isScopeMember,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const REGION = `e2e-reg-${suffix}`;
const CHAPTER_A = `e2e-cha-${suffix}`;
const CHAPTER_B = `e2e-chb-${suffix}`;
const URL_A = `/${REGION}/${CHAPTER_A}`;
const SEG_REGION = REGION;
const SEG_A = `${REGION}.${CHAPTER_A}`;
const SEG_B = `${REGION}.${CHAPTER_B}`;

let region: ReturnType<typeof createScopeInDb>;
let chapterA: ReturnType<typeof createScopeInDb>;
let chapterB: ReturnType<typeof createScopeInDb>;
let fillerMembers: ReturnType<typeof createUserSession>[] = [];
let rep: ReturnType<typeof createUserSession>;

test.beforeAll(() => {
	region = createScopeInDb({
		parentPath: "/",
		slug: REGION,
		name: "E2E Region",
		kind: "region",
	});
	chapterA = createScopeInDb({
		parentPath: region.path,
		slug: CHAPTER_A,
		name: "E2E Chapter A",
		kind: "chapter",
	});
	chapterB = createScopeInDb({
		parentPath: region.path,
		slug: CHAPTER_B,
		name: "E2E Chapter B",
		kind: "chapter",
	});
	// >= 5 members so the "See All Members" CTA renders (ParticipantsTile `hasEnough`).
	fillerMembers = Array.from({ length: 4 }, () => createUserSession("user"));
	for (const m of fillerMembers) addScopeMember(m.userId, chapterA.id);
	rep = createUserSession("user", "e2e-rep", {
		name: "Repre",
		familyName: `Sentative${suffix}`,
	});
	addScopeMember(rep.userId, chapterA.id);
	grantScopeRole(rep.userId, chapterA.id, "representative");
});

test.afterAll(() => {
	deleteScopeById(region.id);
	for (const m of [...fillerMembers, rep]) m.cleanup();
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

test.describe("Scope home page", () => {
	test("renders at /region/chapter with members, rep and join CTA", async ({
		guestPage: page,
	}) => {
		const res = await page.goto(URL_A);
		expect(res?.status()).toBe(200);
		await expect(page.locator("h1").first()).toHaveText("E2E Chapter A");
		await expect(page.locator("text=Community Members")).toBeVisible();
		await expect(page.locator(`text=Local Rep E2E Chapter A`)).toBeVisible();
		await expect(page.locator("text=Join This Group").first()).toBeVisible();
		// Breadcrumb back to the region.
		await expect(
			page.getByRole("link", { name: "E2E Region", exact: true }),
		).toHaveAttribute("href", `/${REGION}`);
	});

	test("the region's page lists its chapters", async ({ guestPage: page }) => {
		await page.goto(`/${REGION}`);
		await expect(page.locator("h1").first()).toHaveText("E2E Region");
		await expect(page.locator(`a[href='${URL_A}']`).first()).toBeVisible();
		await expect(
			page.locator(`a[href='/${REGION}/${CHAPTER_B}']`).first(),
		).toBeVisible();
	});

	test("lists the chapter's upcoming events, members-only ones for members only", async ({
		guestPage,
		browser,
	}) => {
		const upcoming = createScopeEventInDb({
			organizerId: rep.userId,
			title: "Scope Page Public Event",
			scopeId: chapterA.id,
		});
		const secret = createScopeEventInDb({
			organizerId: rep.userId,
			title: "Scope Page Members Event",
			scopeId: chapterA.id,
			visibility: "members",
		});
		const past = createScopeEventInDb({
			organizerId: rep.userId,
			title: "Scope Page Past Event",
			scopeId: chapterA.id,
			past: true,
		});
		try {
			await guestPage.goto(URL_A);
			await expect(
				guestPage.locator("text=Scope Page Public Event"),
			).toBeVisible();
			await expect(
				guestPage.locator("text=Scope Page Members Event"),
			).toHaveCount(0);
			await expect(guestPage.locator("text=Scope Page Past Event")).toHaveCount(
				0,
			);

			const { ctx, page } = await pageAs(browser, fillerMembers[0]);
			await page.goto(URL_A);
			await expect(page.locator("text=Scope Page Members Event")).toBeVisible();
			await ctx.close();
		} finally {
			for (const e of [upcoming, secret, past]) e.cleanup();
		}
	});

	test("a logged-in user can join the chapter", async ({ browser }) => {
		const joiner = createUserSession("user");
		const { ctx, page } = await pageAs(browser, joiner);
		try {
			await page.goto(URL_A);
			await page.locator('button:has-text("Join This Group")').first().click();
			await expect
				.poll(() => isScopeMember(joiner.userId, chapterA.id))
				.toBe(true);
		} finally {
			await ctx.close();
			joiner.cleanup();
		}
	});

	test("old /groups/<slug> URLs redirect to the scope path", async ({
		guestPage: page,
	}) => {
		// Legacy group URLs are rows of the redirects table (migrated and seeded).
		const cleanup = createRedirectInDb(`/groups/${CHAPTER_A}`, URL_A);
		try {
			const response = await page.request.get(`/groups/${CHAPTER_A}`, {
				maxRedirects: 0,
			});
			expect(response.status()).toBe(301);
			await page.goto(`/groups/${CHAPTER_A}`);
			await expect(page).toHaveURL(URL_A);
		} finally {
			cleanup();
		}
	});
});

test.describe("Members-only content flows down", () => {
	test("a member of a chapter sees the region's members-only article", async ({
		browser,
	}) => {
		const author = createUserSession("user");
		const outsider = createUserSession("user");
		const articleId = createArticleInDb({
			title: `Region members only ${suffix}`,
			body: "<p>For the whole region</p>",
			userId: author.userId,
			scopeId: region.id,
			visibility: "members",
		});
		try {
			// fillerMembers[0] joined chapter A only; membership counts upward to the region.
			const member = await pageAs(browser, fillerMembers[0]);
			const ok = await member.page.goto(`/articles/${articleId}`);
			expect(ok?.status()).toBe(200);
			await expect(
				member.page.locator(`text=Region members only ${suffix}`).first(),
			).toBeVisible();
			await member.ctx.close();

			const other = await pageAs(browser, outsider);
			const denied = await other.page.goto(`/articles/${articleId}`);
			expect(denied?.status()).toBe(404);
			expect(await other.page.content()).not.toContain(
				`Region members only ${suffix}`,
			);
			await other.ctx.close();
		} finally {
			author.cleanup();
			outsider.cleanup();
		}
	});
});

test.describe("Scope admin — representatives", () => {
	test("a representative manages their chapter but gets 403 on a sibling", async ({
		browser,
	}) => {
		const { ctx, page } = await pageAs(browser, rep);
		try {
			const own = await page.goto(`/admin/${SEG_A}`);
			expect(own?.status()).toBe(200);
			await expect(page.locator("h1")).toHaveText("E2E Chapter A Admin");
			const nav = page.locator("nav.overflow-x-auto");
			await expect(nav.getByRole("link", { name: "Members" })).toBeVisible();
			// No users view and no system sections below the root.
			await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);

			const members = await page.goto(`/admin/${SEG_A}/members`);
			expect(members?.status()).toBe(200);
			await expect(page.locator('[data-testid="members"]')).toContainText(
				`Repre Sentative${suffix}`,
			);

			for (const url of [
				`/admin/${SEG_B}`,
				`/admin/${SEG_B}/members`,
				`/admin/${SEG_REGION}`,
				"/admin/root",
				"/admin/root/users",
			]) {
				const res = await page.goto(url);
				expect(res?.status(), url).toBe(403);
			}
			// A root-only section opened on the chapter is not there at all.
			const users = await page.goto(`/admin/${SEG_A}/users`);
			expect(users?.status()).toBe(404);

			// /admin lands on the representative's chapter.
			await page.goto("/admin");
			await expect(page).toHaveURL(new RegExp(`/admin/${SEG_A}$`));
		} finally {
			await ctx.close();
		}
	});

	test("a representative can grant only the representative role", async ({
		browser,
	}) => {
		const { ctx, page } = await pageAs(browser, rep);
		try {
			await page.goto(`/admin/${SEG_A}/members?q=Repre`);
			const options = await page
				.locator('[data-testid="search-results"] select[name="role"]')
				.first()
				.locator("option")
				.allTextContents();
			expect(options).toEqual(["representative"]);
		} finally {
			await ctx.close();
		}
	});
});

test.describe("Scope admin — root admin", () => {
	test("creates a child scope and grants a role on it", async ({
		adminPage: page,
	}) => {
		const slug = `e2e-new-${suffix}`;
		const grantee = createUserSession("user", "e2e-grantee", {
			name: "Grantee",
			familyName: `Person${suffix}`,
		});
		try {
			await page.goto(`/admin/${SEG_REGION}/scope`);
			await page.locator("#child-kind").selectOption("chapter");
			await page.locator('input[name="name"]').last().fill("E2E New Chapter");
			await page.locator('input[name="slug"]').fill(slug);
			await page.getByRole("button", { name: "Create group" }).click();
			const segment = adminSegmentOf(`${region.path}${slug}/`);
			await expect(page).toHaveURL(new RegExp(`/admin/${segment}/scope$`));
			const created = getScopeByPath(`${region.path}${slug}/`);
			expect(created?.name).toBe("E2E New Chapter");

			await page.goto(`/admin/${segment}/members?q=Grantee`);
			const row = page
				.locator('[data-testid="search-results"] li')
				.filter({ hasText: `Grantee Person${suffix}` });
			await row.locator('select[name="role"]').selectOption("moderator");
			await row.getByRole("button", { name: "Grant role" }).click();
			await expect
				.poll(() => getScopeRoles(grantee.userId, created?.id ?? ""))
				.toEqual(["moderator"]);
			await expect(page.locator('[data-testid="role-holders"]')).toContainText(
				`Grantee Person${suffix}`,
			);

			// The new chapter page is public right away.
			const res = await page.goto(`${region.path}${slug}`);
			expect(res?.status()).toBe(200);
		} finally {
			grantee.cleanup();
			const created = getScopeByPath(`${region.path}${slug}/`);
			if (created) deleteScopeById(created.id);
		}
	});

	test("rejects a reserved slug", async ({ adminPage: page }) => {
		await page.goto(`/admin/${SEG_REGION}/scope`);
		await page.locator('input[name="name"]').last().fill("Events");
		await page.locator('input[name="slug"]').fill("events");
		await page.getByRole("button", { name: "Create group" }).click();
		await expect(page.locator("text=is reserved")).toBeVisible();
		expect(getScopeByPath(`${region.path}events/`)).toBeUndefined();
	});

	test("the scope switcher lists the scopes a region admin manages", async ({
		browser,
	}) => {
		const regionAdmin = createUserSession("user");
		grantScopeRole(regionAdmin.userId, region.id, "admin");
		const { ctx, page } = await pageAs(browser, regionAdmin);
		try {
			await page.goto(`/admin/${SEG_REGION}`);
			const switcher = page.locator('[data-testid="scope-switcher"]');
			await switcher.locator("summary").click();
			await expect(switcher.getByRole("link")).toHaveText([
				/E2E Region/,
				/E2E Chapter A/,
				/E2E Chapter B/,
			]);
			const res = await page.goto(`/admin/${SEG_B}`);
			expect(res?.status()).toBe(200);
		} finally {
			await ctx.close();
			regionAdmin.cleanup();
		}
	});
});
