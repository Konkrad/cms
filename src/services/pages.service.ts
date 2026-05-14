import { desc, eq, lt } from "drizzle-orm";
import { db } from "~/db/connection";
import type { InsertPage, UpdatePage, Page } from "~/db/schemas/pages";
import { pages } from "~/db/schemas/pages";
import { menuItems } from "~/db/schemas/menu-items";
import type { MenuItem } from "~/db/schemas/menu-items";
import crypto from "crypto";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";

export type PageWithMenuItem = Page & { menuItem: Pick<MenuItem, "id" | "title" | "url" | "status"> | null };

export const pagesService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: PageWithMenuItem[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);

    let query: any = db.select().from(pages);

    if (cursorObj && cursorObj.createdAt != null) {
      query = query.where(lt(pages.createdAt, cursorObj.createdAt));
    }

    query = query.orderBy(desc(pages.createdAt), desc(pages.id));
    query = query.limit(limit + 1);

    const rows = await query;

    let nextCursor: string | undefined | null = undefined;
    let items = rows as Page[];
    if (rows.length > limit) {
      nextCursor = getNextCursorFromRows(rows as any[], ["createdAt"], limit);
      items = rows.slice(0, limit);
    }

    // Fetch linked menu items for the returned pages
    const pageIds = items.map((p) => p.id);
    const linkedMenuItems = pageIds.length
      ? await db
          .select({ id: menuItems.id, title: menuItems.title, url: menuItems.url, status: menuItems.status, pageId: menuItems.pageId })
          .from(menuItems)
          .where((menuItems.pageId as any).in(pageIds))
      : [];
    const menuItemByPageId = new Map(linkedMenuItems.map((m) => [m.pageId, m]));

    const mapped: PageWithMenuItem[] = items.map((page) => {
      const mi = menuItemByPageId.get(page.id);
      return {
        ...page,
        menuItem: mi ? { id: mi.id, title: mi.title, url: mi.url, status: mi.status } : null,
      };
    });

    return { items: mapped, nextCursor: nextCursor ?? null };
  },

  async getById(id: string): Promise<PageWithMenuItem | undefined> {
    const result = await db.select().from(pages).where(eq(pages.id, id));
    if (!result.length) return undefined;
    const page = result[0];
    const miResult = await db
      .select({ id: menuItems.id, title: menuItems.title, url: menuItems.url, status: menuItems.status })
      .from(menuItems)
      .where(eq(menuItems.pageId, id));
    return {
      ...page,
      menuItem: miResult.length ? miResult[0] : null,
    };
  },

  async getByUrl(url: string): Promise<PageWithMenuItem | undefined> {
    const miResult = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.url, url));
    const mi = miResult.find((m) => m.pageId != null);
    if (!mi?.pageId) return undefined;
    const pageResult = await db
      .select()
      .from(pages)
      .where(eq(pages.id, mi.pageId));
    if (!pageResult.length) return undefined;
    return {
      ...pageResult[0],
      menuItem: { id: mi.id, title: mi.title, url: mi.url, status: mi.status },
    };
  },

  async create(data: InsertPage): Promise<Page> {
    const [inserted] = await db
      .insert(pages)
      .values({
        id: crypto.randomUUID(),
        ...data,
        content: data.content || [],
        status: data.status || "draft",
      } as any)
      .returning();
    return inserted;
  },

  async update(id: string, data: UpdatePage): Promise<Page | undefined> {
    const [updated] = await db
      .update(pages)
      .set(data)
      .where(eq(pages.id, id))
      .returning();
    return updated;
  },

  async delete(id: string): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  },
};
