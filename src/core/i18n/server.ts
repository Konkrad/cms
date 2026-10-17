import { env } from "~/env";
import { siteLocale } from "./index";

/**
 * The catalog is merged into the bundle at build time (`cms:i18n`): a server started with
 * another `SITE_LOCALE` than its build would mix languages, so it refuses to start.
 */
export function assertBuiltSiteLocale(): void {
	if (siteLocale !== env.SITE_LOCALE) {
		throw new Error(
			`SITE_LOCALE is "${env.SITE_LOCALE}" but this build was made for "${siteLocale}"; rebuild with SITE_LOCALE=${env.SITE_LOCALE}.`,
		);
	}
}
