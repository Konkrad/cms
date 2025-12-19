import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "~/db/connection";
import type { NewPage, Page } from "~/db/schemas/pages";
import { pages } from "~/db/schemas/pages";

const RESERVED_SLUGS = ["admin", "api", "login", "signup", "profile"];

export type PageWithParent = Page & { parent: { title: string } | null };

export const pagesService = {
	async getAll(): Promise<PageWithParent[]> {
		const allPages = await db
			.select()
			.from(pages)
			.orderBy(desc(pages.createdAt));
		// Build a map for parent lookup
		const pageMap = new Map(allPages.map((p) => [p.id, p]));
		return allPages.map((page) => {
			const parentPage = page.parentId ? pageMap.get(page.parentId) : null;
			return {
				...page,
				parent: parentPage ? { title: parentPage.title } : null,
			};
		}) as PageWithParent[];
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
		data: Omit<NewPage, "id" | "createdAt" | "updatedAt">,
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
			})
			.returning();
		return inserted;
	},

	async update(
		id: string,
		data: Partial<Omit<NewPage, "id" | "createdAt">>,
	): Promise<Page | undefined> {
		const oldPage = await this.getById(id);
		const wasPublished = oldPage?.status === "published";
		const isNowPublished = data.status === "published";

		if (data.slug) {
			const isValid = await this.validateSlug(data.slug, id);
			if (!isValid) {
				throw new Error("Slug is already in use or reserved");
			}
		}

		const updateData: Partial<NewPage> = {
			updatedAt: new Date().toISOString(),
		};

		if (data.title !== undefined) updateData.title = data.title;
		if (data.slug !== undefined) updateData.slug = data.slug;
		if (data.parentId !== undefined) updateData.parentId = data.parentId;
		if (data.content !== undefined) updateData.content = data.content;
		if (data.status !== undefined) updateData.status = data.status;

		const [updated] = await db
			.update(pages)
			.set(updateData)
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
		return this.getAll();
	},
};
