/**
 * Forms (spec 4.10): a form with answers is locked (its questions can no longer be edited) and
 * Duplicate makes an editable copy; the active form per purpose is picked per scope; an
 * organiser fills in an event's debrief (the active events.debrief form) on its Review tab.
 */
import type { Browser } from "@playwright/test";
import {
	createFormInDb,
	createFormResultInDb,
	createScopeEventInDb,
	createScopeInDb,
	createUserSession,
	deleteFormsByTitle,
	deleteScopeById,
	expect,
	getFormResultsBySubject,
	getFormsByTitle,
	getOutboxRows,
	grantScopeRole,
	setEventDebriefRequested,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const LOCKED = `Locked survey ${suffix}`;
const PROPOSAL = `Region proposal ${suffix}`;

let region: ReturnType<typeof createScopeInDb>;
let chapter: ReturnType<typeof createScopeInDb>;
let rep: ReturnType<typeof createUserSession>;
let coordinator: ReturnType<typeof createUserSession>;
const cleanups: Array<() => void> = [];

test.beforeAll(() => {
	region = createScopeInDb({
		parentPath: "/",
		slug: `e2e-fm-${suffix}`,
		name: "Forms Region",
		kind: "region",
	});
	chapter = createScopeInDb({
		parentPath: region.path,
		slug: "town",
		name: "Forms Town",
		kind: "chapter",
	});
	rep = createUserSession("user", "fm-rep", { name: "Ole", familyName: "Org" });
	grantScopeRole(rep.userId, chapter.id, "representative");
	coordinator = createUserSession("user", "fm-coord");
	grantScopeRole(coordinator.userId, region.id, "coordinator");
});

test.afterAll(() => {
	for (const c of cleanups) c();
	deleteFormsByTitle(LOCKED);
	deleteFormsByTitle(`${LOCKED} (copy)`);
	deleteFormsByTitle(PROPOSAL);
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

test("a form with answers is locked; Duplicate makes an editable copy", async ({
	adminPage: page,
}) => {
	const { formId } = createFormInDb({ title: LOCKED });
	createFormResultInDb(formId);

	await page.goto(`/admin/root/forms/${formId}/edit`);
	await expect(page.getByTestId("form-locked")).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.locator('select[name="builderMode"]')).toHaveCount(0);

	await page.goto("/admin/root/forms");
	const row = page.locator(`tr[data-form-id="${formId}"]`);
	await expect(row).toContainText("(locked)", { timeout: 15_000 });
	await row.getByRole("button", { name: "Duplicate" }).click();
	await expect(page).toHaveURL(/\/admin\/root\/forms\/[^/]+\/edit\/?$/, {
		timeout: 15_000,
	});
	const [copy] = getFormsByTitle(`${LOCKED} (copy)`);
	expect(copy).toBeTruthy();
	expect(page.url()).toContain(copy.id);
	await expect(page.getByTestId("form-locked")).toHaveCount(0);
	await expect(page.locator('select[name="builderMode"]')).toBeVisible();
});

test("a scope picks its own active form for a purpose", async ({
	adminPage: page,
}) => {
	const { formId } = createFormInDb({
		title: PROPOSAL,
		scopeId: region.id,
		purpose: "events.proposal",
	});
	await page.goto(`/admin/${region.segment}/forms`);
	const row = page.locator('[data-purpose="events.proposal"]');
	await expect(row).toBeVisible({ timeout: 15_000 });
	// Until it picks one, the region inherits the root's.
	await expect(row.locator("select option:checked")).toContainText("Inherited");
	await row.locator("select").selectOption(formId);
	await row.getByRole("button", { name: "Save" }).click();
	await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
	await page.reload();
	await expect(
		page.locator('[data-purpose="events.proposal"] select option:checked'),
	).toHaveText(PROPOSAL, { timeout: 15_000 });
});

test("the organiser fills in the debrief of an event that ended; the reviewer is told", async ({
	browser,
}) => {
	const event = createScopeEventInDb({
		organizerId: rep.userId,
		title: `Ended meetup ${suffix}`,
		slug: `ended-${suffix}`,
		scopeId: chapter.id,
		past: true,
	});
	cleanups.push(event.cleanup);
	setEventDebriefRequested(event.eventId);
	const ref = `events:event:${event.eventId}`;

	const { ctx, page } = await pageAs(browser, rep);
	try {
		await page.goto(
			`/admin/${region.segment}.town/events/${event.eventId}/review`,
		);
		const form = page.getByTestId("event-debrief");
		await expect(form).toBeVisible({ timeout: 15_000 });
		await form.getByLabel("How many people came?").fill("25");
		await form.locator('[data-question="rating"]').getByLabel("4").check();
		await form.getByLabel("What went well?").fill("Great <b>talks</b>");
		await form.getByRole("button", { name: "Submit debrief" }).click();
		await expect(
			page.getByText("Thank you: the debrief was saved."),
		).toBeVisible({ timeout: 15_000 });
		await page.reload();
		const results = page.getByTestId("event-form-results");
		await expect(results).toContainText("Event debrief", { timeout: 15_000 });
		// Free text is shown as text, never as HTML.
		await expect(results).toContainText("Great <b>talks</b>");
		await expect(page.getByTestId("event-debrief")).toHaveCount(0);
	} finally {
		await ctx.close();
	}
	const [result] = getFormResultsBySubject(ref);
	expect(result.answers).toMatchObject({ attendance: 25, rating: 4 });
	await expect
		.poll(
			() =>
				getOutboxRows({
					notificationId: "events.debrief-submitted",
					recipientUserId: coordinator.userId,
				}).length,
		)
		.toBe(1);
});
