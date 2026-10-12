import { and, desc, eq, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import {
	type ContentFilter,
	createCursorFromItem,
	db,
	decodeCursor,
	formatDate,
	getNextCursorFromRows,
	isMember,
	type PublicUser,
	publicUserColumns,
	slugify,
	uniqueSlug,
} from "~/core";
import { users as usersTable } from "~/core/schema";
import type {
	Event,
	EventStatus,
	InsertEvent,
	UpdateEvent,
} from "../schema/events";
import { events, insertEventSchema, updateEventSchema } from "../schema/events";

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
				// Draft and in-review events are not public (spec 5.2).
				status: "published",
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

	/** The upcoming events a listing shows (`scopeContentFilter`), soonest first. */
	async getUpcoming(filter: ContentFilter, limit?: number): Promise<Event[]> {
		const now = new Date().toISOString();

		return db.query.events.findMany({
			where: {
				endDate: { gte: now },
				deletedAt: { isNull: true },
				// Draft and in-review events are not public (spec 5.2).
				status: "published",
				RAW: (t) => filter.where(t),
			},
			orderBy: { startDate: "asc", id: "asc" },
			limit,
		});
	},

	async getUpcomingInitial(
		filter: ContentFilter,
		baseLimit: number = 3,
	): Promise<{ items: Event[]; nextCursor: string | null }> {
		const now = new Date().toISOString();
		const rows = await db.query.events.findMany({
			where: {
				endDate: { gte: now },
				deletedAt: { isNull: true },
				// Draft and in-review events are not public (spec 5.2).
				status: "published",
				RAW: (t) => filter.where(t),
			},
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
		filter: ContentFilter,
		cursor: string,
		limit: number = 10,
	): Promise<{ items: Event[]; nextCursor: string | null }> {
		const now = new Date().toISOString();
		const cursorObj = decodeCursor(cursor);

		const rows = await db.query.events.findMany({
			where: {
				endDate: { gte: now },
				deletedAt: { isNull: true },
				// Draft and in-review events are not public (spec 5.2).
				status: "published",
				RAW: (t) => filter.where(t),
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
		filter: ContentFilter,
		limit: number = 10,
		cursor?: string | null,
	): Promise<{ items: Event[]; nextCursor: string | null }> {
		const now = new Date().toISOString();
		const cursorObj = decodeCursor(cursor ?? null);

		const rows = await db.query.events.findMany({
			where: {
				endDate: { lt: now },
				deletedAt: { isNull: true },
				// Draft and in-review events are not public (spec 5.2).
				status: "published",
				RAW: (t) => filter.where(t),
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
		const slug = await this.freeSlug(
			parsed.scopeId,
			slugify(parsed.slug || parsed.title) || "event",
		);
		const [result] = await db
			.insert(events)
			.values({ ...parsed, slug } as any)
			.returning();

		return result;
	},

	/** `base`, or `base-2`, … : the first slug no event of the scope has (deleted ones included). */
	async freeSlug(scopeId: string, base: string): Promise<string> {
		return uniqueSlug(base, async (slug) =>
			Boolean(
				await db.query.events.findFirst({
					where: { scopeId, slug },
					columns: { id: true },
				}),
			),
		);
	},

	/**
	 * The id of the event a URL names in a scope: the scope's event with that slug, else the
	 * event with that id (old `/events/<id>` links), else the only event anywhere with that
	 * slug. The page then redirects to the canonical URL. Deleted events are not found.
	 */
	async findByParam(scopeId: string, param: string): Promise<string | null> {
		const live = { deletedAt: { isNull: true as const } };
		const inScope = await db.query.events.findFirst({
			where: { scopeId, slug: param, ...live },
			columns: { id: true },
		});
		if (inScope) return inScope.id;
		const byId = await db.query.events.findFirst({
			where: { id: param, ...live },
			columns: { id: true },
		});
		if (byId) return byId.id;
		const bySlug = await db.query.events.findMany({
			where: { slug: param, ...live },
			columns: { id: true },
			limit: 2,
		});
		return bySlug.length === 1 ? bySlug[0].id : null;
	},

	/** Owning scope and slug of the live events with these ids (reference resolution). */
	async locate(ids: readonly string[]): Promise<
		Array<{
			id: string;
			scopeId: string;
			slug: string;
			title: string;
			visibility: string;
		}>
	> {
		if (!ids.length) return [];
		return db
			.select({
				id: events.id,
				scopeId: events.scopeId,
				slug: events.slug,
				title: events.title,
				visibility: events.visibility,
			})
			.from(events)
			.where(and(inArray(events.id, [...ids]), isNull(events.deletedAt)));
	},

	/** Public live events whose title contains `query`, latest first (admin link picker). */
	async searchPublic(
		query: string,
		limit: number,
	): Promise<
		Array<{ id: string; scopeId: string; slug: string; title: string }>
	> {
		return db
			.select({
				id: events.id,
				scopeId: events.scopeId,
				slug: events.slug,
				title: events.title,
			})
			.from(events)
			.where(
				and(
					isNull(events.deletedAt),
					eq(events.status, "published"),
					eq(events.visibility, "public"),
					like(events.title, `%${query}%`),
				),
			)
			.orderBy(desc(events.startDate))
			.limit(limit);
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
				reason: `Sales open on ${formatDate(earliestStart)} at ${formatDate(earliestStart, "time")}`,
			};
		}

		// Otherwise, sales are considered closed for the event
		return { valid: false, reason: "Sales have closed for this event" };
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
					status: events.status,
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
				status: e.status,
				organizerName: `${e.userName ?? ""} ${e.userFamilyName ?? ""}`.trim(),
			})),
		};
	},

	/** Sets the review state (spec 5.2): draft, in_review or published. */
	async setStatus(id: string, status: EventStatus): Promise<Event | undefined> {
		const [result] = await db
			.update(events)
			.set({ status, updatedAt: new Date().toISOString() })
			.where(eq(events.id, id))
			.returning();
		return result;
	},

	/** Whether to post an announcement note when the proposal is approved. */
	async setAnnounceOnApproval(id: string, announce: boolean): Promise<void> {
		await db
			.update(events)
			.set({ announceOnApproval: announce })
			.where(eq(events.id, id));
	},

	/** Records the announcement note, unless one was recorded before (returns whether it was). */
	async setAnnouncementNote(id: string, noteId: string): Promise<boolean> {
		const updated = await db
			.update(events)
			.set({ announcementNoteId: noteId })
			.where(and(eq(events.id, id), isNull(events.announcementNoteId)))
			.returning({ id: events.id });
		return updated.length === 1;
	},

	/**
	 * Published events that ended and may need a debrief request (spec 5.2): not asked yet and
	 * ended after `since`, or asked before `remindBefore` and not reminded yet.
	 */
	async listDebriefCandidates(now: Date, since: Date, remindBefore: Date) {
		return db
			.select({
				id: events.id,
				scopeId: events.scopeId,
				userId: events.userId,
				title: events.title,
				endDate: events.endDate,
				debriefRequestedAt: events.debriefRequestedAt,
				debriefRemindedAt: events.debriefRemindedAt,
			})
			.from(events)
			.where(
				and(
					isNull(events.deletedAt),
					eq(events.status, "published"),
					lt(events.endDate, now.toISOString()),
					or(
						and(
							isNull(events.debriefRequestedAt),
							sql`${events.endDate} >= ${since.toISOString()}`,
						),
						and(
							lt(events.debriefRequestedAt, remindBefore.toISOString()),
							isNull(events.debriefRemindedAt),
						),
					),
				),
			);
	},

	/** Marks the debrief as requested; false when it already was (another run got there first). */
	async claimDebriefRequest(id: string, now: Date): Promise<boolean> {
		const updated = await db
			.update(events)
			.set({ debriefRequestedAt: now.toISOString() })
			.where(and(eq(events.id, id), isNull(events.debriefRequestedAt)))
			.returning({ id: events.id });
		return updated.length === 1;
	},

	/** Marks the one debrief reminder as sent; false when it already was. */
	async claimDebriefReminder(id: string, now: Date): Promise<boolean> {
		const updated = await db
			.update(events)
			.set({ debriefRemindedAt: now.toISOString() })
			.where(and(eq(events.id, id), isNull(events.debriefRemindedAt)))
			.returning({ id: events.id });
		return updated.length === 1;
	},

	/** Events whose debrief was requested before `before` (in these scopes, null = all). */
	async listDebriefsRequestedBefore(scopeIds: string[] | null, before: Date) {
		return db
			.select({
				id: events.id,
				scopeId: events.scopeId,
				title: events.title,
				endDate: events.endDate,
				debriefRequestedAt: events.debriefRequestedAt,
			})
			.from(events)
			.where(
				and(
					isNull(events.deletedAt),
					scopeIds ? inArray(events.scopeId, scopeIds) : undefined,
					lt(events.debriefRequestedAt, before.toISOString()),
				),
			)
			.orderBy(events.endDate);
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

	async countPastByScopeId(scopeId: string): Promise<number> {
		const now = new Date().toISOString();
		const [row] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(events)
			.where(
				and(
					eq(events.scopeId, scopeId),
					isNull(events.deletedAt),
					eq(events.status, "published"),
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
