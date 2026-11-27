/**
 * Birth periods: people give the period they were born in (e.g. 1990–1994), never their year
 * of birth. The period length (5 or 10 years) is a site setting (`BIRTH_PERIOD_YEARS` in
 * src/env.ts); only the first year of the period is stored, and a stored value is always read
 * at the current length, so changing 5 to 10 keeps every answer. Client-safe (no env).
 */
export type BirthPeriodYears = 5 | 10;

/** First year of the period `year` falls in. */
export function birthPeriodStart(year: number, size: BirthPeriodYears): number {
	return Math.floor(year / size) * size;
}

/** "1990–1994" (5 years) or "1990–1999" (10 years). */
export function birthPeriodLabel(
	start: number,
	size: BirthPeriodYears,
): string {
	const first = birthPeriodStart(start, size);
	return `${first}–${first + size - 1}`;
}

/** The periods to choose from, youngest first, covering the last 100 years. */
export function birthPeriodOptions(
	size: BirthPeriodYears,
	now: Date = new Date(),
): Array<{ value: number; label: string }> {
	const newest = birthPeriodStart(now.getUTCFullYear(), size);
	const options: Array<{ value: number; label: string }> = [];
	for (let start = newest; start > newest - 100; start -= size)
		options.push({ value: start, label: birthPeriodLabel(start, size) });
	return options;
}

/** Is `value` the first year of one of the offered periods? (Server-side validation.) */
export function isBirthPeriod(
	value: number,
	size: BirthPeriodYears,
	now: Date = new Date(),
): boolean {
	return birthPeriodOptions(size, now).some((o) => o.value === value);
}
