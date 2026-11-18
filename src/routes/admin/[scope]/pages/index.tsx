import { $, component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { MenuTable } from "~/core/content/admin/MenuTable/MenuTable";
import { menuItemsService } from "~/core/content/menu-items.service";
import { pagesService } from "~/core/content/pages.service";
import type { MenuItem } from "~/core/content/schema/menu-items";
import { getStaticMenuLinks } from "~/core/content/static-menu-links";
import { sanitizeSvg } from "~/core/content/svg-sanitize";
import { t } from "~/core/i18n";
import { formatHumanRef, isRefHref, refHref } from "~/core/refs/refs";
import { activeModules } from "~/core/registry/manifests";
import { resolveRefs, toStoredLink } from "~/core/registry/refs";
import { adminUrl, scopeUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	requireScopeRole,
	requireSystemAdmin,
	requireWithinScope,
} from "~/core/scopes/access";
import { scopesService } from "~/core/scopes/scopes.service";

/**
 * The pages of the URL's scope (managers of the scope). The site menus are global, so the
 * menu manager below exists on the root only.
 */
export const usePagesAdmin = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const pages = await pagesService.listByScope(scope.id);
	return {
		isRoot: scope.parentId === null,
		adminBase: adminUrl(scope.path),
		pages: pages.map((p) => ({
			id: p.id,
			title: p.title,
			url: scopeUrl(scope.path, p.slug),
			status: p.status,
		})),
	};
});

/** Delete a page of the URL's scope or one below it. */
export const useDeletePage = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const page = await pagesService.getById(data.pageId);
		await requireWithinScope(event, scope, page);
		await pagesService.delete(data.pageId);
		return { success: true };
	},
	zod$({ pageId: z.string().min(1) }),
);

export const useMenuItems = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	if (scope.parentId !== null)
		return {
			main: [],
			footer: [],
			staticUrls: [] as string[],
			linkTargets: [] as Array<{ value: string; label: string }>,
		};

	// Static links in their stored form (a root listing like /events becomes a reference).
	const staticUrls = await Promise.all(
		getStaticMenuLinks().map((l) => toStoredLink(normalizeUrl(l.url))),
	);

	// Auto-sync: ensure every static link appears in the main menu (draft by default).
	async function syncMenu(menuName: "main" | "footer") {
		let items = await menuItemsService.getAll(menuName, {
			includeHidden: true,
		});
		const knownUrls = new Set(items.map((item) => item.url.trim()));
		let maxPosition = items.reduce(
			(max, item) => Math.max(max, item.position),
			0,
		);
		let changed = false;

		// Static links (main menu only)
		if (menuName === "main") {
			for (const [i, staticLink] of getStaticMenuLinks().entries()) {
				const url = staticUrls[i];
				if (knownUrls.has(url) || knownUrls.has(normalizeUrl(staticLink.url)))
					continue;
				maxPosition += 1;
				await menuItemsService.create({
					menuName,
					title: staticLink.label,
					url,
					parentId: null,
					position: maxPosition,
					status: "hidden",
					icon: null,
					target: "_self",
				});
				changed = true;
			}
		}

		if (changed) {
			items = await menuItemsService.getAll(menuName, { includeHidden: true });
		}
		return items;
	}

	const [main, footer] = await Promise.all([
		syncMenu("main"),
		syncMenu("footer"),
	]);

	// Items stored with a reference show where they currently lead.
	const urls = await resolveRefs(
		[...main, ...footer].map((i) => i.url).filter(isRefHref),
	);
	const withLabel = (item: (typeof main)[number]) => ({
		...item,
		urlLabel: isRefHref(item.url)
			? (urls.get(item.url) ?? t("admin.pages.unavailableLink"))
			: item.url,
	});

	return {
		main: main.map(withLabel),
		footer: footer.map(withLabel),
		staticUrls,
		linkTargets: await menuLinkTargets(),
	};
});

/**
 * The menu's link picker: every scope (in the human form `root/germany/berlin`, parsed to a
 * reference on save), the root listings of the active modules and every published page.
 */
async function menuLinkTargets(): Promise<
	Array<{ value: string; label: string }>
> {
	const [scopes, pages] = await Promise.all([
		scopesService.search("", 500),
		pagesService.searchPublished("", 500),
	]);
	const pageUrls = await resolveRefs(pages.map((p) => `core:page:${p.id}`));
	return [
		...scopes.map((s) => ({
			value: formatHumanRef(s.path),
			label: t("admin.pages.targetGroup", { name: s.name }),
		})),
		...activeModules.map((m) => ({
			value: formatHumanRef("/", m.id),
			label: t("admin.pages.targetListing", { id: m.id }),
		})),
		...pages.map((p) => ({
			value: refHref(`core:page:${p.id}`),
			label: t("admin.pages.targetPage", {
				title: p.title,
				value: pageUrls.get(`core:page:${p.id}`) ?? "",
			}),
		})),
	];
}

