import { createTestUser, expect, test } from "../fixtures";

test("a user with pending steps is sent to the setup flow", async ({
	browser,
}) => {
	const session = createTestUser();
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
		await page.goto("/", { waitUntil: "networkidle" });
		await expect(page).toHaveURL(/\/profile\/setup/);
		await expect(page.locator("h1")).toContainText("Complete your profile");
	} finally {
		await ctx.close();
		session.cleanup();
	}
});

test("/profile/setup sends a user with nothing pending home", async ({
	adminPage: page,
}) => {
	await page.goto("/profile/setup", { waitUntil: "networkidle" });
	await expect(page).toHaveURL("/");
});
