import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "~/db/connection";
import type { Event, NewEvent } from "~/db/schemas/events";
import { events } from "~/db/schemas/events";
import type { User } from "~/db/schemas/users";
import { users } from "~/db/schemas/users";

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
	async getAll(filters?: {
		userId?: string;
		locationType?: string;
		upcoming?: boolean;
	}): Promise<EventWithUser[]> {
		const whereClause = [];
		if (filters?.userId) {
			whereClause.push(eq(events.userId, filters.userId));
		}
		if (filters?.locationType) {
			whereClause.push(eq(events.locationType, filters.locationType));
		}
		if (filters?.upcoming) {
			whereClause.push(gte(events.startDate, new Date().toISOString()));
		}

		const eventRows = await db
			.select()
			.from(events)
			.where(whereClause.length ? and(...whereClause) : undefined)
			.orderBy(desc(events.startDate));

		// Fetch users for all events in one go
		const userIds = Array.from(new Set(eventRows.map((e) => e.userId)));
		const userRows = userIds.length
			? await db.select().from(users).where(users.id.in(userIds))
			: [];

		const userMap = new Map(userRows.map((u) => [u.id, u]));

		return eventRows.map((event) =>
			mapEventWithUser(event, userMap.get(event.userId)),
		);
	},

	async getUpcoming(limit: number = 3): Promise<EventWithUser[]> {
		const eventRows = await db
			.select()
			.from(events)
			.where(gte(events.startDate, new Date().toISOString()))
			.orderBy(asc(events.startDate))
			.limit(limit);

		const userIds = Array.from(new Set(eventRows.map((e) => e.userId)));
		const userRows = userIds.length
			? await db.select().from(users).where(users.id.in(userIds))
			: [];

		const userMap = new Map(userRows.map((u) => [u.id, u]));

		return eventRows.map((event) =>
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
