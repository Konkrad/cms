import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "~/db/connection";
import type {
  MenuItem,
  MenuItemTree,
  NewMenuItem,
} from "~/db/schemas/menu-items";
import { menuItems } from "~/db/schemas/menu-items";

function buildMenuTree(items: MenuItem[]): MenuItemTree[] {
  const itemMap = new Map<string, MenuItemTree>();
  const roots: MenuItemTree[] = [];

  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  items.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByPosition = (a: MenuItemTree, b: MenuItemTree) =>
    a.position - b.position;

  roots.sort(sortByPosition);
  roots.forEach((root) => {
    if (root.children) {
      root.children.sort(sortByPosition);
    }
  });

  return roots;
}

export const menuItemsService = {
  async getAll(menuName?: string): Promise<MenuItem[]> {
    console.log("[menuItemsService] getAll - starting, menuName:", menuName);
    let query = db.select().from(menuItems).orderBy(asc(menuItems.position));
    if (menuName) {
      query = db
        .select()
        .from(menuItems)
        .where(eq(menuItems.menuName, menuName))
        .orderBy(asc(menuItems.position));
    }
    try {
      const items = await query;
      console.log(
        "[menuItemsService] getAll - completed, items count:",
        (items || []).length,
      );
      return items as MenuItem[];
    } catch (err) {
      console.error("[menuItemsService] getAll - error:", err);
      throw err;
    }
  },

  async getMenuTree(menuName: string): Promise<MenuItemTree[]> {
    console.log(
      "[menuItemsService] getMenuTree - starting, menuName:",
      menuName,
    );
    try {
      const items = await this.getAll(menuName);
      const tree = buildMenuTree(items);
      console.log(
        "[menuItemsService] getMenuTree - completed, root count:",
        (tree || []).length,
      );
      return tree;
    } catch (err) {
      console.error("[menuItemsService] getMenuTree - error:", err);
      throw err;
    }
  },

  async getById(id: string): Promise<MenuItem | undefined> {
    const items = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return items.length > 0 ? (items[0] as MenuItem) : undefined;
  },

  async create(
    data: Omit<NewMenuItem, "id" | "createdAt" | "updatedAt">,
  ): Promise<MenuItem> {
    // Find the next position for this menu/parent
    const existingItems = await db
      .select({ position: menuItems.position })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.menuName, data.menuName),
          eq(menuItems.parentId, data.parentId ?? null),
        ),
      )
      .orderBy(desc(menuItems.position));

    const nextPosition =
      existingItems && existingItems.length > 0
        ? (existingItems[0].position ?? 0) + 1
        : 0;

    const [result] = await db
      .insert(menuItems)
      .values({
        id: randomUUID(),
        menuName: data.menuName,
        label: data.label,
        url: data.url,
        parentId: data.parentId ?? null,
        position: data.position !== undefined ? data.position : nextPosition,
        icon: data.icon ?? null,
        target: data.target ?? "_self",
      })
      .returning();

    return result as MenuItem;
  },

  async update(
    id: string,
    data: Partial<Omit<NewMenuItem, "id" | "createdAt">>,
  ): Promise<MenuItem | undefined> {
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.menuName !== undefined) updateData.menuName = data.menuName;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.target !== undefined) updateData.target = data.target;

    const [result] = await db
      .update(menuItems)
      .set(updateData)
      .where(eq(menuItems.id, id))
      .returning();

    return result as MenuItem;
  },

  async delete(id: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.id, id));
  },

  async reorderItems(items: { id: string; position: number }[]): Promise<void> {
    for (const item of items) {
      await db
        .update(menuItems)
        .set({ position: item.position })
        .where(eq(menuItems.id, item.id));
    }
  },

  async getMenuNames(): Promise<string[]> {
    const items = await db
      .select({ menuName: menuItems.menuName })
      .from(menuItems)
      .orderBy(asc(menuItems.menuName));

    const uniqueNames = [
      ...new Set((items || []).map((item) => item.menuName)),
    ];
    return uniqueNames;
  },
};
