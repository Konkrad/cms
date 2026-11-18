/**
 * The global requirements gate and the setup flow (spec 4.6): a logged-in user with a pending
 * `global` requirement (profile basics, location, the onboarding survey while an onboarding form
 * is active) is sent to /profile/setup, completes one step at a time, and lands on the page they
 * asked for.
 */
import type { Page } from "@playwright/test";
import {
	createTestUser,
	deleteUserByEmail,
	expect,
	GLOBAL_REQUIREMENTS,
	getUserById,
	getUserRequirement,
	setActiveOnboardingForm,
	setRequirementVersion,
	test,
} from "../fixtures";
import { extractAllLinks, waitForEmailHtml } from "../utils/mailpit-client";

function uniqueEmail(prefix = "setup") {
	return `${prefix}+${Date.now()}@example.com`;
}

async function signInViaMagicLink(page: Page, email: string, since?: Date) {
	await page.goto("/login");
	await page.locator('input[type="email"]').fill(email);
	await page.click('button[type="submit"]');
	const html = await waitForEmailHtml(email, 30000, since);
	const links = extractAllLinks(html).filter((l) => l.includes("/auth/verify"));
	if (!links.length) throw new Error("No magic link found");
	await page.goto(links[0]);
	await page.waitForLoadState("networkidle");
}

async function loginAs(page: Page, sessionToken: string) {
	await page.context().addCookies([
		{
			name: "session",
			value: sessionToken,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Strict",
		},
	]);
}

const step = (page: Page, id: string) =>
	page.locator(`[data-testid="requirement-step"][data-requirement="${id}"]`);

async function continueStep(page: Page, id: string) {
	const form = step(page, id);
	await form.locator('button[type="submit"]').click();
	await expect(form).toBeHidden({ timeout: 15000 });
}

test.describe("global gate", () => {
	test("a new user is sent to /profile/setup after login", async ({ page }) => {
		const email = uniqueEmail("new");
		try {
			await signInViaMagicLink(page, email);
			await expect(page).toHaveURL(/\/profile\/setup/, { timeout: 10000 });
			await expect(step(page, "core.profile")).toBeVisible();
		} finally {
			deleteUserByEmail(email);
		}
	});

	test("a user who completed every global requirement is not gated", async ({
		page,
	}) => {
		const session = createTestUser({ completed: GLOBAL_REQUIREMENTS });
		try {
			await loginAs(page, session.sessionToken);
			await page.goto("/");
			await expect(page).toHaveURL("/");
			await page.goto("/jobs");
			await expect(page).toHaveURL(/\/jobs/);
		} finally {
			session.cleanup();
		}
	});

	test("bumping a requirement's version gates the user again", async ({
		page,
	}) => {
		const session = createTestUser({ completed: GLOBAL_REQUIREMENTS });
		try {
			await loginAs(page, session.sessionToken);
			await page.goto("/");
			await expect(page).toHaveURL("/");

			// As if core.location went from version 0 to its current version.
			setRequirementVersion(session.userId, "core.location", 0);
			await page.goto("/");
			await expect(page).toHaveURL(/\/profile\/setup/);
			await expect(step(page, "core.location")).toBeVisible();
			await expect(step(page, "core.profile")).toHaveCount(0);
		} finally {
			session.cleanup();
		}
	});
});

test.describe("setup flow", () => {
	test("profile, location and onboarding survey, then the page asked for", async ({
		page,
	}) => {
		const session = createTestUser();
		try {
			await loginAs(page, session.sessionToken);
			await page.goto("/jobs");
			await expect(page).toHaveURL(/\/profile\/setup\/?\?next=%2Fjobs/);
			await expect(page.locator("text=3 steps left")).toBeVisible();

			// Profile basics: validated on the server (a blank name is refused).
			const profile = step(page, "core.profile");
			await profile.locator("input[name='name']").fill("   ");
			await profile.locator("input[name='familyName']").fill("Smith");
			await profile.locator('button[type="submit"]').click();
			await expect(profile.locator("text=First name is required")).toBeVisible({
				timeout: 15000,
			});
			await profile.locator("input[name='name']").fill("Alice");
			await profile.locator("input[name='yearOfBirth']").fill("1990");
			await continueStep(page, "core.profile");

			// Location: confirming without a geocoded address is allowed.
			await expect(step(page, "core.location")).toBeVisible();
			await continueStep(page, "core.location");

			// The onboarding survey (the active core.onboarding form of the test seed).
			const survey = step(page, "core.onboarding");
			await expect(survey).toBeVisible();
			await survey
				.locator('input[name="answers.status"][value="graduate"]')
				.check();
			await survey
				.locator('select[name="answers.faculty"]')
				.selectOption("science");
			await survey
				.locator('input[name="answers.degree_level"][value="master"]')
				.check();
			await survey.locator('button[type="submit"]').click();

			await expect(page).toHaveURL(/\/jobs/, { timeout: 15000 });
			expect(getUserById(session.userId)).toMatchObject({
				name: "Alice",
				family_name: "Smith",
				year_of_birth: 1990,
			});
			for (const id of GLOBAL_REQUIREMENTS)
				expect(getUserRequirement(session.userId, id)?.version).toBe(1);

			// Done: the gate lets the user through.
			await page.goto("/");
			await expect(page).toHaveURL("/");
		} finally {
			session.cleanup();
		}
	});

	test("the onboarding survey step appears only while an onboarding form is active", async ({
		page,
	}) => {
		const session = createTestUser({
			completed: ["core.profile", "core.location"],
		});
		const previous = setActiveOnboardingForm(null);
		try {
			expect(previous).not.toBeNull();
			await loginAs(page, session.sessionToken);
			await page.goto("/");
			await expect(page).toHaveURL("/");

			setActiveOnboardingForm(previous);
			await page.goto("/");
			await expect(page).toHaveURL(/\/profile\/setup/);
			await expect(step(page, "core.onboarding")).toBeVisible();
		} finally {
			setActiveOnboardingForm(previous);
			session.cleanup();
		}
	});

	test("/profile/setup with nothing pending goes on to next", async ({
		page,
	}) => {
		const session = createTestUser({ completed: GLOBAL_REQUIREMENTS });
		try {
			await loginAs(page, session.sessionToken);
			await page.goto("/profile/setup?next=%2Fjobs");
			await expect(page).toHaveURL(/\/jobs/);
			// Never to another site.
			await page.goto("/profile/setup?next=%2F%2Fexample.com");
			await expect(page).toHaveURL("/");
		} finally {
			session.cleanup();
		}
	});
});
