/**
 * The public job pages must not serialize the author's private user fields
 * (email, loginId, requirement answers …) into the page state, and members may only delete
 * their own PENDING jobs.
 */

import {
	createJobInDb,
	createUserSession,
	expect,
	getUserById,
	getUserEmailById,
	test,
} from "../fixtures";

test("job list and detail do not leak the author's private fields", async ({
	memberPage: page,
}) => {
	// A private requirement answer with a recognisable value (spec 4.6).
	const answerMarker = `answer-marker-${Date.now()}`;
	const author = createUserSession("user", "e2e-author", undefined, {
		values: { "events.foodPreference": { foodPreference: answerMarker } },
	});
	const email = getUserEmailById(author.userId) ?? "";
	const loginId = String(getUserById(author.userId)?.login_id ?? "");
	const job = createJobInDb({
		suggestedBy: author.userId,
		title: "Privacy Job",
		status: "approved",
	});
	try {
		expect(email).not.toBe("");
		expect(loginId).not.toBe("");

		for (const url of ["/jobs", `/jobs/${job.jobId}`]) {
			await page.goto(url);
			await expect(page.locator("text=Privacy Job").first()).toBeVisible();
			const html = await page.content();
			expect(html, url).not.toContain(email);
			expect(html, url).not.toContain(loginId);
			expect(html, url).not.toContain(answerMarker);
		}
	} finally {
		job.cleanup();
		author.cleanup();
	}
});

test("approved jobs have no Delete button in /jobs/mine", async ({
	browser,
}) => {
	const session = createUserSession("user");
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
	const approved = createJobInDb({
		suggestedBy: session.userId,
		title: "Approved Keep",
		status: "approved",
	});
	const pending = createJobInDb({
		suggestedBy: session.userId,
		title: "Pending Deletable",
	});
	try {
		const page = await ctx.newPage();
		await page.goto("/jobs/mine");
		const approvedRow = page.locator("tr", { hasText: "Approved Keep" });
		const pendingRow = page.locator("tr", { hasText: "Pending Deletable" });
		await expect(approvedRow).toBeVisible();
		await expect(approvedRow.locator("button:has-text('Delete')")).toHaveCount(
			0,
		);
		await expect(pendingRow.locator("button:has-text('Delete')")).toHaveCount(
			1,
		);
	} finally {
		approved.cleanup();
		pending.cleanup();
		await ctx.close();
		session.cleanup();
	}
});
