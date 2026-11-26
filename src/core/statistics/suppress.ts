/**
 * Statistics never show a group small enough to point at a person: a count between 1 and
 * `MIN_GROUP_SIZE - 1` is hidden (null, shown as "fewer than 5"). When exactly one group of a
 * breakdown would be hidden, the next smallest is hidden too, so the hidden one cannot be worked
 * out from the total. Client-safe.
 */
export const MIN_GROUP_SIZE = 5;

/** One group of a breakdown: a key the page turns into a label, and its count (null = hidden). */
export interface StatBucket {
	key: string;
	count: number | null;
}

export function suppressSmall(
	buckets: ReadonlyArray<{ key: string; count: number }>,
	min: number = MIN_GROUP_SIZE,
): StatBucket[] {
	const small = (n: number) => n > 0 && n < min;
	const hidden = new Set(
		buckets.filter((b) => small(b.count)).map((b) => b.key),
	);
	if (hidden.size === 1) {
		const next = buckets
			.filter((b) => b.count > 0 && !hidden.has(b.key))
			.sort((a, b) => a.count - b.count)[0];
		if (next) hidden.add(next.key);
	}
	return buckets.map((b) => ({
		key: b.key,
		count: hidden.has(b.key) ? null : b.count,
	}));
}

/** A single headline figure: hidden when it is between 1 and `min - 1`. */
export function suppressCount(
	count: number,
	min: number = MIN_GROUP_SIZE,
): number | null {
	return count > 0 && count < min ? null : count;
}

/** A module's breakdown of a group of people (`PeopleBreakdown`), small groups hidden. */
export interface PeopleBreakdownResult {
	id: string;
	title: string;
	rows: Array<{ label: string; count: number | null }>;
}
