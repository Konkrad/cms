import { eq, sql } from "drizzle-orm";
import { db } from "~/db/connection";
import {
  products,
  insertProductSchema,
  updateProductSchema,
  type Product,
  type InsertProduct,
  type UpdateProduct,
} from "~/db/schemas/products";
import { stripeService } from "./stripe.service";

export const productsService = {
  async getByEventId(eventId: string): Promise<Product[]> {
    return db.query.products.findMany({
      where: { eventId },
      with: { inventoryGroup: true },
    });
  },

  async getById(id: string): Promise<Product | undefined> {
    const result = await db.query.products.findFirst({
      where: { id },
      with: { inventoryGroup: true },
    });
    return result as any;
  },

  async create(data: InsertProduct): Promise<Product> {
    const parsed = insertProductSchema.parse(data);

    const [product] = await db
      .insert(products)
      .values(parsed as any)
      .returning();

    const stripeProduct = await stripeService.createProduct(
      product.name,
      `Ticket for event ${product.eventId}`,
    );

    const [updated] = await db
      .update(products)
      .set({ stripeProductId: stripeProduct.id })
      .where(eq(products.id, product.id))
      .returning();

    return updated;
  },

  async update(id: string, data: UpdateProduct): Promise<Product> {
    const parsed = updateProductSchema.parse(data);
    const [result] = await db
      .update(products)
      .set({ ...parsed, updatedAt: new Date().toISOString() } as any)
      .where(eq(products.id, id))
      .returning();
    return result;
  },

  async incrementSold(id: string, quantity: number): Promise<void> {
    await db
      .update(products)
      .set({ soldQuantity: sql`${products.soldQuantity} + ${quantity}` })
      .where(eq(products.id, id));
  },
};
