/**
 * URL slugs for items (spec 4.3: `/germany/berlin/events/summer-bbq-2026`). Pure.
 */

/** "Summer BBQ 2026!" → "summer-bbq-2026"; "" when nothing usable is left. */
export function slugify(text: string, maxLength = 60): string {
	return text
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/ß/g, "ss")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength)
		.replace(/-+$/g, "");
}

/** `base`, or `base-2`, `base-3`, … : the first that `isTaken` rejects. */
export async function uniqueSlug(
	base: string,
	isTaken: (slug: string) => boolean | Promise<boolean>,
): Promise<string> {
	let candidate = base;
	for (let n = 2; await isTaken(candidate); n++) candidate = `${base}-${n}`;
	return candidate;
}
