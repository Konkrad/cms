import { desc, eq, lt, gte, isNull, and, or, inArray } from "drizzle-orm";
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
import { users as usersTable } from "~/db/schemas/users";
import { createCursorFromItem, decodeCursor, getNextCursorFromRows } from "~/services/pagination";
import { groupMembershipsService } from "~/services/group-memberships.service";

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
      orderBy: { createdAt: "desc", id: "desc" },
      limit: limit + 1,
      where: {
        deletedAt: { isNull: true },
        ...(cursorObj?.createdAt
          ? { createdAt: { lt: cursorObj.createdAt } }
          : {}),
      },
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

  async getUpcoming(): Promise<Event[]> {
    const now = new Date().toISOString();

    const results = await db.query.events.findMany({
      where: {
        endDate: { gte: now },
        deletedAt: { isNull: true },
      },
      orderBy: { startDate: "asc", id: "asc" },
    });

    return results;
  },

  async getUpcomingInitial(baseLimit: number = 3): Promise<{ items: Event[]; nextCursor: string | null }> {
    const now = new Date().toISOString();
    const rows = await db.query.events.findMany({
      where: { endDate: { gte: now }, deletedAt: { isNull: true } },
      orderBy: { startDate: "asc", id: "asc" },
      limit: baseLimit + 10,
    });

    let cutoff = Math.min(baseLimit, rows.length);
    if (rows.length >= baseLimit) {
      const lastDay = rows[baseLimit - 1].startDate.slice(0, 10);
      while (cutoff < rows.length && rows[cutoff].startDate.slice(0, 10) === lastDay) {
        cutoff++;
      }
    }

    const items = rows.slice(0, cutoff);
    const nextCursor = cutoff < rows.length
      ? createCursorFromItem(items[items.length - 1], ["startDate"])
      : null;

    return { items, nextCursor };
  },

  async getUpcomingFrom(cursor: string, limit: number = 10): Promise<{ items: Event[]; nextCursor: string | null }> {
    const now = new Date().toISOString();
    const cursorObj = decodeCursor(cursor);

    const rows = await db.query.events.findMany({
      where: {
        endDate: { gte: now },
        deletedAt: { isNull: true },
        ...(cursorObj?.startDate ? { startDate: { gt: cursorObj.startDate } } : {}),
      },
      orderBy: { startDate: "asc", id: "asc" },
      limit: limit + 1,
    });

    const nextCursor = getNextCursorFromRows(rows, ["startDate"], limit) ?? null;
    return { items: rows.slice(0, limit), nextCursor };
  },

  async getPastPaged(limit: number = 10, cursor?: string | null): Promise<{ items: Event[]; nextCursor: string | null }> {
    const now = new Date().toISOString();
    const cursorObj = decodeCursor(cursor ?? null);

    const rows = await db.query.events.findMany({
      where: {
        endDate: { lt: now },
        deletedAt: { isNull: true },
        ...(cursorObj?.startDate ? { startDate: { lt: cursorObj.startDate } } : {}),
      },
      orderBy: { startDate: "desc", id: "desc" },
      limit: limit + 1,
    });

    const nextCursor = getNextCursorFromRows(rows, ["startDate"], limit) ?? null;
    return { items: rows.slice(0, limit), nextCursor };
  },

  async getYears(): Promise<number[]> {
    const now = new Date().toISOString();
    const results = await db.query.events.findMany({
      where: {
        endDate: { lt: now },
        deletedAt: { isNull: true },
      },
      columns: {
        startDate: true,
      },
    });

    const yearsSet = new Set<number>(
      results.map((e) => new Date(e.startDate).getFullYear()),
    );
    return Array.from(yearsSet).sort((a, b) => b - a);
  },

  async getEventsByYear(year: number): Promise<Event[]> {
    const now = new Date().toISOString();

    const results = await db.query.events.findMany({
      where: {
        endDate: { lt: now },
        deletedAt: { isNull: true },
      },
      orderBy: { startDate: "desc", id: "desc" },
    });

    const filtered = results.filter(
      (e) => new Date(e.startDate).getFullYear() === year,
    );

    return filtered;
  },

  async getById(id: string): Promise<EventWithUser | undefined> {
    const result = await db.query.events.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      with: {
        user: true,
      },
    }) as any;

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
      where: { eventId },
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
      where: { eventId: event.id },
      with: { products: true },
    }) as any[];

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

  async getVisibleEvents(
    userId: string | null,
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: EventWithUser[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);

    let visibilityCondition;
    if (userId) {
      const userGroups = await groupMembershipsService.getUserGroups(userId);
      const groupIds = userGroups.map((g) => g.id);

      visibilityCondition =
        groupIds.length > 0
          ? or(
              eq(events.visibility, "global"),
              and(
                eq(events.visibility, "group-only"),
                inArray(events.groupId, groupIds),
              ),
            )
          : eq(events.visibility, "global");
    } else {
      visibilityCondition = eq(events.visibility, "global");
    }

    const results = await db
      .select({ event: events, user: usersTable })
      .from(events)
      .innerJoin(usersTable, eq(events.userId, usersTable.id))
      .where(
        and(
          isNull(events.deletedAt),
          visibilityCondition,
          cursorObj?.createdAt
            ? lt(events.createdAt, cursorObj.createdAt)
            : undefined,
        ),
      )
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(limit + 1);

    let nextCursor: string | undefined | null = undefined;
    let items = results;
    if (results.length > limit) {
      nextCursor = getNextCursorFromRows(
        results.map((r) => r.event),
        ["createdAt"],
        limit,
      );
      items = results.slice(0, limit);
    }

    return {
      items: items.map((row) => ({ ...row.event, user: row.user })) as EventWithUser[],
      nextCursor: nextCursor ?? null,
    };
  },

  async softDelete(id: string, deletedBy: string): Promise<Event | undefined> {
    const [result] = await db
      .update(events)
      .set({
        deletedAt: new Date().toISOString(),
        deletedBy,
      })
      .where(eq(events.id, id))
      .returning();

    return result;
  },

  async countPastByGroupId(groupId: string): Promise<number> {
    const now = new Date().toISOString();
    const results = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.groupId, groupId),
          isNull(events.deletedAt),
          lt(events.endDate, now),
        ),
      );
    return results.length;
  },

  async joinEvent(
    userId: string,
    eventId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const event = await this.getById(eventId);
    if (!event) {
      return { success: false, error: "Event not found" };
    }

    if (event.groupId) {
      const isMember = await groupMembershipsService.isMember(
        userId,
        event.groupId,
      );
      if (!isMember) {
        return {
          success: false,
          error: "You must be a member of this group to join this event",
        };
      }
    }

    return { success: true };
  },
};
