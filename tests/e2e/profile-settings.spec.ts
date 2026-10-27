/**
 * The `profile.settings` slot (spec 4.1/4.6): the events module's optional answers (food
 * preference, photo consent) can be changed on the own profile at any time, through core's
 * single requirement step action.
 */
import {
	createUserSession,
	expect,
	getUserRequirement,
	test,
} from "../fixtures";

test.describe("Profile settings (events requirements)", () => {
	test("a user changes food preference and photo consent on their profile", async ({
		browser,
	}) => {
		const session = createUserSession("user", "settings");
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
		const page = await ctx.newPage();
		try {
			await page.goto("/profile");
			const settings = page.getByTestId("event-settings");
			await expect(settings).toBeVisible({ timeout: 15000 });

			const food = settings.locator(
				'[data-requirement="events.foodPreference"]',
			);
			// Prefilled with the stored answer (seeded: no restrictions).
			await expect(food.locator('select[name="foodPreference"]')).toHaveValue(
				"none",
			);
			await food.locator('select[name="foodPreference"]').selectOption("vegan");
			await food.getByRole("button", { name: "Save" }).click();
			await expect
				.poll(
					() =>
						getUserRequirement(session.userId, "events.foodPreference")?.value,
				)
				.toEqual({ foodPreference: "vegan" });
			await expect(settings.getByText("Saved.")).toBeVisible();

			const consent = settings.locator(
				'[data-requirement="events.photoConsent"]',
			);
			await expect(
				consent.locator('input[name="photoConsentGiven"][value="true"]'),
			).toBeChecked();
			await consent
				.locator('input[name="photoConsentGiven"][value="false"]')
				.check();
			await consent.getByRole("button", { name: "Save" }).click();
			await expect
				.poll(
					() =>
						getUserRequirement(session.userId, "events.photoConsent")?.value,
				)
				.toEqual({ photoConsentGiven: false });

			// The changed answers are shown after a reload.
			await page.reload();
			await expect(
				page
					.getByTestId("event-settings")
					.locator('select[name="foodPreference"]'),
			).toHaveValue("vegan");
			await expect(
				page
					.getByTestId("event-settings")
					.locator('input[name="photoConsentGiven"][value="false"]'),
			).toBeChecked();
		} finally {
			await ctx.close();
			session.cleanup();
		}
	});
});
