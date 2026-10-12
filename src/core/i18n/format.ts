/** Date, number and money formatting in a locale (`Intl`); `./index.ts` binds them to the site locale. */

export type DateInput = Date | string | number;

/** Named date formats; pass `Intl.DateTimeFormatOptions` for anything else. */
export const DATE_FORMATS = {
	/** 12 Oct 2026 */
	date: { day: "numeric", month: "short", year: "numeric" },
	/** 12 October 2026 */
	dateLong: { day: "numeric", month: "long", year: "numeric" },
	/** Monday, 12 October 2026 */
	weekdayDate: {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	},
	/** 12 Oct 2026, 14:30 */
	dateTime: { dateStyle: "medium", timeStyle: "short" },
	/** Monday, 12 October 2026 at 14:30 */
	weekdayDateTime: { dateStyle: "full", timeStyle: "short" },
	/** 12 Oct, 14:30 */
	shortDateTime: {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	},
	/** 12 October */
	dayMonth: { day: "numeric", month: "long" },
	/** 14:30 */
	time: { hour: "2-digit", minute: "2-digit" },
	/** 12 */
	day: { day: "numeric" },
	/** October */
	month: { month: "long" },
	/** Oct */
	monthShort: { month: "short" },
	/** 2026 */
	year: { year: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateFormat = keyof typeof DATE_FORMATS;

export function createFormatters(intlLocale: string) {
	const formatDate = (
		value: DateInput,
		format: DateFormat | Intl.DateTimeFormatOptions = "date",
	): string =>
		new Intl.DateTimeFormat(
			intlLocale,
			typeof format === "string" ? DATE_FORMATS[format] : format,
		).format(new Date(value));

	const formatNumber = (
		value: number,
		options?: Intl.NumberFormatOptions,
	): string => new Intl.NumberFormat(intlLocale, options).format(value);

	/** An amount in major units (12.5 = €12.50) in an ISO 4217 currency (`"eur"` or `"EUR"`). */
	const formatCurrency = (
		amount: number,
		currency: string,
		options?: Intl.NumberFormatOptions,
	): string =>
		new Intl.NumberFormat(intlLocale, {
			style: "currency",
			currency: currency.toUpperCase(),
			...options,
		}).format(amount);

	/** An amount in minor units (cents), as payments store it: `formatMoney(1250, "eur")`. */
	const formatMoney = (minor: number, currency: string): string =>
		formatCurrency(minor / 100, currency);

	return { formatDate, formatNumber, formatCurrency, formatMoney };
}
