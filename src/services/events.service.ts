import { db } from '~/db/connection';
import { events, users, type Event, type NewEvent } from '~/db/schema';
import { eq, desc, gte } from 'drizzle-orm';

export type EventWithUser = Event & { user: { displayName: string; email: string } };

export const eventsService = {
  async getAll(filters?: { userId?: string; locationType?: string; upcoming?: boolean }): Promise<EventWithUser[]> {
    let query = db
      .select({
        id: events.id,
        title: events.title,
        body: events.body,
        startDate: events.startDate,
        endDate: events.endDate,
        locationType: events.locationType,
        address: events.address,
        longitude: events.longitude,
        latitude: events.latitude,
        onlineUrl: events.onlineUrl,
        userId: events.userId,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.userId, users.id))
      .orderBy(desc(events.startDate));

    if (filters?.userId) {
      query = query.where(eq(events.userId, filters.userId)) as any;
    }

    if (filters?.locationType) {
      query = query.where(eq(events.locationType, filters.locationType)) as any;
    }

    if (filters?.upcoming) {
      query = query.where(gte(events.startDate, new Date())) as any;
    }

    return await query;
  },

  async getUpcoming(limit: number = 3): Promise<EventWithUser[]> {
    return await db
      .select({
        id: events.id,
        title: events.title,
        body: events.body,
        startDate: events.startDate,
        endDate: events.endDate,
        locationType: events.locationType,
        address: events.address,
        longitude: events.longitude,
        latitude: events.latitude,
        onlineUrl: events.onlineUrl,
        userId: events.userId,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.userId, users.id))
      .where(gte(events.startDate, new Date()))
      .orderBy(events.startDate)
      .limit(limit);
  },

  async getById(id: string): Promise<EventWithUser | undefined> {
    const result = await db
      .select({
        id: events.id,
        title: events.title,
        body: events.body,
        startDate: events.startDate,
        endDate: events.endDate,
        locationType: events.locationType,
        address: events.address,
        longitude: events.longitude,
        latitude: events.latitude,
        onlineUrl: events.onlineUrl,
        userId: events.userId,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.userId, users.id))
      .where(eq(events.id, id))
      .limit(1);

    return result[0];
  },

  async create(data: Omit<NewEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const result = await db.insert(events).values(data).returning();
    return result[0];
  },

  async update(id: string, data: Partial<Omit<NewEvent, 'id' | 'createdAt'>>): Promise<Event | undefined> {
    const result = await db
      .update(events)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();
    return result[0];
  },

  async delete(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  },
};
