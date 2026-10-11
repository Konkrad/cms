/**
 * Internal references (spec 4.3): the database never stores public URLs or slug paths that
 * point inside the site. It stores references built from immutable ids, and core turns them
 * into the current URL when rendering (`resolveRef`, `~/core/refs/resolve`).
 *
 * | Reference                  | Points to                       |
 * | `scope:<scopeId>`          | a scope's home page             |
 * | `scope:<scopeId>/<module>` | a module's listing in a scope   |
 * | `<module>:<type>:<id>`     | one item (`core:post:<id>`, `events:event:<id>`) |
 *
 * Where a field holds either a link or a reference (menu items, page-builder link fields,
 * `href`s in rich text, notification links), the reference is written as `ref:<reference>`.
 * Pure and client-safe.
 */

export type Ref =
	| { kind: "scope"; scopeId: string; module?: string }
	| { kind: "item"; module: string; type: string; id: string };

/** Prefix of a reference stored in a link field or an `href`. */
export const REF_SCHEME = "ref:";

/** The module id core uses for its own item types (`core:post:<id>`, `core:page:<id>`). */
export const CORE_REF_MODULE = "core";

// Ids are uuids or similar opaque tokens; module ids and types are lowercase words.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const NAME_RE = /^[a-z][a-z0-9-]{0,39}$/;

/**
 * Parse a reference, with or without the `ref:` prefix. Null when malformed.
 * parseRef("ref:events:event:01JA") = { kind: "item", module: "events", type: "event", id: "01JA" }
 */
export function parseRef(value: string): Ref | null {
	const raw = value.trim().startsWith(REF_SCHEME)
		? value.trim().slice(REF_SCHEME.length)
		: value.trim();
	if (raw.startsWith("scope:")) {
		const [scopeId, module, ...rest] = raw.slice("scope:".length).split("/");
		if (rest.length || !ID_RE.test(scopeId)) return null;
		if (module === undefined) return { kind: "scope", scopeId };
		return NAME_RE.test(module) ? { kind: "scope", scopeId, module } : null;
	}
	const parts = raw.split(":");
	if (parts.length !== 3) return null;
	const [module, type, id] = parts;
	if (!NAME_RE.test(module) || !NAME_RE.test(type) || !ID_RE.test(id))
		return null;
	return { kind: "item", module, type, id };
}

/** The reference as a string, without the `ref:` prefix (inverse of `parseRef`). */
export function formatRef(ref: Ref): string {
	if (ref.kind === "scope")
		return ref.module
			? `scope:${ref.scopeId}/${ref.module}`
			: `scope:${ref.scopeId}`;
	return `${ref.module}:${ref.type}:${ref.id}`;
}

/** `ref:<reference>`: the form stored in link fields and `href`s. */
export function refHref(ref: Ref | string): string {
	const formatted = typeof ref === "string" ? ref : formatRef(ref);
	return formatted.startsWith(REF_SCHEME)
		? formatted
		: `${REF_SCHEME}${formatted}`;
}

/** Whether a link value is a stored reference (`ref:…`). */
export function isRefHref(value: string | null | undefined): boolean {
	return typeof value === "string" && value.trim().startsWith(REF_SCHEME);
}

/** `<module>:<type>:<id>`, e.g. itemRef("events", "event", id). */
export function itemRef(module: string, type: string, id: string): string {
	return formatRef({ kind: "item", module, type, id });
}

/** `scope:<scopeId>` or `scope:<scopeId>/<module>`. */
export function scopeRef(scopeId: string, module?: string): string {
	return formatRef({ kind: "scope", scopeId, module });
}

/**
 * The human-readable form of a scope reference: `root/germany/berlin:events` is Berlin's
 * events listing, `root/germany` Germany's home page, `root` the site's. Accepted as input
 * (config files, the admin link picker) and shown in logs; core parses it to ids and never
 * stores it. Returns the scope path ("/germany/berlin/") and the optional module, or null.
 */
export function parseHumanRef(
	value: string,
): { scopePath: string; module?: string } | null {
	const trimmed = value.trim();
	const [pathPart, module, ...rest] = trimmed.split(":");
	if (rest.length) return null;
	const segments = pathPart.split("/");
	if (segments[0] !== "root") return null;
	const slugs = segments.slice(1);
	if (!slugs.every((s) => /^(?!-)(?!.*-$)[a-z0-9-]{1,63}$/.test(s)))
		return null;
	if (module !== undefined && !NAME_RE.test(module)) return null;
	const scopePath = slugs.length ? `/${slugs.join("/")}/` : "/";
	return module === undefined ? { scopePath } : { scopePath, module };
}

/** Inverse of `parseHumanRef`: formatHumanRef("/germany/berlin/", "events") = "root/germany/berlin:events". */
export function formatHumanRef(scopePath: string, module?: string): string {
	const slugs = scopePath.split("/").filter(Boolean);
	const path = ["root", ...slugs].join("/");
	return module ? `${path}:${module}` : path;
}

/** External link values a stored link may hold besides references. */
export const EXTERNAL_LINK_RE = /^(https?:\/\/|mailto:|tel:)/i;

/**
 * Fill a path pattern from an item: fillRefPath("/events/:slug", { id, slug: "bbq" }) =
 * "/events/bbq". A missing (null or undefined) value falls back to the id, so `:id` always
 * works; an empty string stays empty (the root's home page has the empty slug).
 */
export function fillRefPath(
	pattern: string,
	item: { id: string; slug?: string | null },
): string {
	const values: Record<string, unknown> = item;
	return pattern.replace(/:([A-Za-z]+)/g, (_, name: string) => {
		const value = values[name];
		return encodeURIComponent(typeof value === "string" ? value : item.id);
	});
}
