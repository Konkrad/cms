import { eq, sql } from "drizzle-orm";
import { db } from "~/db/connection";
import {
  inventoryGroups,
  insertInventoryGroupSchema,
  updateInventoryGroupSchema,
  type InventoryGroup,
  type InsertInventoryGroup,
  type UpdateInventoryGroup,
} from "~/db/schemas/inventory-groups";
import { products } from "~/db/schemas/products";

export const inventoryGroupsService = {
  async getByEventId(eventId: string): Promise<InventoryGroup[]> {
    return db.query.inventoryGroups.findMany({
      where: { eventId },
      with: { products: true },
    }) as any;
  },

  async getById(id: string): Promise<InventoryGroup | undefined> {
    return db.query.inventoryGroups.findFirst({
      where: { id },
      with: { products: true },
    }) as any;
  },

  async create(data: InsertInventoryGroup): Promise<InventoryGroup> {
    const parsed = insertInventoryGroupSchema.parse(data);
    const [result] = await db
      .insert(inventoryGroups)
      .values(parsed as any)
      .returning();
    return result;
  },

  async update(
    id: string,
    data: UpdateInventoryGroup,
  ): Promise<InventoryGroup> {
    const parsed = updateInventoryGroupSchema.parse(data);
    const [result] = await db
      .update(inventoryGroups)
      .set(parsed as any)
      .where(eq(inventoryGroups.id, id))
      .returning();
    return result;
  },

  async validatePurchase(
    inventoryGroupId: string,
    additionalQuantity: number,
  ): Promise<{ allowed: boolean; remainingCapacity: number; reason?: string }> {
    const group = await db.query.inventoryGroups.findFirst({
      where: { id: inventoryGroupId },
      with: { products: true },
    }) as any;

    if (!group) {
      return {
        allowed: false,
        remainingCapacity: 0,
        reason: "Inventory group not found",
      };
    }

    // Block purchases outside the group's sales window
    const now = new Date();
    if (group.salesStartDate) {
      const start = new Date(group.salesStartDate);
      if (!isNaN(start.getTime()) && start > now) {
        return {
          allowed: false,
          remainingCapacity: 0,
          reason: `Sales open on ${start.toLocaleString()}`,
        };
      }
    }
    if (group.salesEndDate) {
      const end = new Date(group.salesEndDate);
      if (!isNaN(end.getTime()) && end < now) {
        return {
          allowed: false,
          remainingCapacity: 0,
          reason: "Sales have closed",
        };
      }
    }

    const soldQuantity = group.products.reduce(
      (sum: number, p: any) => sum + (p.soldQuantity || 0),
      0,
    );
    const remaining = group.maxCapacity - soldQuantity;

    return {
      allowed: remaining >= additionalQuantity,
      remainingCapacity: remaining,
      reason:
        remaining < additionalQuantity
          ? `Only ${remaining} spots remaining`
          : undefined,
    };
  },
};
