import {
	and,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	like,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import {
	createCursorFromItem,
	db,
	decodeCursor,
	getNextCursorFromRows,
	isMember,
	type PublicUser,
	publicUserColumns,
	publicUserSelect,
	viewableMemberScopes,
} from "~/core";
import { users as usersTable } from "~/core/schema";
import type { Event, InsertEvent, UpdateEvent } from "../schema/events";
import { events, insertEventSchema, updateEventSchema } from "../schema/events";
import { inventoryGroups } from "../schema/inventory-groups";
import { products } from "../schema/products";

/** An event with its organizer's public identity (never the organizer's email or profile row). */
export type EventWithUser = Event & {
	user: PublicUser;
};

export const eventsService = {
	async getAll(
		limit: number = 10,
		cursor?: string | null,
	): Promise<{ items: EventWithUser[]; nextCursor?: string | null }> {
		const cursorObj = decodeCursor(cursor ?? null);

		const results = await db.query.events.findMany({
			with: {
				user: { columns: publicUserColumns },
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

		let nextCursor: string | undefined | null;
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

	async getUpcomingInitial(
		baseLimit: number = 3,
	): Promise<{ items: Event[]; nextCursor: string | null }> {
		const now = new Date().toISOString();
		const rows = await db.query.events.findMany({
			where: { endDate: { gte: now }, deletedAt: { isNull: true } },
			orderBy: { startDate: "asc", id: "asc" },
			limit: baseLimit + 10,
		});

		let cutoff = Math.min(baseLimit, rows.length);
		if (rows.length >= baseLimit) {
			const lastDay = rows[baseLimit - 1].startDate.slice(0, 10);
			while (
				cutoff < rows.length &&
				rows[cutoff].startDate.slice(0, 10) === lastDay
			) {
				cutoff++;
			}
		}

		const items = rows.slice(0, cutoff);
		const nextCursor =
			cutoff < rows.length
				? createCursorFromItem(items[items.length - 1], ["startDate"])
				: null;

		return { items, nextCursor };
	},

	async getUpcomingFrom(
		cursor: string,
		limit: number = 10,
	): Promise<{ items: Event[]; nextCursor: string | null }> {
		const now = new Date().toISOString();
		const cursorObj = decodeCursor(cursor);

		const rows = await db.query.events.findMany({
			where: {
				endDate: { gte: now },
				deletedAt: { isNull: true },
				...(cursorObj?.startDate
					? { startDate: { gt: cursorObj.startDate } }
					: {}),
			},
			orderBy: { startDate: "asc", id: "asc" },
			limit: limit + 1,
		});

		const nextCursor =
			getNextCursorFromRows(rows, ["startDate"], limit) ?? null;
		return { items: rows.slice(0, limit), nextCursor };
	},

	async getPastPaged(
		limit: number = 10,
		cursor?: string | null,
	): Promise<{ items: Event[]; nextCursor: string | null }> {
		const now = new Date().toISOString();
		const cursorObj = decodeCursor(cursor ?? null);

		const rows = await db.query.events.findMany({
			where: {
				endDate: { lt: now },
				deletedAt: { isNull: true },
				...(cursorObj?.startDate
					? { startDate: { lt: cursorObj.startDate } }
					: {}),
			},
			orderBy: { startDate: "desc", id: "desc" },
			limit: limit + 1,
		});

		const nextCursor =
			getNextCursorFromRows(rows, ["startDate"], limit) ?? null;
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
		const result = (await db.query.events.findFirst({
			where: {
				id,
				deletedAt: { isNull: true },
			},
			with: {
				user: { columns: publicUserColumns },
			},
		})) as any;

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
		const groups = (await db.query.inventoryGroups.findMany({
			where: { eventId: event.id },
			with: { products: true },
		})) as any[];

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

		// Group-only events of the scopes whose members-only items the viewer may see.
		const visible = await viewableMemberScopes(userId ? { id: userId } : null);
		const visibilityCondition: SQL | undefined =
			visible.ids.length > 0
				? or(
						eq(events.visibility, "public"),
						and(
							eq(events.visibility, "members"),
							visible.includesRoot
								? or(
										inArray(events.scopeId, visible.ids),
										isNull(events.scopeId),
									)
								: inArray(events.scopeId, visible.ids),
						),
					)
				: eq(events.visibility, "public");

		const results = await db
			.select({ event: events, user: publicUserSelect })
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

		let nextCursor: string | undefined | null;
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
			items: items.map((row) => ({
				...row.event,
				user: row.user,
			})) as EventWithUser[],
			nextCursor: nextCursor ?? null,
		};
	},

	/** Admin event list (title/city search; `scopeIds` limits it to those scopes, null = all). */
	async adminList({
		scopeIds,
		search,
		limit,
		offset,
	}: {
		scopeIds: string[] | null;
		search: string;
		limit: number;
		offset: number;
	}) {
		const where = and(
			isNull(events.deletedAt),
			scopeIds ? inArray(events.scopeId, scopeIds) : undefined,
			search
				? or(
						like(events.title, `%${search}%`),
						like(events.city, `%${search}%`),
					)
				: undefined,
		);
		const [countRows, rows] = await Promise.all([
			db.select({ total: sql<number>`COUNT(*)` }).from(events).where(where),
			db
				.select({
					id: events.id,
					title: events.title,
					startDate: events.startDate,
					visibility: events.visibility,
					userName: usersTable.name,
					userFamilyName: usersTable.familyName,
				})
				.from(events)
				.leftJoin(usersTable, eq(events.userId, usersTable.id))
				.where(where)
				.orderBy(desc(events.startDate))
				.limit(limit)
				.offset(offset),
		]);
		return {
			total: Number(countRows[0]?.total ?? 0),
			items: rows.map((e) => ({
				id: e.id,
				title: e.title,
				startDate: e.startDate,
				visibility: e.visibility,
				organizerName: `${e.userName ?? ""} ${e.userFamilyName ?? ""}`.trim(),
			})),
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

	/** The scope's next events, soonest first; members-only ones only when `includeGroupOnly`. */
	async getUpcomingByScopeId(
		scopeId: string,
		options: { includeGroupOnly: boolean; limit: number },
	): Promise<Event[]> {
		const now = new Date().toISOString();
		return db.query.events.findMany({
			where: {
				scopeId,
				deletedAt: { isNull: true },
				endDate: { gte: now },
				...(options.includeGroupOnly ? {} : { visibility: "public" }),
			},
			orderBy: { startDate: "asc" },
			limit: options.limit,
		});
	},

	async countPastByScopeId(scopeId: string): Promise<number> {
		const now = new Date().toISOString();
		const [row] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(events)
			.where(
				and(
					eq(events.scopeId, scopeId),
					isNull(events.deletedAt),
					lt(events.endDate, now),
				),
			);
		return Number(row?.count ?? 0);
	},

	/** Events (deleted ones included: their rows still reference the scope) owned by a scope. */
	async countByScopeId(scopeId: string): Promise<number> {
		const [row] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(events)
			.where(eq(events.scopeId, scopeId));
		return Number(row?.count ?? 0);
	},

	async joinEvent(
		userId: string,
		eventId: string,
	): Promise<{ success: boolean; error?: string }> {
		const event = await this.getById(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		if (event.scopeId) {
			const member = await isMember({ id: userId }, event.scopeId);
			if (!member) {
				return {
					success: false,
					error: "You must be a member of this group to join this event",
				};
			}
		}

		return { success: true };
	},
};