/** Paths get a leading slash; references, their human form and external links stay. */
const normalizeUrl = (url: string) => {
	const trimmed = url.trim();
	if (!trimmed) return "/";
	if (/^(https?:\/\/|mailto:|tel:|ref:|root(\/|:|$))/i.test(trimmed))
		return trimmed;
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const isDescendant = (
	items: MenuItem[],
	possibleDescendantId: string,
	possibleAncestorId: string,
): boolean => {
	const itemsById = new Map(items.map((item) => [item.id, item]));
	let current = itemsById.get(possibleDescendantId);

	while (current?.parentId) {
		if (current.parentId === possibleAncestorId) return true;
		current = itemsById.get(current.parentId);
	}

	return false;
};

const getDescendantIds = (items: MenuItem[], itemId: string): string[] => {
	const childrenByParent = new Map<string, string[]>();
	for (const item of items) {
		if (!item.parentId) continue;
		const current = childrenByParent.get(item.parentId) ?? [];
		current.push(item.id);
		childrenByParent.set(item.parentId, current);
	}

	const descendants: string[] = [];
	const stack = [...(childrenByParent.get(itemId) ?? [])];

	while (stack.length > 0) {
		const currentId = stack.pop()!;
		descendants.push(currentId);
		stack.push(...(childrenByParent.get(currentId) ?? []));
	}

	return descendants;
};

export const useDeleteMenuItem = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		try {
			await menuItemsService.delete(data.menuItemId);
			return { success: true };
		} catch (error: any) {
			return {
				success: false,
				error: error.message ?? t("admin.pages.deleteFailed"),
			};
		}
	},
	zod$({ menuItemId: z.string().min(1) }),
);

export const useAddToMenu = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);

		try {
			// A reference, an external URL or a fixed path (throws LinkError otherwise).
			const normalizedUrl = await toStoredLink(normalizeUrl(data.url));

			const menuItems = await menuItemsService.getAll(data.menuName, {
				includeHidden: true,
			});

			const duplicate = menuItems.find(
				(item) => item.url.trim() === normalizedUrl,
			);
			if (duplicate) {
				return {
					success: false,
					error: t("admin.pages.linkExists"),
				};
			}

			const maxPosition = menuItems.reduce(
				(max, item) => Math.max(max, item.position),
				0,
			);

			const sanitizedIcon = data.icon ? sanitizeSvg(data.icon) || null : null;

			await menuItemsService.create({
				menuName: data.menuName,
				title: data.title,
				url: normalizedUrl,
				parentId: null,
				position: maxPosition + 1,
				status: data.status ?? "hidden",
				icon: sanitizedIcon,
				target: "_self",
			});

			return { success: true };
		} catch (error: any) {
			return {
				success: false,
				error: error.message || t("admin.pages.addToMenuFailed"),
			};
		}
	},
	zod$({
		menuName: z.enum(["main", "footer"]).default("main"),
		title: z.string().min(1),
		url: z.string().min(1),
		icon: z.string().optional(),
		status: z.enum(["visible", "hidden"]).optional(),
	}),
);

