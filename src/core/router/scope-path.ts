export const SCOPE_SLUG_RE = /^(?!-)(?!.*-$)[a-z0-9-]{1,63}$/;

/** Path of a child scope: childPath("/germany/", "berlin") = "/germany/berlin/". */
export function childPath(parentPath: string, slug: string): string {
	return `${parentPath}${slug}/`;
}

/**
 * Split a pathname into the longest matching scope path (whole segments) and the rest.
 * Expects a pathname without query string.
 */
export function splitScopePath(
	pathname: string,
	scopePaths: ReadonlySet<string>,
): { scopePath: string; rest: string } {
	const segments = pathname.split("/").filter(Boolean);
	for (let n = segments.length; n > 0; n--) {
		const candidate = `/${segments.slice(0, n).join("/")}/`;
		if (scopePaths.has(candidate)) {
			const rest = segments.slice(n);
			return {
				scopePath: candidate,
				rest: rest.length ? `/${rest.join("/")}` : "/",
			};
		}
	}
	return {
		scopePath: "/",
		rest: segments.length ? `/${segments.join("/")}` : "/",
	};
}

/** Public URL for a sub path within a scope: scopeUrl("/germany/", "/events") = "/germany/events". */
export function scopeUrl(scopePath: string, subPath = "/"): string {
	const base = scopePath.replace(/\/+$/, "");
	const sub = subPath.replace(/^\/+/, "");
	if (!sub) return base || "/";
	return `${base}/${sub}`;
}

/** True when `a` is an ancestor of `b` or the same scope (prefix match on scope paths). */
export function isAncestorPath(a: string, b: string): boolean {
	return b.startsWith(a);
}

/** Admin URL segment of the root scope: `/admin/root/...`. */
export const ROOT_ADMIN_SEGMENT = "root";

/**
 * The single `[scope]` segment of an admin URL: the dotted slug path of the scope,
 * "root" for the root. adminSegment("/germany/berlin/") = "germany.berlin". Slugs never
 * contain dots (SCOPE_SLUG_RE), and "root" is a reserved slug, so the mapping is one to one.
 */
export function adminSegment(scopePath: string): string {
	const segments = scopePath.split("/").filter(Boolean);
	return segments.length ? segments.join(".") : ROOT_ADMIN_SEGMENT;
}

/** Inverse of `adminSegment`: "germany.berlin" = "/germany/berlin/"; null when malformed. */
export function pathFromAdminSegment(segment: string): string | null {
	if (segment === ROOT_ADMIN_SEGMENT) return "/";
	const slugs = segment.split(".");
	if (!slugs.every((s) => SCOPE_SLUG_RE.test(s))) return null;
	return `/${slugs.join("/")}/`;
}

/** Admin URL of a scope: adminUrl("/germany/", "/events") = "/admin/germany/events". */
export function adminUrl(scopePath: string, subPath = "/"): string {
	return scopeUrl(`/admin/${adminSegment(scopePath)}/`, subPath);
}
