import { and, asc, desc, eq, gte, or, gt, lt } from "drizzle-orm";
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
    upcoming: boolean = false,
    cursor?: string | null,
  ): Promise<{ items: EventWithUser[]; nextCursor?: string | null }> {
    const whereClause: any[] = [];
    const now = new Date().toISOString();

    // Filter upcoming vs past
    if (upcoming) {
      whereClause.push(gte(events.startDate, now));
    } else {
      whereClause.push(lt(events.startDate, now));
    }

    // Keyset pagination: decode cursor and build inline keyset WHERE for (startDate, id)
    const order = upcoming ? "asc" : "desc";
    const cursorObj = decodeCursor(cursor ?? null);
    if (cursorObj && cursorObj.startDate != null && cursorObj.id != null) {
      if (order === "asc") {
        // (startDate > cursor.startDate) OR (startDate = cursor.startDate AND id > cursor.id)
        whereClause.push(
          or(
            gt(events.startDate, cursorObj.startDate),
            and(
              eq(events.startDate, cursorObj.startDate),
              gt(events.id, cursorObj.id),
            ),
          ),
        );
      } else {
        // (startDate < cursor.startDate) OR (startDate = cursor.startDate AND id < cursor.id)
        whereClause.push(
          or(
            lt(events.startDate, cursorObj.startDate),
            and(
              eq(events.startDate, cursorObj.startDate),
              lt(events.id, cursorObj.id),
            ),
          ),
        );
      }
    }

    const orderExprs =
      order === "asc"
        ? [asc(events.startDate), asc(events.id)]
        : [desc(events.startDate), desc(events.id)];

    let query = db
      .select()
      .from(events)
      .where(whereClause.length ? and(...whereClause) : undefined)
      .orderBy(...(orderExprs as any));

    query = (query as any).limit(limit + 1);

    const eventRows = await query;

    // Determine next cursor and trim items to the requested limit
    let nextCursor: string | null | undefined = undefined;
    let items = eventRows as any[];
    if (eventRows.length > limit) {
      nextCursor = getNextCursorFromRows(
        eventRows as any[],
        ["startDate", "id"],
        limit,
      );
      items = (eventRows as any[]).slice(0, limit);
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

  async getUpcoming(limit: number = 3): Promise<EventWithUser[]> {
    const res = await this.getAll(limit, true);
    return res.items;
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
