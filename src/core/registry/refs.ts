import { coreRefModule } from "~/core/refs/core-refs";
import { formatHumanRef, parseRef, refHref, scopeRef } from "~/core/refs/refs";
import {
	itemUrlsWith,
	refFromPathWith,
	resolveRefsWith,
	toStoredLinkWith,
} from "~/core/refs/resolve";
import {
	collectBlockRefs,
	collectHrefs,
	collectRefHrefs,
	replaceHrefs,
	rewriteBlockRefs,
	rewriteRefLinks,
} from "~/core/refs/rich-links";
import type { ModuleDefinition } from "~/core/router/modules";
import { scopeUrl } from "~/core/router/scope-path";
import { scopesService } from "~/core/scopes/scopes.service";
import { env } from "~/env";
import { activeModules, allModules } from "./manifests";

/**
 * References bound to this site's modules (spec 4.3): available references are core's and
 * the active modules'; URLs of items you already hold are built for any registered module.
 * Server-only. Lazy (functions, not constants): core services import this file, and the
 * manifests import those services back.
 */
const available = (): Pick<ModuleDefinition, "id" | "refs">[] => [
	...activeModules,
	coreRefModule,
];
const registered = (): Pick<ModuleDefinition, "id" | "refs">[] => [
	...allModules,
	coreRefModule,
];

/** Current URLs of many references (`ref:` optional); null = unavailable. */
export const resolveRefs = (refs: readonly string[]) =>
	resolveRefsWith(available(), refs);

/**
 * Current URL of a reference (`scope:<id>`, `scope:<id>/<module>`, `<module>:<type>:<id>`,
 * with or without `ref:`), or null when it is unavailable: the scope or item is gone, or its
 * module is not active. Visibility is not checked: a URL is not a leak.
 */
export async function resolveRef(ref: string): Promise<string | null> {
	return (await resolveRefs([ref])).get(ref) ?? null;
}

/**
 * Current URL and label (the item's title, when its type gives one) of an item reference,
 * or null when it is unavailable. For links that show what they point to (the subject of a note or an article).
 */
export async function describeRef(
	ref: string,
): Promise<{ url: string; title: string | null } | null> {
	const parsed = parseRef(ref);
	if (!parsed || parsed.kind !== "item") return null;
	const url = await resolveRef(ref);
	if (!url) return null;
	const def = available().find((m) => m.id === parsed.module)?.refs?.[
		parsed.type
	];
	const [located] = def ? await def.locate([parsed.id]) : [];
	return { url, title: located?.title ?? null };
}

/**
 * The owning scope and label of the item a reference names, for any registered module (an
 * inactive module's items still have an owner: reviews and form results attached to them stay
 * manageable). Null for a malformed or scope reference, an unknown type or a missing item.
 */
export async function locateRef(ref: string): Promise<{
	module: string;
	type: string;
	id: string;
	scopeId: string;
	title: string | null;
} | null> {
	const parsed = parseRef(ref);
	if (!parsed || parsed.kind !== "item") return null;
	const def = registered().find((m) => m.id === parsed.module)?.refs?.[
		parsed.type
	];
	if (!def) return null;
	const [located] = await def.locate([parsed.id]);
	if (!located) return null;
	return {
		module: parsed.module,
		type: parsed.type,
		id: parsed.id,
		scopeId: located.scopeId,
		title: located.title ?? null,
	};
}

type Locatable = { id: string; scopeId: string; slug?: string | null };

/**
 * Canonical URL of an item under the scope that owns it: itemUrl("events:event", event) =
 * "/germany/berlin/events/summer-bbq". `kind` is `<module>:<type>` (`core:article`, `jobs:job`).
 */
export async function itemUrl(kind: string, item: Locatable): Promise<string> {
	return (await itemUrlsWith(registered(), kind, [item]))[0];
}

/** The items with their canonical URL added as `url` (one scope lookup for the list). */
export async function withItemUrls<T extends Locatable>(
	kind: string,
	items: readonly T[],
): Promise<Array<T & { url: string }>> {
	const urls = await itemUrlsWith(registered(), kind, items);
	return items.map((item, i) => ({ ...item, url: urls[i] }));
}

/** The reference for a site path (`/germany/berlin/events/bbq`), or null. */
export const refFromPath = (pathname: string) =>
	refFromPathWith(available(), pathname);

/**
 * The value to store for a link an editor typed or picked (menu items, link fields): a
 * `ref:` reference, an external URL or a fixed site path. Throws `LinkError` otherwise.
 */
export const toStoredLink = (input: string) =>
	toStoredLinkWith(available(), input, env.APP_URL);

/**
 * Rich text on write: links to pages of this site (relative paths or absolute URLs of
 * APP_URL) that resolve to a scope, listing or item become `ref:` links. Run before
 * `sanitizeRichHtml`, which drops the remaining relative links.
 */
