import { desc, eq, lt, gte } from "drizzle-orm";
import { db } from "~/db/connection";
import type { Event, InsertEvent, UpdateEvent } from "~/db/schemas/events";
import {
  events,
  insertEventSchema,
  updateEventSchema,
} from "~/db/schemas/events";
import { products } from "~/db/schemas/products";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";

export type EventWithUser = Event & {
  user: User;
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

    return result as EventWithUser | undefined;
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
    return eventProducts.length > 0 && eventProducts.every(p => p.price === 0);
  },

  async validateSalesPeriod(event: Event): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const now = new Date();

    // Check if sales haven't started yet
    if (event.salesStartDate) {
      const salesStart = new Date(event.salesStartDate);
      if (salesStart > now) {
        return {
          valid: false,
          reason: `Sales open on ${salesStart.toLocaleDateString()} at ${salesStart.toLocaleTimeString()}`,
        };
      }
    }

    // Check if sales have ended
    if (event.salesEndDate) {
      const salesEnd = new Date(event.salesEndDate);
      if (salesEnd < now) {
        return {
          valid: false,
          reason: "Sales have closed for this event",
        };
      }
    }

    return { valid: true };
  },
};
