/**
 * Hierarchical scope URLs: plugin@scope matches the longest scope prefix and
 * rewrites the remainder into Qwik's normal file routing.
 *
 * Server-rendered pages and no-JS form posts work under a prefix. Client-side
 * flows do NOT: Qwik Router resolves the route for SPA navigations and JS
 * <Form> submissions in the browser against the build-time route trie, so a
 * prefixed URL resolves to the [...slug] catch-all there. Those tests are
 * marked test.fail() as a standing proof of the limitation.
 */

import type { Browser, Page } from "@playwright/test";
import {
	createJobInDb,
	createScopeInDb,
	createUserSession,
	deleteJobById,
	deleteScopeById,
	expect,
	getJobById,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const REGION = `e2e-region-${suffix}`;
const CHAPTER = `e2e-chapter-${suffix}`;
const PREFIX = `/${REGION}/${CHAPTER}`;
const SCOPE_PATH = `${PREFIX}/`;

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

async function memberContext(browser: Browser, javaScriptEnabled = true) {
	const session = createUserSession("user");
	const ctx = await browser.newContext({ javaScriptEnabled });
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
	const page = await ctx.newPage();
	return {
		page,
		session,
		async close() {
			await ctx.close();
			session.cleanup();
		},
	};
}

const scopeOf = (page: Page) => page.locator("main").getAttribute("data-scope");

test.describe("Scope routing — server rendering", () => {
	test("prefixed /jobs renders the jobs route with the chapter scope", async ({
		memberPage: page,
	}) => {
		await page.goto("/jobs");
		await expect(page.locator("h1")).toHaveText("Job Board");
		expect(await scopeOf(page)).toBe("/");

		const res = await page.goto(`${PREFIX}/jobs`);
		expect(res?.status()).toBe(200);
		await expect(page).toHaveURL(`${PREFIX}/jobs`);
		await expect(page.locator("h1")).toHaveText("Job Board");
		expect(await scopeOf(page)).toBe(SCOPE_PATH);
	});

	test("bare scope prefix renders the home page", async ({
		guestPage: page,
	}) => {
		await page.goto("/");
		const homeHeading = await page.locator("h1").first().textContent();

		const res = await page.goto(PREFIX);
		expect(res?.status()).toBe(200);
		await expect(page.locator("h1").first()).toHaveText(homeHeading ?? "");
		expect(await scopeOf(page)).toBe(SCOPE_PATH);
	});

	test("unknown remainder falls through to the page route's 404", async ({
		guestPage: page,
	}) => {
		const res = await page.goto(`${PREFIX}/some-unknown-page`);
		expect(res?.status()).toBe(404);
		await expect(page.locator("h1").first()).toHaveText("Page Not Found");
		expect(await scopeOf(page)).toBe(SCOPE_PATH);
	});
});

test.describe("Scope routing — form actions", () => {
	test("route action works under the prefix without JavaScript", async ({
		browser,
	}) => {
		const m = await memberContext(browser, false);
		const { jobId } = createJobInDb({
			suggestedBy: m.session.userId,
			title: "Scoped NoJS Delete",
		});
		try {
			await m.page.goto(`${PREFIX}/jobs/mine`);
			const row = m.page.locator("tr", { hasText: "Scoped NoJS Delete" });
			await expect(row).toBeVisible();
			// Plain HTML form post to ?qaction=… relative to the prefixed URL.
			await row.locator("button:has-text('Delete')").click();

			await expect(m.page).toHaveURL(
				new RegExp(`^[^?]*${PREFIX}/jobs/mine\\?qaction=`),
			);
			await expect(m.page.locator("h1")).toHaveText("My Job Submissions");
			expect(await scopeOf(m.page)).toBe(SCOPE_PATH);
			await expect(row).toHaveCount(0);
			expect(getJobById(jobId)).toBeUndefined();
		} finally {
			deleteJobById(jobId);
			await m.close();
		}
	});

	test("JS <Form> submission under the prefix keeps the page", async ({
		browser,
	}) => {
		// Known failure: the action itself runs (job deleted server-side), but the
		// client then resolves /prefix/jobs/mine to [...slug] and renders PageView.
		test.fail();
		const m = await memberContext(browser);
		const { jobId } = createJobInDb({
			suggestedBy: m.session.userId,
			title: "Scoped JS Delete",
		});
		try {
			await m.page.goto(`${PREFIX}/jobs/mine`);
			await m.page.waitForLoadState("networkidle");
			m.page.on("dialog", (d) => d.accept());
			const row = m.page.locator("tr", { hasText: "Scoped JS Delete" });
			// After the action, the client refetches loaders for the page it resolved.
			const refetch = m.page.waitForResponse((r) =>
				new URL(r.url()).pathname.startsWith(`${PREFIX}/jobs/mine/q-loader-`),
			);
			await row.locator("button:has-text('Delete')").click();
			await expect.poll(() => getJobById(jobId)).toBeUndefined();
			await refetch;
			// Let the post-action render settle before asserting the final page.
			await m.page.waitForTimeout(1_000);
			await expect(m.page.locator("h1").first()).toHaveText(
				"My Job Submissions",
			);
		} finally {
			deleteJobById(jobId);
			await m.close();
		}
	});
});

test.describe("Scope routing — client-side navigation", () => {
	async function navigateBackToPrefixedJobs(browser: Browser) {
		const m = await memberContext(browser);
		const job = createJobInDb({
			suggestedBy: m.session.userId,
			title: "Scoped Nav Job",
			status: "approved",
		});
		await m.page.goto(`${PREFIX}/jobs`);
		await m.page.waitForLoadState("networkidle");
		// Qwik <Link> → SPA navigation to the job detail page.
		await m.page.locator(`a[href="/jobs/${job.jobId}"]`).click();
		await expect(m.page.locator("h1").first()).toHaveText("Scoped Nav Job");
		// Back is a same-document popstate, so Qwik navigates client-side to the
		// prefixed URL and fetches its loader JSON from under the prefix.
		const loaderJson = m.page.waitForResponse((r) =>
			new URL(r.url()).pathname.startsWith(`${PREFIX}/jobs/q-loader-`),
		);
		await m.page.goBack();
		return {
			page: m.page,
			loaderJson: await loaderJson,
			async close() {
				job.cleanup();
				await m.close();
			},
		};
	}

	test("loader JSON under the prefix is served through the rewrite", async ({
		browser,
	}) => {
		const nav = await navigateBackToPrefixedJobs(browser);
		try {
			expect(nav.loaderJson.status()).toBe(200);
			await expect(nav.page).toHaveURL(`${PREFIX}/jobs`);
			// The layout's scope loader is refetched for the prefixed page URL.
			await expect.poll(() => scopeOf(nav.page)).toBe(SCOPE_PATH);
		} finally {
			await nav.close();
		}
	});

	test("SPA navigation to a prefixed URL renders the rewritten route", async ({
		browser,
	}) => {
		// Known failure: the browser matches /prefix/jobs to [...slug] and renders
		// PageView (the home page content) instead of the Job Board.
		test.fail();
		const nav = await navigateBackToPrefixedJobs(browser);
		try {
			await expect(nav.page.locator("h1").first()).toHaveText("Job Board", {
				timeout: 5_000,
			});
		} finally {
			await nav.close();
		}
	});
});
