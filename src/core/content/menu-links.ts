import type { MenuItem, MenuItemTree } from "~/core/content/schema/menu-items";
import { isRefHref } from "~/core/refs/refs";
import { resolveRefs } from "~/core/registry/refs";

/**
 * Menu items for rendering (spec 4.3): an item stored with a reference (`ref:core:page:<id>`,
 * `ref:scope:<id>`) gets the current URL; an item whose reference no longer resolves (the
 * page or scope is gone, the module is inactive) is left out, with its children. Server-only.
 */
export async function resolveMenuUrls<T extends MenuItem | MenuItemTree>(
	items: readonly T[],
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
	const urls = await resolveRefs(refs);
	const rewrite = <I extends MenuItem | MenuItemTree>(
		list: readonly I[],
	): I[] =>
		list.flatMap((item) => {
			const url = isRefHref(item.url) ? urls.get(item.url.trim()) : item.url;
			if (!url) return [];
			const children =
				"children" in item && item.children
					? { children: rewrite(item.children) }
					: {};
			return [{ ...item, url, ...children }];
		});
	return rewrite(items);
}
