import { $, component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { MenuTable } from "~/components/admin/MenuTable/MenuTable";
import type { MenuItem } from "~/db/schemas/menu-items";
import { db } from "~/db/connection";
import { pages } from "~/db/schemas/pages";
import { menuItemsService } from "~/services/menu-items.service";
import { STATIC_MENU_LINKS } from "~/services/static-menu-links";
import { requireAdmin } from "~/utils/server-auth";
import { sanitizeSvg } from "~/utils/svg-sanitize";

// Pages are only accessible in global context
export const useCheckGlobalContext = routeLoader$(async ({ params, redirect }) => {
  if (params.group_slug !== "global") {
    throw redirect(302, `/admin/${params.group_slug}`);
  }
  return true;
});

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export const useMenuItems = routeLoader$(async () => {
  let main = await menuItemsService.getAll("main", { includeHidden: true });

  const knownUrls = new Set(main.map((item) => normalizeUrl(item.url)));
  let maxPosition = main.reduce((max, item) => Math.max(max, item.position), 0);
  let created = false;

  for (const staticLink of STATIC_MENU_LINKS) {
    if (knownUrls.has(normalizeUrl(staticLink.url))) continue;

    maxPosition += 1;
    await menuItemsService.create({
      menuName: "main",
      label: staticLink.label,
      url: normalizeUrl(staticLink.url),
      parentId: null,
      position: maxPosition,
      hidden: true,
      icon: null,
      target: "_self",
    });
    created = true;
  }

  if (created) {
    main = await menuItemsService.getAll("main", { includeHidden: true });
  }

  const footer = await menuItemsService.getAll("footer", { includeHidden: true });

  const allPages = await db.select({ id: pages.id, slug: pages.slug, status: pages.status }).from(pages);
  const pageIdByUrl: Record<string, string> = {};
  const pageStatusByUrl: Record<string, string> = {};
  for (const p of allPages) {
    pageIdByUrl[normalizeUrl(p.slug)] = p.id;
    pageStatusByUrl[normalizeUrl(p.slug)] = p.status;
  }

  return {
    main,
    footer,
    pageIdByUrl,
    pageStatusByUrl,
  };
});

const normalizeUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
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
    await requireAdmin(event);
    try {
      await menuItemsService.delete(data.menuItemId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message ?? "Delete failed" };
    }
  },
  zod$({ menuItemId: z.string().min(1) }),
);

export const useAddToMenu = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    try {
      const normalizedUrl = normalizeUrl(data.url);

      const menuItems = await menuItemsService.getAll(data.menuName, {
        includeHidden: true,
      });

      const duplicate = menuItems.find((item) => normalizeUrl(item.url) === normalizedUrl);
      if (duplicate) {
        return { success: false, error: "This link already exists in the menu" };
      }

      const maxPosition = menuItems.reduce(
        (max, item) => Math.max(max, item.position),
        0,
      );

      const sanitizedIcon = data.icon ? sanitizeSvg(data.icon) || null : null;

      await menuItemsService.create({
        menuName: data.menuName,
        label: data.label,
        url: normalizedUrl,
        parentId: null,
        position: maxPosition + 1,
        hidden: data.hidden ?? false,
        icon: sanitizedIcon,
        target: "_self",
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to add page to menu",
      };
    }
  },
  zod$({
    menuName: z.enum(["main", "footer"]).default("main"),
    label: z.string().min(1),
    url: z.string().min(1),
    icon: z.string().optional(),
    hidden: z.coerce.boolean().optional(),
  }),
);

export const useUpdateMenuItem = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    try {
      const allItems = await menuItemsService.getAll(data.menuName, { includeHidden: true });
      const existing = allItems.find((item) => item.id === data.menuItemId);
      if (!existing) {
        return { success: false, error: "Menu item not found" };
      }

      const normalizedUrl = normalizeUrl(data.url);
      const duplicate = allItems.find(
        (item) => item.id !== data.menuItemId && normalizeUrl(item.url) === normalizedUrl,
      );
      if (duplicate) {
        return { success: false, error: "Another menu item already uses this URL" };
      }

      const nextParentId = data.menuName === "main" ? (data.parentId ? data.parentId : null) : null;
      if (nextParentId === data.menuItemId) {
        return { success: false, error: "A menu item cannot be its own parent" };
      }
      if (
        nextParentId &&
        isDescendant(allItems, nextParentId, data.menuItemId)
      ) {
        return { success: false, error: "Cannot move item under one of its children" };
      }

      const parentChanged = existing.parentId !== nextParentId;
      let nextPosition = existing.position;
      if (parentChanged) {
        const siblingPositions = allItems
          .filter(
            (item) =>
              item.id !== data.menuItemId &&
              item.parentId === nextParentId &&
              item.hidden === existing.hidden,
          )
          .map((item) => item.position);
        nextPosition = siblingPositions.length > 0 ? Math.max(...siblingPositions) + 1 : 0;
      }

      const sanitizedIcon = data.icon ? sanitizeSvg(data.icon) || null : null;

      await menuItemsService.update(data.menuItemId, {
        label: data.label,
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
        error: error.message || "Failed to update menu item",
      };
    }
  },
  zod$({
    menuName: z.enum(["main", "footer"]).default("main"),
    menuItemId: z.string(),
    label: z.string().min(1),
    url: z.string().min(1),
    parentId: z.string().optional(),
    icon: z.string().optional(),
    target: z.enum(["_self", "_blank", "_parent", "_top"]),
  }),
);

