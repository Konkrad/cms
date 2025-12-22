import { desc, eq, lt, gte } from "drizzle-orm";
import { db } from "~/db/connection";
import type { Event, NewEvent } from "~/db/schemas/events";
import { events } from "~/db/schemas/events";
import type { User } from "~/db/schemas/users";
import { users } from "~/db/schemas/users";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";

export type EventWithUser = Event & {
  user: { displayName: string; email: string };
};

function mapEventWithUser(event: any, user: any): EventWithUser {
  return {
    ...event,
    user: {
      displayName: user?.displayName ?? "",
      email: user?.email ?? "",
    },
  };
}

export const eventsService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: EventWithUser[]; nextCursor?: string | null }> {
    // Cursor-based pagination using createdAt only (newest-first)
    const cursorObj = decodeCursor(cursor ?? null);

    let query: any = db.select().from(events);

    if (cursorObj && cursorObj.createdAt != null) {
      // newest-first => fetch items with createdAt < cursor
      query = query.where(lt(events.createdAt, cursorObj.createdAt));
    }

    // Always newest-first (tie-break on id)
    query = query.orderBy(desc(events.createdAt), desc(events.id));

    query = (query as any).limit(limit + 1);

    const rows = await query;

    // Determine next cursor and trim to requested page size
    let nextCursor: string | undefined | null = undefined;
    let items = rows as any[];
    if (rows.length > limit) {
      nextCursor = getNextCursorFromRows(rows as any[], ["createdAt"], limit);
      items = rows.slice(0, limit);
    }

    // Fetch users for the returned events
    const userIds = Array.from(new Set((items || []).map((e) => e.userId)));
    const userRows = userIds.length
      ? await db
          .select()
          .from(users)
          .where((users.id as any).in(userIds))
      : [];

    const userMap = new Map(userRows.map((u) => [u.id, u]));

    return {
      items: items.map((event) =>
        mapEventWithUser(event, userMap.get(event.userId)),
      ),
      nextCursor: nextCursor ?? null,
    };
  },

  /**
   * Return ALL upcoming events (no pagination).
   * Upcoming is defined as events with endDate >= now.
   * Ordered by startDate ascending (soonest first).
   */
  async getUpcoming(): Promise<EventWithUser[]> {
    const now = new Date().toISOString();
    const rows = await db
      .select()
      .from(events)
      .where(gte(events.endDate, now))
      .orderBy(events.startDate, events.id);

    const userIds = Array.from(new Set((rows || []).map((e) => e.userId)));
    const userRows = userIds.length
      ? await db
          .select()
          .from(users)
          .where((users.id as any).in(userIds))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    return rows.map((event: any) =>
      mapEventWithUser(event, userMap.get(event.userId)),
    );
  },

  /**
   * Return a list of years (numbers) for past events (events whose endDate < now).
   * The years are derived from the event's startDate year and returned in descending order.
   */
  async getYears(): Promise<number[]> {
    const now = new Date().toISOString();
    const rows = await db.select().from(events).where(lt(events.endDate, now));
    const yearsSet = new Set<number>(
      rows.map((e: any) => new Date(e.startDate).getFullYear()),
    );
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    return years;
  },

  /**
   * Return all past events for the specified year (no pagination).
   * Past events are those with endDate < now.
   * Events are ordered by startDate descending (most-recent-first).
   */
  async getEventsByYear(year: number): Promise<EventWithUser[]> {
    const now = new Date().toISOString();
    const rows = await db
      .select()
      .from(events)
      .where(lt(events.endDate, now))
      .orderBy(desc(events.startDate), desc(events.id));

    const filtered = (rows || []).filter(
      (e: any) => new Date(e.startDate).getFullYear() === year,
    );

    const userIds = Array.from(new Set(filtered.map((e: any) => e.userId)));
    const userRows = userIds.length
      ? await db
          .select()
          .from(users)
          .where((users.id as any).in(userIds))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    return filtered.map((event: any) =>
      mapEventWithUser(event, userMap.get(event.userId)),
    );
  },

  async getById(id: string): Promise<EventWithUser | undefined> {
    const event = (await db.select().from(events).where(eq(events.id, id)))[0];
    if (!event) return undefined;
    const user = (
      await db.select().from(users).where(eq(users.id, event.userId))
    )[0];
    return mapEventWithUser(event, user);
  },

  async create(
    data: Omit<NewEvent, "id" | "createdAt" | "updatedAt">,
  ): Promise<Event> {
    const [inserted] = await db
      .insert(events)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any)
      .returning();
    return inserted;
  },

  async update(
    id: string,
    data: Partial<Omit<NewEvent, "id" | "createdAt">>,
  ): Promise<Event | undefined> {
    const [updated] = await db
      .update(events)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(events.id, id))
      .returning();
    return updated;
  },

  async delete(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  },
};
