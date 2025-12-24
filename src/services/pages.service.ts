import { and, desc, eq, ne, lt } from "drizzle-orm";
import { db } from "~/db/connection";
import type { InsertPage, UpdatePage, Page } from "~/db/schemas/pages";
import { pages } from "~/db/schemas/pages";
import crypto from "crypto";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";

const RESERVED_SLUGS = ["admin", "api", "login", "profile"];

export type PageWithParent = Page & { parent: { title: string } | null };

export const pagesService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: PageWithParent[]; nextCursor?: string | null }> {
    // Cursor-based pagination using createdAt only (newest-first)
    const cursorObj = decodeCursor(cursor ?? null);

    let query: any = db.select().from(pages);

    if (cursorObj && cursorObj.createdAt != null) {
      // newest-first => fetch items with createdAt < cursor
      query = query.where(lt(pages.createdAt, cursorObj.createdAt));
    }

    // Always newest-first (tie-break on id)
    query = query.orderBy(desc(pages.createdAt), desc(pages.id));

    query = query.limit(limit + 1);

    const rows = await query;

    // Determine next cursor and trim to requested page size
    let nextCursor: string | undefined | null = undefined;
    let items = rows as any[];
    if (rows.length > limit) {
      nextCursor = getNextCursorFromRows(rows as any[], ["createdAt"], limit);
      items = rows.slice(0, limit);
    }

    // Fetch parent titles for returned pages (parents may be outside the page window)
    const parentIds = Array.from(
      new Set((items || []).map((p) => p.parentId).filter(Boolean)),
    );
    const parentRows = parentIds.length
      ? await db
          .select()
          .from(pages)
          .where((pages.id as any).in(parentIds))
      : [];
    const parentMap = new Map(parentRows.map((p) => [p.id, p]));

    const mapped = items.map((page: any) => {
      const parentPage = page.parentId ? parentMap.get(page.parentId) : null;
      return {
        ...page,
        parent: parentPage ? { title: parentPage.title } : null,
      } as PageWithParent;
    });

    return { items: mapped, nextCursor: nextCursor ?? null };
  },

  async getById(id: string): Promise<Page | undefined> {
    const result = await db.select().from(pages).where(eq(pages.id, id));
    if (!result.length) return undefined;
    return result[0];
  },

  async getBySlug(slug: string): Promise<Page | undefined> {
    const result = await db
      .select()
      .from(pages)
      .where(and(eq(pages.slug, slug), eq(pages.status, "published")));
    if (!result.length) return undefined;
    return result[0];
  },

  async validateSlug(slug: string, excludeId?: string): Promise<boolean> {
    if (RESERVED_SLUGS.includes(slug)) {
      return false;
    }
    let query = db.select().from(pages).where(eq(pages.slug, slug));
    if (excludeId) {
      query = db
        .select()
        .from(pages)
        .where(and(eq(pages.slug, slug), ne(pages.id, excludeId)));
    }
    const result = await query;
    return result.length === 0;
  },

  async create(
    data: InsertPage,
    accessToken?: string,
    refreshToken?: string,
  ): Promise<Page> {
    const isValid = await this.validateSlug(data.slug);
    if (!isValid) {
      throw new Error("Slug is already in use or reserved");
    }
    const [inserted] = await db
      .insert(pages)
      .values({
        ...data,
        parentId: data.parentId || null,
        content: data.content || [],
        status: data.status || "draft",
      } as any)
      .returning();
    return inserted;
  },

  async update(id: string, data: UpdatePage): Promise<Page | undefined> {
    const oldPage = await this.getById(id);
    const wasPublished = oldPage?.status === "published";
    const isNowPublished = data.status === "published";

    if (data.slug) {
      const isValid = await this.validateSlug(data.slug, id);
      if (!isValid) {
        throw new Error("Slug is already in use or reserved");
      }
    }

    const [updated] = await db
      .update(pages)
      .set(data)
      .where(eq(pages.id, id))
      .returning();

    // Optionally, handle menu item creation if published (requires menuItemsService)
    // if (!wasPublished && isNowPublished) { ... }

    return updated;
  },

  async delete(id: string): Promise<void> {
    // Prevent deleting a page with children
    const children = await db
      .select()
      .from(pages)
      .where(eq(pages.parentId, id));
    if (children.length > 0) {
      throw new Error("Cannot delete page with child pages");
    }
    await db.delete(pages).where(eq(pages.id, id));
  },

  async getHierarchy(): Promise<PageWithParent[]> {
    // Keep previous behavior (return list) while getAll now supports pagination
    const res = await this.getAll();
    return res.items;
  },
};
