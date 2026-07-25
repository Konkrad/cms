import { env } from "~/env";

/** Builds an absolute canonical URL from a site-relative pathname. */
export function canonicalUrl(pathname: string): string {
	return new URL(pathname, env.APP_URL).toString();
}

/** Strips HTML tags and collapses whitespace, then truncates to a meta-description-friendly length. */
export function htmlToDescription(
	html: string | null | undefined,
	maxLength = 155,
): string {
	const text = (html ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