export const useMoveMenuItem = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    try {
      const allItems = await menuItemsService.getAll(data.menuName, { includeHidden: true });
      const movedItem = allItems.find((item) => item.id === data.movedItemId);
      if (!movedItem) {
        return { success: false, error: "Dragged menu item was not found" };
      }

      const targetItem = data.targetItemId
        ? allItems.find((item) => item.id === data.targetItemId)
        : undefined;

      if ((data.mode === "before" || data.mode === "as-child") && !targetItem) {
        return { success: false, error: "Drop target is missing" };
      }

      if (targetItem && targetItem.id === movedItem.id) {
        return { success: false, error: "Cannot drop onto the same item" };
      }

      if (
        data.mode === "as-child" &&
        targetItem &&
        isDescendant(allItems, targetItem.id, movedItem.id)
      ) {
        return { success: false, error: "Cannot move item under one of its descendants" };
      }

      const oldParentId = movedItem.parentId;
      const oldHidden = movedItem.hidden;

      let nextParentId: string | null = data.menuName === "main" ? null : movedItem.parentId;
      let nextHidden = false;
      let insertBeforeId: string | null = null;

      if (data.menuName === "main" && data.mode === "before" && targetItem) {
        nextParentId = targetItem.parentId;
        nextHidden = targetItem.hidden;
        insertBeforeId = targetItem.id;
      } else if (data.menuName === "main" && data.mode === "as-child" && targetItem) {
        nextParentId = targetItem.id;
        nextHidden = targetItem.hidden;
      } else if (data.menuName === "main" && data.mode === "to-hidden") {
        nextParentId = null;
        nextHidden = true;
      } else if (data.menuName === "main") {
        nextParentId = null;
        nextHidden = false;
      } else if (data.mode === "before" && targetItem) {
        nextParentId = null;
        nextHidden = false;
        insertBeforeId = targetItem.id;
      } else {
        nextParentId = null;
        nextHidden = false;
      }

      await menuItemsService.update(movedItem.id, {
        parentId: nextParentId,
        hidden: nextHidden,
      });

      if (oldHidden !== nextHidden) {
        const descendantIds = getDescendantIds(allItems, movedItem.id);
        for (const descendantId of descendantIds) {
          await menuItemsService.update(descendantId, { hidden: nextHidden });
        }
      }

      const refreshed = await menuItemsService.getAll(data.menuName, { includeHidden: true });
      const movedAfterUpdate = refreshed.find((item) => item.id === movedItem.id);
      if (!movedAfterUpdate) {
        return { success: false, error: "Moved item could not be reloaded" };
      }

      const targetSiblings = refreshed
        .filter(
          (item) =>
            item.id !== movedItem.id &&
            item.parentId === nextParentId &&
            item.hidden === nextHidden,
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

      const changedGroup = oldParentId !== nextParentId || oldHidden !== nextHidden;
      if (changedGroup) {
        const oldSiblings = refreshed
          .filter(
            (item) =>
              item.id !== movedItem.id &&
              item.parentId === oldParentId &&
              item.hidden === oldHidden,
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
        error: error.message || "Failed to move menu item",
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
  const menuItemsData = useMenuItems();
  const addToMenuAction = useAddToMenu();
  const updateMenuItemAction = useUpdateMenuItem();
  const moveMenuItemAction = useMoveMenuItem();
  const deleteMenuItemAction = useDeleteMenuItem();

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Pages</h2>
        <Button href="/admin/global/pages/new" variant="primary">
          Create New Page
        </Button>
      </div>

      <MenuTable
        mainItems={menuItemsData.value.main}
        footerItems={menuItemsData.value.footer}
        pageIdByUrl={menuItemsData.value.pageIdByUrl}
        pageStatusByUrl={menuItemsData.value.pageStatusByUrl}
        staticUrls={STATIC_MENU_LINKS.map((l) => normalizeUrl(l.url))}
        onMove$={$(async (params) => {
          const result = await moveMenuItemAction.submit(params);
          if (!result.value || "failed" in result.value) return { success: false };
          return { success: result.value.success ?? false, error: result.value.error };
        })}
        onUpdate$={$(async (params) => {
          const result = await updateMenuItemAction.submit({
            ...params,
            menuName: params.menuName as "main" | "footer",
            target: params.target as "_self" | "_blank" | "_parent" | "_top",
          });
          if (!result.value || "failed" in result.value) return { success: false };
          return { success: result.value.success ?? false, error: result.value.error };
        })}
        onAdd$={$(async (params) => {
          const result = await addToMenuAction.submit(params);
          if (!result.value || "failed" in result.value) return { success: false };
          return { success: result.value.success ?? false, error: result.value.error };
        })}
        onDelete$={$(async (params) => {
          const result = await deleteMenuItemAction.submit(params);
          if (!result.value || "failed" in result.value) return { success: false };
          return { success: result.value.success ?? false, error: result.value.error };
        })}
      />
    </div>
  );
});