export const useUpdateMenuItem = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);

		try {
			const allItems = await menuItemsService.getAll(data.menuName, {
				includeHidden: true,
			});
			const existing = allItems.find((item) => item.id === data.menuItemId);
			if (!existing) {
				return { success: false, error: t("admin.pages.menuItemNotFound") };
			}

			const normalizedUrl = await toStoredLink(normalizeUrl(data.url));
			const duplicate = allItems.find(
				(item) =>
					item.id !== data.menuItemId && item.url.trim() === normalizedUrl,
			);
			if (duplicate) {
				return {
					success: false,
					error: t("admin.pages.urlInUse"),
				};
			}

			const nextParentId =
				data.menuName === "main"
					? data.parentId
						? data.parentId
						: null
					: null;
			if (nextParentId === data.menuItemId) {
				return {
					success: false,
					error: t("admin.pages.ownParent"),
				};
			}
			if (
				nextParentId &&
				isDescendant(allItems, nextParentId, data.menuItemId)
			) {
				return {
					success: false,
					error: t("admin.pages.underChild"),
				};
			}

			const parentChanged = existing.parentId !== nextParentId;
			let nextPosition = existing.position;
			if (parentChanged) {
				const siblingPositions = allItems
					.filter(
						(item) =>
							item.id !== data.menuItemId &&
							item.parentId === nextParentId &&
							item.status === existing.status,
					)
					.map((item) => item.position);
				nextPosition =
					siblingPositions.length > 0 ? Math.max(...siblingPositions) + 1 : 0;
			}

			const sanitizedIcon = data.icon ? sanitizeSvg(data.icon) || null : null;

			await menuItemsService.update(data.menuItemId, {
				title: data.title,
				url: normalizedUrl,
				parentId: nextParentId,
				target: data.target,
				icon: sanitizedIcon,
				position: nextPosition,
			});

			return { success: true };
		} catch (error: any) {
			return {
				success: false,
				error: error.message || t("admin.pages.updateMenuFailed"),
			};
		}
	},
	zod$({
		menuName: z.enum(["main", "footer"]).default("main"),
		menuItemId: z.string(),
		title: z.string().min(1),
		url: z.string().min(1),
		parentId: z.string().optional(),
		icon: z.string().optional(),
		target: z.enum(["_self", "_blank", "_parent", "_top"]),
	}),
);

export const useMoveMenuItem = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);

		try {
			const allItems = await menuItemsService.getAll(data.menuName, {
				includeHidden: true,
			});
			const movedItem = allItems.find((item) => item.id === data.movedItemId);
			if (!movedItem) {
				return { success: false, error: t("admin.pages.draggedNotFound") };
			}

			const targetItem = data.targetItemId
				? allItems.find((item) => item.id === data.targetItemId)
				: undefined;

			if ((data.mode === "before" || data.mode === "as-child") && !targetItem) {
				return { success: false, error: t("admin.pages.dropTargetMissing") };
			}

			if (targetItem && targetItem.id === movedItem.id) {
				return { success: false, error: t("admin.pages.dropOntoSelf") };
			}

			if (
				data.mode === "as-child" &&
				targetItem &&
				isDescendant(allItems, targetItem.id, movedItem.id)
			) {
				return {
					success: false,
					error: t("admin.pages.underDescendant"),
				};
			}

			const oldParentId = movedItem.parentId;
			const oldStatus = movedItem.status;

			let nextParentId: string | null =
				data.menuName === "main" ? null : movedItem.parentId;
			let nextStatus: "visible" | "hidden" = "visible";
			let insertBeforeId: string | null = null;

			if (data.menuName === "main" && data.mode === "before" && targetItem) {
				nextParentId = targetItem.parentId;
				nextStatus = targetItem.status as "visible" | "hidden";
				insertBeforeId = targetItem.id;
			} else if (
				data.menuName === "main" &&
				data.mode === "as-child" &&
				targetItem
			) {
				nextParentId = targetItem.id;
				nextStatus = targetItem.status as "visible" | "hidden";
			} else if (data.menuName === "main" && data.mode === "to-hidden") {
				nextParentId = null;
				nextStatus = "hidden";
			} else if (data.menuName === "main") {
				nextParentId = null;
				nextStatus = "visible";
			} else if (data.mode === "before" && targetItem) {
				nextParentId = null;
				nextStatus = "visible";
				insertBeforeId = targetItem.id;
			} else {
				nextParentId = null;
				nextStatus = "visible";
			}

			await menuItemsService.update(movedItem.id, {
				parentId: nextParentId,
				status: nextStatus,
			});

			if (oldStatus !== nextStatus) {
				const descendantIds = getDescendantIds(allItems, movedItem.id);
				for (const descendantId of descendantIds) {
					await menuItemsService.update(descendantId, { status: nextStatus });
				}
			}

			const refreshed = await menuItemsService.getAll(data.menuName, {
				includeHidden: true,
			});
			const movedAfterUpdate = refreshed.find(
				(item) => item.id === movedItem.id,
			);
			if (!movedAfterUpdate) {
				return { success: false, error: t("admin.pages.reloadFailed") };
			}

			const targetSiblings = refreshed
				.filter(
					(item) =>
						item.id !== movedItem.id &&
						item.parentId === nextParentId &&
						item.status === nextStatus,
				)
				.sort((a, b) => a.position - b.position);

			const insertIndex = insertBeforeId
				? Math.max(
						0,
						targetSiblings.findIndex((item) => item.id === insertBeforeId),
					)
				: targetSiblings.length;

			const reorderedTarget = [...targetSiblings];
			reorderedTarget.splice(insertIndex, 0, movedAfterUpdate);

			const reorderPayload = reorderedTarget.map((item, index) => ({
				id: item.id,
				position: index,
			}));

			const changedGroup =
				oldParentId !== nextParentId || oldStatus !== nextStatus;
			if (changedGroup) {
				const oldSiblings = refreshed
					.filter(
						(item) =>
							item.id !== movedItem.id &&
							item.parentId === oldParentId &&
							item.status === oldStatus,
					)
					.sort((a, b) => a.position - b.position)
					.map((item, index) => ({ id: item.id, position: index }));

				reorderPayload.push(...oldSiblings);
			}

			await menuItemsService.reorderItems(reorderPayload);

			return { success: true };
		} catch (error: any) {
			return {
				success: false,
				error: error.message || t("admin.pages.moveFailed"),
			};
		}
	},
	zod$({
		menuName: z.enum(["main", "footer"]).default("main"),
		movedItemId: z.string().min(1),
		targetItemId: z.string().optional(),
		mode: z.enum(["before", "as-child", "to-visible-root", "to-hidden"]),
	}),
);

