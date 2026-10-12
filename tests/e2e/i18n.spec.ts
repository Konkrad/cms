/**
 * UI language (spec 4.8): the site renders its catalogs in `SITE_LOCALE` (en by default, de
 * for German deployments) and `<html lang>` says which. The same tests run against either
 * build: they read the locale from `<html lang>` and expect that locale's strings. Run the
 * German variant with `SITE_LOCALE=de` (the build merges the catalog of that locale).
 */
import {
	createScopeEventInDb,
	createUserSession,
	expect,
	test,
} from "../fixtures";

const STRINGS = {
	en: {
		signIn: "Sign In",
		sendLink: "Send sign-in link & code",
		organizedBy: "Organized by",
		date: /\d{1,2} [A-Z][a-z]+ \d{4}/,
	},
	de: {
		signIn: "Anmelden",
		sendLink: "Anmeldelink & Code senden",
		organizedBy: "Organisiert von",
		date: /\d{1,2}\. [A-ZÄÖÜ][a-zäöü]+ \d{4}/,
	},
} as const;

type Locale = keyof typeof STRINGS;

async function siteLocale(page: import("@playwright/test").Page) {
	const lang = await page.locator("html").getAttribute("lang");
	expect(Object.keys(STRINGS)).toContain(lang);
	return lang as Locale;
}

test("the login page renders in the site locale", async ({
	guestPage: page,
}) => {
	await page.goto("/login");
	const locale = await siteLocale(page);
	const s = STRINGS[locale];
	await expect(page.locator("body")).toHaveAttribute("lang", locale);
	await expect(page.getByRole("heading", { name: s.signIn })).toBeVisible();
	await expect(page.getByRole("button", { name: s.sendLink })).toBeVisible();
});

test("an event page renders labels and dates in the site locale", async ({
	guestPage: page,
}) => {
	const organiser = createUserSession("user", "i18n-org");
	const slug = `i18n-${Date.now().toString(36)}`;
	const event = createScopeEventInDb({
		organizerId: organiser.userId,
		title: `Locale Meetup ${slug}`,
		slug,
	});
	try {
		await page.goto(`/events/${slug}`);
		const locale = await siteLocale(page);
		const s = STRINGS[locale];
		await expect(
			page.getByRole("heading", { name: `Locale Meetup ${slug}` }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: s.organizedBy }),
		).toBeVisible();
		await expect(page.locator("body")).toContainText(s.date);
	} finally {
		event.cleanup();
		organiser.cleanup();
	}
});
