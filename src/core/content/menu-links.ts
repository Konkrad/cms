import { pagesService } from "~/core/content/pages.service";
import type { MenuItem, MenuItemTree } from "~/core/content/schema/menu-items";
import { isRefHref } from "~/core/refs/refs";
import { resolveRefs } from "~/core/registry/refs";
import { type AccessUser, canViewScope } from "~/core/scopes/access";

const PAGE_REF = /^ref:core:page:(.+)$/;

/** References of menu items to pages the viewer may not open (members-only pages). */
async function hiddenPageRefs(
	refs: readonly string[],
	viewer: AccessUser,
): Promise<Set<string>> {
	const ids = refs.flatMap((r) => PAGE_REF.exec(r)?.[1] ?? []);
	const hidden = new Set<string>();
	for (const page of await pagesService.locate(ids))
		if (
			page.visibility !== "public" &&
			!(await canViewScope(viewer, page.scopeId, page.visibility))
		)
			hidden.add(`ref:core:page:${page.id}`);
	return hidden;
}

/**
 * Menu items for rendering (spec 4.3): an item stored with a reference (`ref:core:page:<id>`,
 * `ref:scope:<id>`) gets the current URL; an item whose reference no longer resolves (the
 * page or scope is gone, the module is inactive) is left out, with its children, and so is a
 * link to a page the viewer may not open (spec 4.2). Server-only.
 */
export async function resolveMenuUrls<T extends MenuItem | MenuItemTree>(
	items: readonly T[],
	viewer: AccessUser = null,
): Promise<T[]> {
	const refs: string[] = [];
	const collect = (list: readonly (MenuItem | MenuItemTree)[]) => {
		for (const item of list) {
			if (isRefHref(item.url)) refs.push(item.url.trim());
			if ("children" in item && item.children) collect(item.children);
		}
	};
	collect(items);
	if (!refs.length) return [...items];
	const [urls, hidden] = await Promise.all([
		resolveRefs(refs),
		hiddenPageRefs(refs, viewer),
	]);
	const rewrite = <I extends MenuItem | MenuItemTree>(
		list: readonly I[],
	): I[] =>
		list.flatMap((item) => {
			const ref = item.url.trim();
			if (hidden.has(ref)) return [];
			const url = isRefHref(item.url) ? urls.get(ref) : item.url;
			if (!url) return [];
			const children =
				"children" in item && item.children
					? { children: rewrite(item.children) }
					: {};
			return [{ ...item, url, ...children }];
		});
	return rewrite(items);
}
