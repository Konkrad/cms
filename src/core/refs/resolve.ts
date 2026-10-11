import type {
	ModuleDefinition,
	RefLocation,
	RefTypeDefinition,
} from "~/core/router/modules";
import { matchPath } from "~/core/router/pages";
import { redirectsService } from "~/core/router/redirects.service";
import { scopeUrl, splitScopePath } from "~/core/router/scope-path";
import { getScopePathsById } from "~/core/router/scope-request";
import {
	EXTERNAL_LINK_RE,
	fillRefPath,
	formatRef,
	isRefHref,
	itemRef,
	parseHumanRef,
	parseRef,
	refHref,
	scopeRef,
} from "./refs";

/**
 * Server-side reference resolution (spec 4.3). Every function takes the modules whose
 * references are available (the active ones plus core's own `post`/`page` types); the bound
 * versions without that argument live in `~/core/registry/refs`.
 */

type RefModules = readonly Pick<ModuleDefinition, "id" | "refs">[];

function refType(
	modules: RefModules,
	module: string,
	type: string,
): RefTypeDefinition | undefined {
	return modules.find((m) => m.id === module)?.refs?.[type];
}

/**
 * Current URLs of many references at once (one `locate` call per item type). The map has
 * an entry per input; null = unavailable: the scope or item is gone, the module is not
 * active, or the reference is malformed. Accepts references with or without `ref:`.
 */
export async function resolveRefsWith(
	modules: RefModules,
	refs: readonly string[],
): Promise<Map<string, string | null>> {
	const out = new Map<string, string | null>();
	const paths = await getScopePathsById();
	const pending = new Map<string, { type: RefTypeDefinition; ids: string[] }>();
	const items: Array<{ input: string; key: string; id: string }> = [];

	for (const input of new Set(refs)) {
		const ref = parseRef(input);
		out.set(input, null);
		if (!ref) continue;
		if (ref.kind === "scope") {
			const path = paths.get(ref.scopeId);
			if (path === undefined) continue;
			if (!ref.module) {
				out.set(input, scopeUrl(path));
			} else if (modules.some((m) => m.id === ref.module && m.id !== "core")) {
				out.set(input, scopeUrl(path, `/${ref.module}`));
			}
			continue;
		}
		const type = refType(modules, ref.module, ref.type);
		if (!type) continue;
		const key = `${ref.module}:${ref.type}`;
		const group = pending.get(key) ?? { type, ids: [] };
		group.ids.push(ref.id);
		pending.set(key, group);
		items.push({ input, key, id: ref.id });
	}

	const located = new Map<string, Map<string, RefLocation>>();
	await Promise.all(
		[...pending].map(async ([key, { type, ids }]) => {
			const rows = await type.locate([...new Set(ids)]);
			located.set(key, new Map(rows.map((r) => [r.id, r])));
		}),
	);
	for (const { input, key, id } of items) {
		const location = located.get(key)?.get(id);
		const path = location && paths.get(location.scopeId);
		const type = pending.get(key)?.type;
		if (location && path !== undefined && type) {
			out.set(input, scopeUrl(path, fillRefPath(type.path, location)));
		}
	}
	return out;
}

/** Current URL of one reference, or null when it is unavailable (see `resolveRefsWith`). */
export async function resolveRefWith(
	modules: RefModules,
	ref: string,
): Promise<string | null> {
	return (await resolveRefsWith(modules, [ref])).get(ref) ?? null;
}

/**
 * Canonical URL of an item you already hold, under the scope that owns it:
 * itemUrlWith(modules, "events:event", { id, scopeId, slug: "bbq" }) = "/germany/berlin/events/bbq".
 * Throws for an unknown type (a programming error). Never checks visibility.
 */
export async function itemUrlWith(
	modules: RefModules,
	kind: string,
	item: { id: string; scopeId: string; slug?: string | null },
): Promise<string> {
	return (await itemUrlsWith(modules, kind, [item]))[0];
}

/** `itemUrlWith` for a list, in input order. */
export async function itemUrlsWith(
	modules: RefModules,
	kind: string,
	items: readonly { id: string; scopeId: string; slug?: string | null }[],
): Promise<string[]> {
	const [module, type] = kind.split(":");
	const def = refType(modules, module, type);
	if (!def) throw new Error(`Unknown reference type: ${kind}`);
	const paths = await getScopePathsById();
	return items.map((item) =>
		scopeUrl(paths.get(item.scopeId) ?? "/", fillRefPath(def.path, item)),
	);
}

