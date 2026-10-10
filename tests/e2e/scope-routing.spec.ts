/**
 * Hierarchical scope URLs: plugin@scope splits off the longest scope prefix and
 * the catch-all route ([...path]) resolves the module page from the remainder.
 * Because the browser's route table also resolves every such URL to the
 * catch-all, SPA navigation and JS <Form> submissions work under a prefix too.
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
			await expect(row).toHaveCount(0);
			await expect(m.page).toHaveURL(`${PREFIX}/jobs/mine`);
			expect(await scopeOf(m.page)).toBe(SCOPE_PATH);
		} finally {
			deleteJobById(jobId);
			await m.close();
		}
	});
});

/** Marks the document so a later check can tell SPA navigation from a full load. */
async function markDocument(page: Page) {
	await page.evaluate(() => {
		(window as unknown as { __spa: boolean }).__spa = true;
	});
}
const stillSameDocument = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __spa?: boolean }).__spa === true,
	);

test.describe("Scope routing — client-side navigation", () => {
	test("SPA navigation from /jobs to a job and back at the root", async ({
		browser,
	}) => {
		const m = await memberContext(browser);
		const job = createJobInDb({
			suggestedBy: m.session.userId,
			title: "Root Nav Job",
			status: "approved",
		});
		try {
			await m.page.goto("/jobs");
			await m.page.waitForLoadState("networkidle");
			await markDocument(m.page);
			await m.page.locator(`a[href="/jobs/${job.jobId}"]`).click();
			await expect(m.page).toHaveURL(`/jobs/${job.jobId}`);
			await expect(m.page.locator("h1").first()).toHaveText("Root Nav Job");
			await m.page.goBack();
			await expect(m.page.locator("h1").first()).toHaveText("Job Board");
			expect(await stillSameDocument(m.page)).toBe(true);
			expect(await scopeOf(m.page)).toBe("/");
		} finally {
			job.cleanup();
			await m.close();
		}
	});

	test("SPA Link navigation and back under the prefix", async ({ browser }) => {
		const m = await memberContext(browser);
		const job = createJobInDb({
			suggestedBy: m.session.userId,
			title: "Scoped Nav Job",
			status: "approved",
		});
		try {
			await m.page.goto(`${PREFIX}/jobs`);
			await m.page.waitForLoadState("networkidle");
			await markDocument(m.page);
			// Qwik <Link> → SPA navigation to the job detail page.
			await m.page.locator(`a[href="/jobs/${job.jobId}"]`).click();
			await expect(m.page.locator("h1").first()).toHaveText("Scoped Nav Job");
			// Back is a same-document popstate: Qwik navigates client-side to the
			// prefixed URL and fetches the catch-all's loader JSON under the prefix.
			const loaderJson = m.page.waitForResponse((r) =>
				new URL(r.url()).pathname.startsWith(`${PREFIX}/jobs/q-loader-`),
			);
			await m.page.goBack();
			expect((await loaderJson).status()).toBe(200);
			await expect(m.page).toHaveURL(`${PREFIX}/jobs`);
			await expect(m.page.locator("h1").first()).toHaveText("Job Board");
			await expect.poll(() => scopeOf(m.page)).toBe(SCOPE_PATH);
			expect(await stillSameDocument(m.page)).toBe(true);
		} finally {
			job.cleanup();
			await m.close();
		}
	});
});
