import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { type ContentFilter, db } from "~/core";
import type { Deal, InsertDeal, UpdateDeal } from "./schema";
import { deals, insertDealSchema, updateDealSchema } from "./schema";

export const dealsService = {
	/** Every deal, or only those owned by `scopeIds` (an admin scope's subtree). */
	async getAll(scopeIds: string[] | null = null): Promise<Deal[]> {
		return db
			.select()
			.from(deals)
			.where(scopeIds ? inArray(deals.scopeId, scopeIds) : undefined)
			.orderBy(desc(deals.createdAt));
	},

	/** Unexpired deals of a listing (`scopeContentFilter`), newest first. */
	async getActive(filter: ContentFilter): Promise<Deal[]> {
		const now = new Date().toISOString();
		return db
			.select()
			.from(deals)
			.where(
				and(
					or(isNull(deals.validUntil), gte(deals.validUntil, now)),
					filter.where(deals),
				),
			)
			.orderBy(desc(deals.createdAt));
	},

	async getById(id: string): Promise<Deal | undefined> {
		const rows = await db.select().from(deals).where(eq(deals.id, id));
		return rows[0];
	},

	async create(data: InsertDeal): Promise<Deal> {
		const validated = insertDealSchema.parse(data);
		const rows = await db.insert(deals).values(validated).returning();
		return rows[0];
	},

	async update(id: string, data: UpdateDeal): Promise<Deal> {
		const validated = updateDealSchema.parse(data);
		const rows = await db
			.update(deals)
			.set({ ...validated, updatedAt: new Date().toISOString() })
			.where(eq(deals.id, id))
			.returning();
		return rows[0];
	},

	async delete(id: string): Promise<void> {
		await db.delete(deals).where(eq(deals.id, id));
	},
};
