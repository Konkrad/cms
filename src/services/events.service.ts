import { desc, eq, lt, gte } from "drizzle-orm";
import { db } from "~/db/connection";
import type { Event, InsertEvent, UpdateEvent } from "~/db/schemas/events";
import {
  events,
  insertEventSchema,
  updateEventSchema,
} from "~/db/schemas/events";
import { products } from "~/db/schemas/products";
import { inventoryGroups } from "~/db/schemas/inventory-groups";
import { logins } from "~/db/schemas/logins";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";

export type EventWithUser = Event & {
  user: User & { email?: string };
};

import type { User } from "~/db/schemas/users";

export const eventsService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: EventWithUser[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);

    const results = await db.query.events.findMany({
      with: {
        user: true,
      },
      orderBy: [desc(events.createdAt), desc(events.id)],
      limit: limit + 1,
      where: cursorObj?.createdAt
        ? lt(events.createdAt, cursorObj.createdAt)
        : undefined,
    });

    let nextCursor: string | undefined | null = undefined;
    let items = results;
    if (results.length > limit) {
      nextCursor = getNextCursorFromRows(results, ["createdAt"], limit);
      items = results.slice(0, limit);
    }

    return {
      items: items as EventWithUser[],
      nextCursor: nextCursor ?? null,
    };
  },

  async getUpcoming(): Promise<EventWithUser[]> {
    const now = new Date().toISOString();

    const results = await db.query.events.findMany({
      where: gte(events.endDate, now),
      orderBy: [events.startDate, events.id],
      with: {
        user: true,
      },
    });

    return results as EventWithUser[];
  },

  async getYears(): Promise<number[]> {
    const now = new Date().toISOString();
    const results = await db.query.events.findMany({
      where: lt(events.endDate, now),
      columns: {
        startDate: true,
      },
    });

    const yearsSet = new Set<number>(
      results.map((e) => new Date(e.startDate).getFullYear()),
    );
    return Array.from(yearsSet).sort((a, b) => b - a);
  },

  async getEventsByYear(year: number): Promise<EventWithUser[]> {
    const now = new Date().toISOString();

    const results = await db.query.events.findMany({
      where: lt(events.endDate, now),
      orderBy: [desc(events.startDate), desc(events.id)],
      with: {
        user: true,
      },
    });

    const filtered = results.filter(
      (e) => new Date(e.startDate).getFullYear() === year,
    );

    return filtered as EventWithUser[];
  },

  async getById(id: string): Promise<EventWithUser | undefined> {
    const result = await db.query.events.findFirst({
      where: eq(events.id, id),
      with: {
        user: true,
      },
    });

    if (!result) return undefined;

    // Attempt to resolve organizer email from the logins table (if available)
    let organizerEmail: string | undefined = undefined;
    try {
      if (result.user?.loginId) {
        const [login] = await db
          .select()
          .from(logins)
          .where(eq(logins.id, result.user.loginId));
        if (login?.email) {
          organizerEmail = login.email;
        }
      }
    } catch {
      // If something goes wrong when fetching the login/email, don't fail the whole request.
      // We simply return the event without an email field populated.
    }

    return {
      ...result,
      user: {
        ...result.user,
        email: organizerEmail,
      },
    } as EventWithUser;
  },

  async create(data: InsertEvent): Promise<Event> {
    const parsed = insertEventSchema.parse(data);
    const [result] = await db
      .insert(events)
      .values(parsed as any)
      .returning();

    return result;
  },

  async update(id: string, data: UpdateEvent): Promise<Event | undefined> {
    const parsed = updateEventSchema.parse(data);
    const [result] = await db
      .update(events)
      .set(parsed as any)
      .where(eq(events.id, id))
      .returning();

    return result;
  },

  async delete(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  },

  async isFreeEvent(eventId: string): Promise<boolean> {
    const event = await this.getById(eventId);
    if (!event) return false;

    // Get all products for the event
    const eventProducts = await db.query.products.findMany({
      where: eq(products.eventId, eventId),
    });

    // Event is free if all products have price 0
    return (
      eventProducts.length > 0 && eventProducts.every((p) => p.price === 0)
    );
  },

  async validateSalesPeriod(event: Event): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const now = new Date();

    // Derive sales availability from inventory groups (each may have its own sales window)
    const groups = await db.query.inventoryGroups.findMany({
      where: eq(inventoryGroups.eventId, event.id),
      with: { products: true },
    });

    // Track earliest upcoming sales start (if any)
    let earliestStart: Date | null = null;

    for (const group of groups) {
      const salesStart = group.salesStartDate
        ? new Date(group.salesStartDate)
        : null;
      const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;

      // Record earliest future start date for messaging
      if (salesStart && salesStart > now) {
        if (!earliestStart || salesStart < earliestStart) {
          earliestStart = salesStart;
        }
      }

      // Check if group's sales window is currently active
      const withinWindow =
        (!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

      // Remaining capacity for the group
      const soldQuantity =
        group.products?.reduce(
          (sum: number, p: any) => sum + (p.soldQuantity || 0),
          0,
        ) || 0;
      const remainingCapacity = group.maxCapacity - soldQuantity;

      // Check if at least one product in the group still has product-level availability
      const hasAvailableProduct = (group.products || []).some((p: any) => {
        return p.maxQuantity === 0 || p.maxQuantity > (p.soldQuantity || 0);
      });

      // If group's sales are open, it has capacity and has at least one product available,
      // the event has active sales.
      if (withinWindow && remainingCapacity > 0 && hasAvailableProduct) {
        return { valid: true };
      }
    }

    // If no groups are currently sellable but there's a known future start date, show that
    if (earliestStart) {
      return {
        valid: false,
        reason: `Sales open on ${earliestStart.toLocaleDateString()} at ${earliestStart.toLocaleTimeString()}`,
      };
    }

    // Otherwise, sales are considered closed for the event
    return { valid: false, reason: "Sales have closed for this event" };
  },
};
