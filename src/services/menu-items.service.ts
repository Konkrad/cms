import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "~/db/connection";
import type {
  MenuItem,
  MenuItemTree,
  InsertMenuItem,
  UpdateMenuItem,
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

  const sortTree = (nodes: MenuItemTree[]) => {
    nodes.sort(sortByPosition);
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortTree(node.children);
      }
    }
  };

  sortTree(roots);

  return roots;
}

type GetAllOptions = {
  includeHidden?: boolean;
};

export const menuItemsService = {
  // Return all menu items for the given menu name (no pagination)
  async getAll(menuName?: string, options?: GetAllOptions): Promise<MenuItem[]> {
    const whereClause: any[] = [];
    if (menuName) {
      whereClause.push(eq(menuItems.menuName, menuName));
    }
    if (!options?.includeHidden) {
      whereClause.push(eq(menuItems.hidden, false));
    }

    const rows = await db
      .select()
      .from(menuItems)
      .where(whereClause.length ? and(...whereClause) : undefined)
      .orderBy(asc(menuItems.position), asc(menuItems.id));

    return rows as MenuItem[];
  },

  async getMenuTree(menuName: string): Promise<MenuItemTree[]> {
    const items = await this.getAll(menuName);
    return buildMenuTree(items);
  },

  async getAdminMenuTree(menuName: string): Promise<MenuItemTree[]> {
    const items = await this.getAll(menuName, { includeHidden: true });
    return buildMenuTree(items);
  },

  async getById(id: string): Promise<MenuItem | undefined> {
    const items = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return items.length > 0 ? (items[0] as MenuItem) : undefined;
  },

  async create(data: InsertMenuItem): Promise<MenuItem> {
    // Find the next position for this menu/parent
    const existingItems = await db
      .select({ position: menuItems.position })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.menuName, data.menuName),
          eq(menuItems.parentId, data.parentId ?? (null as any)),
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
        hidden: data.hidden ?? false,
        icon: data.icon ?? null,
        target: data.target ?? "_self",
      })
      .returning();

    return result as MenuItem;
  },

  async update(
    id: string,
    data: UpdateMenuItem,
  ): Promise<MenuItem | undefined> {
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.menuName !== undefined) updateData.menuName = data.menuName;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.hidden !== undefined) updateData.hidden = data.hidden;
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
