/**
 * The theme's door to UI strings and locale formatting (spec 4.8): `t("theme.<key>")` reads
 * `theme/i18n/<locale>.json` (English fallback); dates, numbers and money in the site locale.
 * Client-safe; the catalog is merged at build time for `SITE_LOCALE`.
 */
export {
	type DateFormat,
	type DateInput,
	formatCurrency,
	formatDate,
	formatMoney,
	formatNumber,
	type MessageKey,
	siteLocale,
	type TranslateParams,
	t,
} from "~/core/i18n";
