/**
 * UI strings and locale formatting (spec 4.8): `t("<namespace>.<key>", params?)` with the
 * site's catalog (`SITE_LOCALE`, English fallback), and `formatDate` / `formatNumber` /
 * `formatCurrency` / `formatMoney` in the site locale. Client-safe: works in components on the
 * server and in the browser. Modules get it from `~/core` / `~/core/ui`, the theme from
 * `~/contracts/i18n`.
 */
import { catalog } from "./catalog";
import { createFormatters } from "./format";
import type { MessageKey } from "./keys";
import { INTL_LOCALES, type Locale } from "./locales";
import { createTranslator, type TranslateParams } from "./translate";

export type { DateFormat, DateInput } from "./format";
export type { MessageKey } from "./keys";
export type { Locale } from "./locales";
export type { TranslateParams } from "./translate";

/** The site's UI language (`SITE_LOCALE`), also `<html lang>`. */
export const siteLocale: Locale = catalog.locale;
/** The `Intl` locale dates, numbers and money are formatted with. */
export const intlLocale: string = INTL_LOCALES[siteLocale];

const translate = createTranslator({
	intlLocale,
	messages: catalog.messages,
	onMissing: (key) => {
		if (import.meta.env?.DEV) {
			console.warn(`[i18n] missing message key "${key}"`);
		}
	},
});

/**
 * The UI string `key` in the site locale with `{name}` placeholders filled from `params`;
 * `params.count` picks the plural form (`<key>_one` / `<key>_other`).
 */
export function t(key: MessageKey, params?: TranslateParams): string {
	return translate(key, params);
}

export const { formatDate, formatNumber, formatCurrency, formatMoney } =
	createFormatters(intlLocale);
