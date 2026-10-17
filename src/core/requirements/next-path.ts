/** Where the setup flow may send a user afterwards: an internal path, never the flow itself. */
export function safeNextPath(raw: string | null | undefined): string {
	if (
		!raw ||
		!raw.startsWith("/") ||
		raw.startsWith("//") ||
		raw.includes("\\") ||
		raw.startsWith("/profile/setup")
	)
		return "/";
	return raw;
}
