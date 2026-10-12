/** An amount in minor units (cents) with its currency, e.g. `formatMoney(1250, "eur")` = "€12.50". */
export function formatMoney(minor: number, currency: string): string {
	return new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(minor / 100);
}