export async function internalLinksToRefs(html: string): Promise<string> {
	const base = env.APP_URL.replace(/\/+$/, "");
	const replacements = new Map<string, string>();
	for (const href of collectHrefs(html)) {
		const decoded = href.replace(/&amp;/g, "&");
		const path = decoded.startsWith(base)
			? decoded.slice(base.length) || "/"
			: decoded;
		if (!path.startsWith("/") || path.startsWith("//")) continue;
		const ref = await refFromPath(path);
		if (ref) replacements.set(href, refHref(ref));
	}
	return replacements.size ? replaceHrefs(html, replacements) : html;
}

/** Block fields that hold a link (page-builder `link` fields, e.g. the action button's). */
const LINK_FIELD_NAMES = new Set(["href", "link"]);

/**
 * Page-builder content on write: HTML fields get `internalLinksToRefs`, and link fields
 * (`href`, `link`) holding a path of this site that resolves become `ref:` references.
 */
export async function blocksLinksToRefs<
	T extends { data?: Record<string, unknown> },
>(blocks: readonly T[]): Promise<T[]> {
	const walk = async (value: unknown, key?: string): Promise<unknown> => {
		if (typeof value === "string") {
			if (key && LINK_FIELD_NAMES.has(key) && /^\/(?!\/)/.test(value.trim())) {
				const ref = await refFromPath(value.trim());
				return ref ? refHref(ref) : value;
			}
			return value.includes("<a ") ? internalLinksToRefs(value) : value;
		}
		if (Array.isArray(value)) return Promise.all(value.map((v) => walk(v)));
		if (value && typeof value === "object") {
			const entries = await Promise.all(
				Object.entries(value).map(async ([k, v]) => [k, await walk(v, k)]),
			);
			return Object.fromEntries(entries);
		}
		return value;
	};
	return Promise.all(
		blocks.map(async (block) => ({
			...block,
			data: (await walk(block.data ?? {})) as Record<string, unknown>,
		})),
	);
}

/**
 * Stored rich text for rendering: `ref:` links get their current URL; links whose reference
 * no longer resolves are dropped and their text kept.
 */
export async function renderRichHtml(html: string): Promise<string> {
	const refs = collectRefHrefs(html);
	if (!refs.length) return html;
	return rewriteRefLinks(html, await resolveRefs(refs));
}

/** `renderRichHtml` for many HTML strings at once (one resolution for all their refs). */
export async function renderRichHtmlList(htmls: readonly string[]) {
	const urls = await resolveRefs(htmls.flatMap(collectRefHrefs));
	return htmls.map((html) => rewriteRefLinks(html, urls));
}

/** Page-builder data for rendering: link fields and HTML fields with current URLs. */
export async function renderBlockRefs<T>(value: T): Promise<T> {
	const refs = collectBlockRefs(value);
	if (!refs.length) return value;
	return rewriteBlockRefs(value, await resolveRefs(refs));
}

/** One entry of the admin link picker. */
export interface LinkTarget {
	/** What to store: `ref:<reference>`. */
	href: string;
	label: string;
	/** Current URL, shown next to the label. */
	url: string;
}

/**
 * Scopes, their module listings, CMS pages, notes, articles and module items whose name or title
 * matches `query`, as references for the admin link picker. Public items only (titles of
 * members-only content are not listed).
 */
export async function searchLinkTargets(
	query: string,
	limit = 8,
): Promise<LinkTarget[]> {
	const q = query.trim();
	if (q.length < 2) return [];
	const targets: LinkTarget[] = [];
	const listingIds = activeModules.map((m) => m.id);
	for (const scope of await scopesService.search(q, limit)) {
		targets.push({
			href: refHref(scopeRef(scope.id)),
			label: `${scope.name} (${formatHumanRef(scope.path)})`,
			url: scopeUrl(scope.path),
		});
		for (const module of listingIds.filter((id) => id.includes(q))) {
			targets.push({
				href: refHref(scopeRef(scope.id, module)),
				label: `${scope.name}: ${module} (${formatHumanRef(scope.path, module)})`,
				url: scopeUrl(scope.path, `/${module}`),
			});
		}
	}
	for (const module of available()) {
		for (const [type, def] of Object.entries(module.refs ?? {})) {
			if (!def.search) continue;
			const rows = await def.search(q, limit);
			const urls = await itemUrlsWith(
				registered(),
				`${module.id}:${type}`,
				rows,
			);
			for (const [i, row] of rows.entries()) {
				targets.push({
					href: refHref(`${module.id}:${type}:${row.id}`),
					label: `${def.label}: ${row.title ?? row.id}`,
					url: urls[i],
				});
			}
		}
	}
	return targets.slice(0, limit * 3);
}
