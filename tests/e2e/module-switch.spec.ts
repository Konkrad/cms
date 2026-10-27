/**
 * Module activation (spec 4.1, 8.2): an inactive module's routes answer 404 and it adds nothing
 * to the navigation, the profile or the admin dashboard; an active one does. Runs in both CI
 * legs (all modules, none) and checks whichever state the modules are in.
 */
import { expect, isModuleActive, test } from "../fixtures";

test.describe("Module switch", () => {
	test("module pages answer 404 exactly while their module is inactive", async ({
		guestPage: page,
	}) => {
		for (const [module, path] of [
			["jobs", "/jobs"],
			["elections", "/elections"],
		] as const) {
			const res = await page.goto(path);
			if (isModuleActive(module)) expect(res?.status(), path).not.toBe(404);
			else expect(res?.status(), path).toBe(404);
		}
	});

	test("admin nav, dashboard and profile show the events module only while it is active", async ({
		adminPage: page,
	}) => {
		const active = isModuleActive("events");
		await page.goto("/admin/root");
		await expect(page.locator("h2").first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByTestId("dashboard-events")).toHaveCount(
			active ? 1 : 0,
		);
		await expect(
			page.locator('a[href="/admin/root/events"]').first(),
		).toHaveCount(active ? 1 : 0);
		const admin = await page.goto("/admin/root/events");
		expect(admin?.status()).toBe(active ? 200 : 404);

		await page.goto("/profile");
		await expect(page.locator("h1, h2").first()).toBeVisible({
			timeout: 15000,
		});
		await expect(page.getByTestId("profile-upcoming-events")).toHaveCount(
			active ? 1 : 0,
		);
		await expect(page.getByTestId("event-settings")).toHaveCount(
			active ? 1 : 0,
		);
	});
});