export default component$(() => {
	const admin = usePagesAdmin();
	const deletePageAction = useDeletePage();
	const menuItemsData = useMenuItems();
	const addToMenuAction = useAddToMenu();
	const updateMenuItemAction = useUpdateMenuItem();
	const moveMenuItemAction = useMoveMenuItem();
	const deleteMenuItemAction = useDeleteMenuItem();

	return (
		<div>
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-2xl font-bold">{t("admin.pages.managePages")}</h2>
				<Button href={`${admin.value.adminBase}/pages/new`} variant="primary">
					{t("admin.pages.createNewPage")}
				</Button>
			</div>

			{!admin.value.isRoot && (
				<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.pages.title")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.pages.edit.url")}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.pages.status")}
								</th>
								<th class="px-6 py-3" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{admin.value.pages.map((p) => (
								<tr key={p.id}>
									<td class="px-6 py-4 text-sm font-medium text-gray-900">
										{p.title}
									</td>
									<td class="px-6 py-4 text-sm text-gray-500">
										<a href={p.url} class="hover:underline">
											{p.url}
										</a>
									</td>
									<td class="px-6 py-4 text-sm text-gray-500 capitalize">
										{p.status}
									</td>
									<td class="px-6 py-4 text-sm text-right space-x-3">
										<a
											href={`${admin.value.adminBase}/pages/${p.id}/edit`}
											class="text-blue-600 hover:text-blue-900"
										>
											{t("admin.pages.settings")}
										</a>
										<a
											href={`${admin.value.adminBase}/pages/${p.id}/builder`}
											class="text-blue-600 hover:text-blue-900"
										>
											{t("admin.pages.editContent")}
										</a>
										<Form action={deletePageAction} class="inline">
											<input type="hidden" name="pageId" value={p.id} />
											<button
												type="submit"
												class="text-red-600 hover:text-red-900"
											>
												{t("admin.pages.delete")}
											</button>
										</Form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{admin.value.pages.length === 0 && (
						<p class="px-6 py-8 text-center text-gray-500">
							{t("admin.pages.noPagesInThisGroup")}
						</p>
					)}
				</div>
			)}

			{admin.value.isRoot && (
				<MenuTable
					mainItems={menuItemsData.value.main}
					footerItems={menuItemsData.value.footer}
					staticUrls={menuItemsData.value.staticUrls}
					linkTargets={menuItemsData.value.linkTargets}
					onMove$={$(async (params) => {
						const result = await moveMenuItemAction.submit(params);
						if (!result.value || "failed" in result.value)
							return { success: false };
						return {
							success: result.value.success ?? false,
							error: result.value.error,
						};
					})}
					onUpdate$={$(async (params) => {
						const result = await updateMenuItemAction.submit({
							...params,
							menuName: params.menuName as "main" | "footer",
							target: params.target as "_self" | "_blank" | "_parent" | "_top",
						});
						if (!result.value || "failed" in result.value)
							return { success: false };
						return {
							success: result.value.success ?? false,
							error: result.value.error,
						};
					})}
					onAdd$={$(async (params) => {
						const result = await addToMenuAction.submit(params);
						if (!result.value || "failed" in result.value)
							return { success: false };
						return {
							success: result.value.success ?? false,
							error: result.value.error,
						};
					})}
					onDelete$={$(async (params) => {
						const result = await deleteMenuItemAction.submit(params);
						if (!result.value || "failed" in result.value)
							return { success: false };
						return {
							success: result.value.success ?? false,
							error: result.value.error,
						};
					})}
				/>
			)}
		</div>
	);
});