/**
 * The reference for a site path, or null when the path is not a scope, a module listing of a
 * scope or an item page (for example `/login`). Old paths are followed through the redirects
 * table first. Used to turn pasted URLs into references and by the link migration.
 */
export async function refFromPathWith(
	modules: RefModules,
	pathname: string,
): Promise<string | null> {
	const clean = `/${pathname
		.split(/[?#]/)[0]
		.trim()
		.replace(/^\/+|\/+$/g, "")}`;
	const path = (await redirectsService.resolve(clean)) ?? clean;
	const byId = await getScopePathsById();
	const idByPath = new Map([...byId].map(([id, p]) => [p, id]));
	const { scopePath, rest } = splitScopePath(path, new Set(idByPath.keys()));
	const scopeId = idByPath.get(scopePath);
	if (!scopeId) return null;
	if (rest === "/") return scopeRef(scopeId);
	const listing = /^\/([a-z][a-z0-9-]*)$/.exec(rest)?.[1];
	if (listing && modules.some((m) => m.id === listing && m.id !== "core"))
		return scopeRef(scopeId, listing);
	// Module types before core's: core's page type ("/:slug") matches any single segment.
	const ordered = [
		...modules.filter((m) => m.id !== "core"),
		...modules.filter((m) => m.id === "core"),
	];
	for (const module of ordered) {
		for (const [type, def] of Object.entries(module.refs ?? {})) {
			const params = matchPath(def.path, rest);
			if (!params) continue;
			const param = Object.values(params)[0] ?? "";
			const id = def.find ? await def.find(scopeId, param) : param;
			if (!id) continue;
			const [found] = await def.locate([id]);
			if (found) return itemRef(module.id, type, found.id);
		}
	}
	return null;
}

/** Thrown by `toStoredLinkWith` for input that is neither a link nor a reference. */
export class LinkError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkError";
	}
}

/**
 * Normalize a link typed or picked by an editor (menu items, page-builder link fields) into
 * the value stored: a `ref:` reference (from a reference, the human form
 * `root/germany/berlin:events`, or a site URL that resolves to a scope, listing or item), an
 * external `http(s):`/`mailto:`/`tel:` URL, or a fixed site path that is no scope or item
 * (`/login`, `/archive/posts`). `appUrl` makes absolute URLs of this site count as paths.
 * Throws `LinkError` for anything else (`javascript:`, a reference that does not resolve).
 */
export async function toStoredLinkWith(
	modules: RefModules,
	input: string,
	appUrl?: string,
): Promise<string> {
	const value = input.trim();
	if (!value) return "";
	if (isRefHref(value) || /^(scope|[a-z][a-z0-9-]*):[^/]/.test(value)) {
		const ref = parseRef(value);
		if (ref && (await resolveRefWith(modules, formatRef(ref))) !== null)
			return refHref(ref);
		if (isRefHref(value) || ref)
			throw new LinkError(`"${value}" does not point to anything`);
	}
	const human = parseHumanRef(value);
	if (human) {
		const byId = await getScopePathsById();
		const scopeId = [...byId].find(([, p]) => p === human.scopePath)?.[0];
		if (!scopeId) throw new LinkError(`No scope at "${value}"`);
		const ref = scopeRef(scopeId, human.module);
		if ((await resolveRefWith(modules, ref)) === null)
			throw new LinkError(`"${value}" does not point to anything`);
		return refHref(ref);
	}
	let path: string | null = null;
	if (appUrl && value.startsWith(appUrl.replace(/\/+$/, ""))) {
		path = value.slice(appUrl.replace(/\/+$/, "").length) || "/";
	} else if (value.startsWith("/") && !value.startsWith("//")) {
		path = value;
	} else if (EXTERNAL_LINK_RE.test(value)) {
		return value;
	}
	if (path === null || !path.startsWith("/"))
		throw new LinkError(
			`"${value}" is not a link: use a reference, a site path or an http(s), mailto or tel URL`,
		);
	const ref = await refFromPathWith(modules, path);
	return ref ? refHref(ref) : path;
}
