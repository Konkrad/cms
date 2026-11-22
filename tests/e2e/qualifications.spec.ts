/**
 * E2E tests for the Qualifications feature:
 *  - Unauthenticated access to admin page redirects to login
 *  - Non-admin cannot access admin qualification pages
 *  - Admin sees a pending claim in the qualifications list
 *  - Approving it in core's Reviews queue grants the tag and tier
 *  - Rejecting it there keeps the reviewer's comment on the claim
 */

import {
	createQualificationInDb,
	createQualificationTokenInDb,
	createQualificationTypeInDb,
	createScopeInDb,
	createUserSession,
	decideInReviewQueue,
	deleteScopeById,
	expect,
	grantScopeRole,
	openDb,
	requireModules,
	test,
} from "../fixtures";

// Module spec: skipped while the module is inactive (CI also runs the suite with none).
requireModules("qualifications");

async function loginAs(page: import("@playwright/test").Page, token: string) {
	await page.context().addCookies([
		{
			name: "session",
			value: token,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Strict",
		},
	]);
}

test("redirects /admin/root/qualifications to /login for guests", async ({
	guestPage: page,
}) => {
	await page.goto("/admin/root/qualifications");
	await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

test("non-admin gets 403 on the admin qualifications page", async ({
	guestPage: page,
}) => {
	const session = createUserSession("user");
	try {
		await loginAs(page, session.sessionToken);
		const res = await page.goto("/admin/root/qualifications");
		expect(res?.status()).toBe(403);
	} finally {
		session.cleanup();
	}
});

test("admin sees a pending qualification in the queue", async ({
	guestPage: page,
}) => {
	const admin = createUserSession("admin");
	const applicant = createUserSession("user");
	const { typeId, cleanup: tc } = createQualificationTypeInDb({
		label: "Test PhD Qualification",
	});
	const { qualId, cleanup: qc } = createQualificationInDb(
		applicant.userId,
		typeId,
		"pending",
	);
	try {
		await loginAs(page, admin.sessionToken);
		await page.goto("/admin/root/qualifications");
		await expect(page.locator("text=Test PhD Qualification")).toBeVisible({
			timeout: 10_000,
		});
	} finally {
		qc();
		tc();
		admin.cleanup();
		applicant.cleanup();
	}
});

test("admin approves a claim in the Reviews queue → tag and tier are granted", async ({
	guestPage: page,
}) => {
	const admin = createUserSession("admin");
	const applicant = createUserSession("user");
	const slug = `e2e-qual-${Date.now()}`;
	const { typeId, cleanup: tc } = createQualificationTypeInDb({
		label: "E2E Approve Test",
		slug,
		grantsMembershipTier: "associated",
	});
	const { qualId, cleanup: qc } = createQualificationInDb(
		applicant.userId,
		typeId,
		"pending",
	);
	try {
		await loginAs(page, admin.sessionToken);
		// The pending claim links to the queue, where it is decided.
		await page.goto("/admin/root/qualifications");
		const row = page
			.locator("tr", { has: page.locator("text=E2E Approve Test") })
			.first();
		await expect(row.getByRole("link", { name: "Review" })).toBeVisible({
			timeout: 10_000,
		});
		await decideInReviewQueue(
			page,
			"/admin/root",
			`qualifications:claim:${qualId}`,
			"approve",
		);

		// The handler runs on the next scheduler tick.
		await expect
			.poll(
				() => {
					const db = openDb();
					const tag = db
						.prepare("SELECT 1 FROM user_tags WHERE user_id = ? AND slug = ?")
						.get(applicant.userId, slug);
					db.close();
					return !!tag;
				},
				{ timeout: 15_000 },
			)
			.toBe(true);
	} finally {
		const db = openDb();
		db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(applicant.userId);
		db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(
			applicant.userId,
		);
		db.close();
		qc();
		tc();
		admin.cleanup();
		applicant.cleanup();
	}
});

test("admin rejects a claim in the Reviews queue → the comment is kept on the claim", async ({
	guestPage: page,
}) => {
	const admin = createUserSession("admin");
	const applicant = createUserSession("user");
	const { typeId, cleanup: tc } = createQualificationTypeInDb({
		label: "E2E Reject Test",
	});
	const { qualId, cleanup: qc } = createQualificationInDb(
		applicant.userId,
		typeId,
		"pending",
	);
	try {
		await loginAs(page, admin.sessionToken);
		await decideInReviewQueue(
			page,
			"/admin/root",
			`qualifications:claim:${qualId}`,
			"reject",
			"Not yet eligible",
		);

		await expect
			.poll(
				() => {
					const db = openDb();
					const qual = db
						.prepare(
							"SELECT status, notes FROM user_qualifications WHERE id = ?",
						)
						.get(qualId) as { status: string; notes: string | null };
					db.close();
					return `${qual.status}: ${qual.notes}`;
				},
				{ timeout: 15_000 },
			)
			.toBe("rejected: Not yet eligible");
	} finally {
		qc();
		tc();
		admin.cleanup();
		applicant.cleanup();
	}
});

test("group-scoped admin URL does not render the qualifications admin UI", async ({
	guestPage: page,
}) => {
	const admin = createUserSession("admin");
	const slug = `qual-scope-${Date.now()}`;
	const groupId = createScopeInDb({
		parentPath: "/",
		slug,
		name: "Qualifications Scope Group",
	}).id;
	grantScopeRole(admin.userId, groupId, "representative");
	const { typeId, cleanup: tc } = createQualificationTypeInDb({
		label: "Scoped Hidden Type",
	});
	try {
		await loginAs(page, admin.sessionToken);
		// Qualifications is a root-only section: 404 on any other scope.
		const res = await page.goto(`/admin/${slug}/qualifications`);
		expect(res?.status()).toBe(404);
		await expect(page.getByText("Scoped Hidden Type")).toHaveCount(0);
	} finally {
		tc();
		try {
			deleteScopeById(groupId);
		} catch {}
		admin.cleanup();
	}
});

test("verify page works at the root and under a scope prefix", async ({
	guestPage: page,
}) => {
	const suffix = Date.now().toString(36);
	const region = `e2e-qual-region-${suffix}`;
	const chapter = `e2e-qual-chapter-${suffix}`;
	const regionId = createScopeInDb({ parentPath: "/", slug: region }).id;
	const chapterId = createScopeInDb({
		parentPath: `/${region}/`,
		slug: chapter,
	}).id;
	const admin = createUserSession("admin");
	const member = createUserSession("user");
	const { typeId, cleanup: tc } = createQualificationTypeInDb({
		label: "Scoped Verify Type",
		slug: `scoped-verify-${suffix}`,
	});
	const { token, cleanup: tokc } = createQualificationTokenInDb(
		typeId,
		admin.userId,
	);
	try {
		await loginAs(page, member.sessionToken);
		const res = await page.goto(
			`/${region}/${chapter}/qualifications/verify/${token}`,
		);
		expect(res?.status()).toBe(200);
		await expect(page.locator("h1")).toHaveText("Qualification Verified!");

		// Redeeming again at the root resolves to the same page, now already verified
		await page.goto(`/qualifications/verify/${token}`);
		await expect(page.locator("h1")).toHaveText("Already Verified");
	} finally {
		const db = openDb();
		db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(member.userId);
		db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(
			member.userId,
		);
		db.close();
		tokc();
		tc();
		admin.cleanup();
		member.cleanup();
		deleteScopeById(chapterId);
		deleteScopeById(regionId);
	}
});
