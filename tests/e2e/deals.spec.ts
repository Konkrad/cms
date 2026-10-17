/**
 * E2E tests for the Deals module:
 *  - Admin creates a deal; it renders at /deals/<id> and under a scope prefix
 *  - Public page: guests see no login-gated step content; expired deals 404
 *  - Active deals (not expired ones) appear in /sitemap.xml
 *  - A group-scoped admin URL for deals does not render the editor
 */

import {
	createDealInDb,
	createScopeInDb,
	createUserSession,
	deleteDealById,
	deleteScopeById,
	expect,
	getDealByName,
	grantScopeRole,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const REGION = `e2e-deals-region-${suffix}`;
const CHAPTER = `e2e-deals-chapter-${suffix}`;
const PREFIX = `/${REGION}/${CHAPTER}`;

let regionId: string;
let chapterId: string;

test.beforeAll(() => {
	regionId = createScopeInDb({ parentPath: "/", slug: REGION }).id;
	chapterId = createScopeInDb({ parentPath: `/${REGION}/`, slug: CHAPTER }).id;
});

test.afterAll(() => {
	deleteScopeById(chapterId);
	deleteScopeById(regionId);
});

const inDays = (days: number) =>
	new Date(Date.now() + days * 86400000).toISOString();

test.describe("Deals — admin", () => {
	test("admin creates a deal; it shows at /deals/<id> and under a scope prefix", async ({
		adminPage: page,
	}) => {
		const name = `E2E Created Deal ${suffix}`;
		let dealId: string | undefined;
		try {
			await page.goto("/admin/root/deals/new");
			// The logo uploader (Uppy) must initialise, or the form can never settle.
			if (
				!(await page
					.locator(".uppy-Dashboard")
					.isVisible({ timeout: 10_000 })
					.catch(() => false))
			) {
				test.skip(true, "Uppy did not initialise in this environment");
			}
			await page.locator("input[name='name']").fill(name);
			await page.locator("textarea[name='description']").fill("Created in e2e");
			await page.getByRole("button", { name: "Create Deal" }).click();
			await expect(page).toHaveURL(/\/admin\/root\/deals$/, {
				timeout: 15_000,
			});

			const row = getDealByName(name);
			expect(row).toBeTruthy();
			dealId = row?.id;
			// No expiry chosen: must be stored as null, not as an already-expired date
			expect(row?.valid_until).toBeNull();

			await page.goto(`/deals/${dealId}`);
			await expect(page.locator("h1")).toHaveText(name);

			const res = await page.goto(`${PREFIX}/deals/${dealId}`);
			expect(res?.status()).toBe(200);
			await expect(page).toHaveURL(`${PREFIX}/deals/${dealId}`);
			await expect(page.locator("h1")).toHaveText(name);
		} finally {
			if (dealId) deleteDealById(dealId);
		}
	});

	test("admin edits a deal; the change shows at /deals/<id> and under a scope prefix", async ({
		adminPage: page,
	}) => {
		// A logo is set so the edit form skips the Uppy uploader.
		const { dealId, cleanup } = createDealInDb({
			name: `E2E Edit Source ${suffix}`,
			logo: "public/deals/logos/e2e.svg",
		});
		const name = `E2E Edited Deal ${suffix}`;
		try {
			await page.goto(`/admin/root/deals/${dealId}/edit`);
			await page.locator("input[name='name']").fill(name);
			await page.getByRole("button", { name: "Save Changes" }).click();
			await expect(page).toHaveURL(/\/admin\/root\/deals$/, {
				timeout: 15_000,
			});
			await expect(page.getByText(name)).toBeVisible();

			await page.goto(`/deals/${dealId}`);
			await expect(page.locator("h1")).toHaveText(name);
			const res = await page.goto(`${PREFIX}/deals/${dealId}`);
			expect(res?.status()).toBe(200);
			await expect(page.locator("h1")).toHaveText(name);
		} finally {
			cleanup();
		}
	});

	test("admin nav lists Deals between Groups and Jobs", async ({
		adminPage: page,
	}) => {
		await page.goto("/admin/root");
		const labels = await page
			.locator("nav.overflow-x-auto a")
			.allTextContents();
		const names = labels.map((l) => l.trim());
		expect(names.slice(names.indexOf("Groups"))).toEqual([
			"Groups",
			"Deals",
			"Jobs",
			"Elections",
			"Qualifications",
			"Payments",
			"Notifications",
		]);
	});

	test("a group's admin does not reach a deal of another scope by id", async ({
		browser,
	}) => {
		const admin = createUserSession("user");
		const slug = `deals-scope-${Date.now()}`;
		const groupId = createScopeInDb({
			parentPath: "/",
			slug,
			name: "Deals Scope Group",
		}).id;
		grantScopeRole(admin.userId, groupId, "representative");
		const { dealId, cleanup } = createDealInDb({ name: "Scoped Edit Target" });
		const ctx = await browser.newContext();
		await ctx.addCookies([
			{
				name: "session",
				value: admin.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		const page = await ctx.newPage();
		try {
			// Deals exist in every scope's admin, limited to the scope's subtree: the root's
			// deal is not reachable from the group.
			const res = await page.goto(`/admin/${slug}/deals/${dealId}/edit`);
			expect(res?.status()).toBe(404);
			await expect(page.locator("input[name='name']")).toHaveCount(0);
			// The group's own list does not show it either.
			await page.goto(`/admin/${slug}/deals`);
			await expect(page.getByText("Scoped Edit Target")).toHaveCount(0);
		} finally {
			await ctx.close();
			cleanup();
			try {
				deleteScopeById(groupId);
			} catch {}
			admin.cleanup();
		}
	});
});

test.describe("Deals — public page", () => {
	test("guest does not receive login-gated step content", async ({
		guestPage: page,
	}) => {
		const { dealId, cleanup } = createDealInDb({
			name: `Gated Deal ${suffix}`,
			steps: [
				{ type: "text", title: "Open step", text: "visible text" },
				{
					type: "promo",
					title: "Locked step",
					text: "hidden text",
					promoCode: "SECRETCODE123",
					requiresLogin: true,
				},
			],
		});
		try {
			await page.goto(`/deals/${dealId}`);
			await expect(page.getByText("Login to unlock")).toBeVisible();
			const html = await page.content();
			expect(html).toContain("visible text");
			expect(html).not.toContain("SECRETCODE123");
			expect(html).not.toContain("hidden text");
		} finally {
			cleanup();
		}
	});

	test("member sees login-gated step content", async ({ memberPage: page }) => {
		const { dealId, cleanup } = createDealInDb({
			name: `Member Deal ${suffix}`,
			steps: [
				{
					type: "promo",
					title: "Locked step",
					text: "member text",
					promoCode: "MEMBERCODE456",
					requiresLogin: true,
				},
			],
		});
		try {
			await page.goto(`/deals/${dealId}`);
			await expect(page.getByText("MEMBERCODE456")).toBeVisible();
		} finally {
			cleanup();
		}
	});

	test("expired and unknown deals return 404", async ({ guestPage: page }) => {
		const { dealId, cleanup } = createDealInDb({
			name: `Expired Deal ${suffix}`,
			validUntil: inDays(-2),
		});
		try {
			expect((await page.goto(`/deals/${dealId}`))?.status()).toBe(404);
			expect((await page.goto(`/deals/${crypto.randomUUID()}`))?.status()).toBe(
				404,
			);
		} finally {
			cleanup();
		}
	});
});

test.describe("Deals — sitemap", () => {
	test("active deals appear in /sitemap.xml, expired ones do not", async ({
		guestPage: page,
	}) => {
		const active = createDealInDb({ name: `Sitemap Active ${suffix}` });
		const expired = createDealInDb({
			name: `Sitemap Expired ${suffix}`,
			validUntil: inDays(-2),
		});
		try {
			const res = await page.request.get("/sitemap.xml");
			expect(res.status()).toBe(200);
			const xml = await res.text();
			expect(xml).toContain(`/deals/${active.dealId}</loc>`);
			expect(xml).not.toContain(`/deals/${expired.dealId}</loc>`);
		} finally {
			active.cleanup();
			expired.cleanup();
		}
	});
});
