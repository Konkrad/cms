import { and, desc, gte, isNull, or, eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { deals, insertDealSchema, updateDealSchema } from "~/db/schemas/deals";
import type { Deal, InsertDeal, UpdateDeal } from "~/db/schemas/deals";

export const dealsService = {
  async getAll(): Promise<Deal[]> {
    return db.select().from(deals).orderBy(desc(deals.createdAt));
  },

  async getActive(): Promise<Deal[]> {
    const now = new Date().toISOString();
    return db
      .select()
      .from(deals)
      .where(or(isNull(deals.validUntil), gte(deals.validUntil, now)))
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
