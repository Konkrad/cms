import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import {
	type Demographics,
	db,
	getRootScope,
	lastMonths,
	type PeopleBreakdownResult,
	peopleBreakdowns,
	perMonth,
	type StatBucket,
	statisticsService,
} from "~/core";
import { events } from "../schema/events";
import { participationStatus } from "../schema/participation-status";
import { products } from "../schema/products";
import { ticketParticipants } from "../schema/ticket-participants";
import { tickets } from "../schema/tickets";
import { transactionItems } from "../schema/transaction-items";
import { transactions } from "../schema/transactions";

/**
 * Event statistics (aggregates only, server-only). "Came" = on a scanned ticket: a scan checks
 * in everyone on the ticket (its participants, or the buyer when it names none). Breakdowns of
 * people (age, gender, tier, home chapter) go through core's `statisticsService`, which hides
 * small groups; plain counts (orders, tickets, party sizes) are shown as they are, like the
 * attendance list the organizers already see.
 */

const DAY_MS = 86_400_000;
const CHUNK = 500;

/** One person on a scanned ticket: an account, or a companion without one (`userId` null). */
interface CheckedInPerson {
	eventId: string;
	transactionId: string;
	userId: string | null;
}

export interface EventStatistics {
	/** The event has ended: tickets not scanned by now are no-shows. */
	past: boolean;
	rsvp: { yes: number; maybe: number; no: number };
	paidOrders: number;
	ticketsIssued: number;
	ticketsScanned: number;
	/** People on issued tickets (seats), and on scanned ones (came). */
	peopleOnTickets: number;
	peopleCame: number;
	/** Of the people who came: companions without an account. */
	cameWithoutAccount: number;
	/** Orders of the people who came, by how many came on it. */
	party: { alone: number; plusOne: number; group: number };
	/** People with an account who came: first event ever, or came before. */
	firstTime: number;
	returning: number;
	whoCame: Demographics;
	homes: StatBucket[];
	/** Who came by what other modules know (e.g. qualifications); people with an account. */
	breakdowns: PeopleBreakdownResult[];
	/** Paid orders per product (tickets sold and revenue in EUR). */
	products: Array<{ name: string; sold: number; revenue: number }>;
}

export interface ScopeEventStatistics {
	/** Published events per month by start, the last 12 months. */
	eventsPerMonth: StatBucket[];
	/** People who came per month (by event start), the last 12 months. */
	attendeesPerMonth: StatBucket[];
	/** Tickets of ended events of the last 12 months: issued and scanned. */
	ticketsIssued: number;
	ticketsScanned: number;
	/**
	 * The scope's members by the last time they came to any event (anywhere): within 3, 6 or 12
	 * months, longer ago ("lost"), or never.
	 */
	lastCame: {
		within3Months: number;
		within6Months: number;
		within12Months: number;
		longerAgo: number;
		never: number;
	};
	/** The scope's members by which events they ever came to: chapter events, global (root) ones, both. */
	eventKinds: {
		chapterOnly: number;
		globalOnly: number;
		both: number;
		never: number;
	};
	/** The scope's members by how they took part: only in person, only online, both. */
	formats: {
		inPersonOnly: number;
		onlineOnly: number;
		both: number;
		never: number;
	};
	/** People with an account by how many of the subtree's events they came to (all time). */
	visits: { once: number; twoToFour: number; fivePlus: number };
	/** Who came to the subtree's events in the last 12 months. */
	whoCame: Demographics;
	homes: StatBucket[];
	breakdowns: PeopleBreakdownResult[];
}

async function inChunks<T>(
	ids: readonly string[],
	query: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
	const out: T[] = [];
	for (let i = 0; i < ids.length; i += CHUNK)
		out.push(...(await query(ids.slice(i, i + CHUNK))));
	return out;
}

/** Everyone on the scanned tickets of these events. */
async function checkedInPeople(
	eventIds: readonly string[],
): Promise<CheckedInPerson[]> {
	const rows = await inChunks(eventIds, (chunk) =>
		db
			.select({
				eventId: tickets.eventId,
				ticketId: tickets.id,
				transactionId: tickets.transactionId,
				buyerId: tickets.buyerId,
				participantId: ticketParticipants.id,
				participantUserId: ticketParticipants.userId,
			})
			.from(tickets)
			.leftJoin(ticketParticipants, eq(ticketParticipants.ticketId, tickets.id))
			.where(
				and(inArray(tickets.eventId, chunk), isNotNull(tickets.scannedAt)),
			),
	);
	return rows.map((r) => ({
		eventId: r.eventId,
		transactionId: r.transactionId,
		userId: r.participantId ? r.participantUserId : r.buyerId,
	}));
}

/** People on these tickets (participants, or 1 for a ticket that names none). */
async function seatsOf(ticketIds: readonly string[]): Promise<number> {
	const rows = await inChunks(ticketIds, (chunk) =>
		db
			.select({ ticketId: ticketParticipants.ticketId })
			.from(ticketParticipants)
			.where(inArray(ticketParticipants.ticketId, chunk)),
	);
	const named = new Map<string, number>();
	for (const r of rows) named.set(r.ticketId, (named.get(r.ticketId) ?? 0) + 1);
	return ticketIds.reduce((sum, id) => sum + (named.get(id) ?? 1), 0);
}

/**
 * Every event these people took part in, anywhere: its start, whether it is a global (root)
 * event and whether they took part online. In person = on a scanned ticket (in-person and hybrid
 * events). Online events have no door scan: a ticket or a "yes" counts as taking part.
 */
async function attendanceOf(
	userIds: readonly string[],
): Promise<
	Array<{ userId: string; startDate: string; global: boolean; online: boolean }>
> {
	const root = await getRootScope();
	const eventColumns = {
		startDate: events.startDate,
		scopeId: events.scopeId,
		locationType: events.locationType,
	};
	const asParticipant = await inChunks(userIds, (chunk) =>
		db
			.select({
				userId: ticketParticipants.userId,
				scannedAt: tickets.scannedAt,
				...eventColumns,
			})
			.from(ticketParticipants)
			.innerJoin(tickets, eq(tickets.id, ticketParticipants.ticketId))
			.innerJoin(events, eq(events.id, tickets.eventId))
			.where(inArray(ticketParticipants.userId, chunk)),
	);
	// A ticket that names no participants is the buyer's.
	const asBuyer = await inChunks(userIds, (chunk) =>
		db
			.select({
				userId: tickets.buyerId,
				scannedAt: tickets.scannedAt,
				...eventColumns,
			})
			.from(tickets)
			.innerJoin(events, eq(events.id, tickets.eventId))
			.leftJoin(ticketParticipants, eq(ticketParticipants.ticketId, tickets.id))
			.where(
				and(inArray(tickets.buyerId, chunk), isNull(ticketParticipants.id)),
			),
	);
	const saidYesOnline = await inChunks(userIds, (chunk) =>
		db
			.select({
				userId: participationStatus.userId,
				scannedAt: participationStatus.updatedAt,
				...eventColumns,
			})
			.from(participationStatus)
			.innerJoin(events, eq(events.id, participationStatus.eventId))
			.where(
				and(
					inArray(participationStatus.userId, chunk),
					eq(participationStatus.status, "yes"),
					eq(events.locationType, "online"),
				),
			),
	);
	return [...asParticipant, ...asBuyer, ...saidYesOnline].flatMap((r) => {
		const online = r.locationType === "online";
		if (!r.userId || (!online && !r.scannedAt)) return [];
		return [
			{
				userId: r.userId,
				startDate: r.startDate,
				global: r.scopeId === root?.id,
				online,
			},
		];
	});
}

function distinctUsers(people: CheckedInPerson[]): string[] {
	return [...new Set(people.flatMap((p) => (p.userId ? [p.userId] : [])))];
}

export const eventStatisticsService = {
	/** The statistics tab of one event, its home chapter = the event's scope. */
	async forEvent(
		event: { id: string; scopeId: string; startDate: string; endDate: string },
		now: Date = new Date(),
	): Promise<EventStatistics> {
		const [rsvpRows, eventTickets, paid, came, sales] = await Promise.all([
			db
				.select({ status: participationStatus.status })
				.from(participationStatus)
				.where(eq(participationStatus.eventId, event.id)),
			db
				.select({ id: tickets.id, scannedAt: tickets.scannedAt })
				.from(tickets)
				.where(eq(tickets.eventId, event.id)),
			db
				.select({ id: transactions.id })
				.from(transactions)
				.where(
					and(
						eq(transactions.eventId, event.id),
						eq(transactions.status, "paid"),
					),
				),
			checkedInPeople([event.id]),
			db
				.select({
					name: products.name,
					quantity: transactionItems.quantity,
					unitPrice: transactionItems.unitPrice,
				})
				.from(transactionItems)
				.innerJoin(
					transactions,
					eq(transactions.id, transactionItems.transactionId),
				)
				.innerJoin(products, eq(products.id, transactionItems.productId))
				.where(
					and(
						eq(transactions.eventId, event.id),
						eq(transactions.status, "paid"),
					),
				),
		]);

		const rsvp = { yes: 0, maybe: 0, no: 0 };
		for (const r of rsvpRows) rsvp[r.status]++;

		const perOrder = new Map<string, number>();
		for (const p of came)
			perOrder.set(p.transactionId, (perOrder.get(p.transactionId) ?? 0) + 1);
		const party = { alone: 0, plusOne: 0, group: 0 };
		for (const n of perOrder.values()) {
			if (n === 1) party.alone++;
			else if (n === 2) party.plusOne++;
			else party.group++;
		}

		const userIds = distinctUsers(came);
		const before = new Set(
			(
				await inChunks(userIds, (chunk) =>
					db
						.selectDistinct({ userId: tickets.buyerId })
						.from(tickets)
						.innerJoin(events, eq(events.id, tickets.eventId))
						.where(
							and(
								inArray(tickets.buyerId, chunk),
								isNotNull(tickets.scannedAt),
								lt(events.startDate, event.startDate),
							),
						),
				)
			).map((r) => r.userId),
		);
		const beforeAsCompanion = await inChunks(userIds, (chunk) =>
			db
				.selectDistinct({ userId: ticketParticipants.userId })
				.from(ticketParticipants)
				.innerJoin(tickets, eq(tickets.id, ticketParticipants.ticketId))
				.innerJoin(events, eq(events.id, tickets.eventId))
				.where(
					and(
						inArray(ticketParticipants.userId, chunk),
						isNotNull(tickets.scannedAt),
						lt(events.startDate, event.startDate),
					),
				),
		);
		for (const r of beforeAsCompanion) if (r.userId) before.add(r.userId);

		const byProduct = new Map<string, { sold: number; revenue: number }>();
		for (const s of sales) {
			const row = byProduct.get(s.name) ?? { sold: 0, revenue: 0 };
			row.sold += s.quantity;
			row.revenue += s.quantity * s.unitPrice;
			byProduct.set(s.name, row);
		}

		const [whoCame, homes, peopleOnTickets, breakdowns] = await Promise.all([
			statisticsService.demographicsOf(userIds, now),
			statisticsService.homesOf(userIds, event.scopeId),
			seatsOf(eventTickets.map((t) => t.id)),
			peopleBreakdowns(userIds),
		]);

		return {
			past: event.endDate < now.toISOString(),
			rsvp,
			paidOrders: paid.length,
			ticketsIssued: eventTickets.length,
			ticketsScanned: eventTickets.filter((t) => t.scannedAt).length,
			peopleOnTickets,
			peopleCame: came.length,
			cameWithoutAccount: came.filter((p) => !p.userId).length,
			party,
			firstTime: userIds.filter((id) => !before.has(id)).length,
			returning: userIds.filter((id) => before.has(id)).length,
			whoCame,
			homes,
			breakdowns,
			products: [...byProduct].map(([name, v]) => ({ name, ...v })),
		};
	},

	/** The events section of a scope's statistics page: the events of the scope and below. */
	async forScopes(
		scopeIds: readonly string[],
		homeScopeId: string,
		memberIds: readonly string[],
		now: Date = new Date(),
	): Promise<ScopeEventStatistics> {
		const months = lastMonths(now);
		const yearAgo = `${months[0]}-01`;
		const nowIso = now.toISOString();
		const scopeEvents = await inChunks(scopeIds, (chunk) =>
			db
				.select({
					id: events.id,
					startDate: events.startDate,
					endDate: events.endDate,
				})
				.from(events)
				.where(
					and(inArray(events.scopeId, chunk), eq(events.status, "published")),
				),
		);
		const startOf = new Map(scopeEvents.map((e) => [e.id, e.startDate]));
		const recent = scopeEvents.filter((e) => e.startDate >= yearAgo);
		const ended = recent.filter((e) => e.endDate < nowIso);

		const [came, endedTickets, memberAttendance] = await Promise.all([
			checkedInPeople(scopeEvents.map((e) => e.id)),
			inChunks(
				ended.map((e) => e.id),
				(chunk) =>
					db
						.select({ scannedAt: tickets.scannedAt })
						.from(tickets)
						.where(inArray(tickets.eventId, chunk)),
			),
			attendanceOf(memberIds),
		]);

		// Per member: the last event they took part in (that has started), which kinds, how.
		const monthsAgo = (n: number) =>
			new Date(now.getTime() - n * 30.44 * DAY_MS).toISOString();
		const lastStart = new Map<string, string>();
		const kinds = new Map<
			string,
			{ chapter: boolean; global: boolean; online: boolean; inPerson: boolean }
		>();
		for (const a of memberAttendance) {
			if (a.startDate > nowIso) continue;
			if ((lastStart.get(a.userId) ?? "") < a.startDate)
				lastStart.set(a.userId, a.startDate);
			const k = kinds.get(a.userId) ?? {
				chapter: false,
				global: false,
				online: false,
				inPerson: false,
			};
			if (a.global) k.global = true;
			else k.chapter = true;
			if (a.online) k.online = true;
			else k.inPerson = true;
			kinds.set(a.userId, k);
		}
		const lastCame = {
			within3Months: 0,
			within6Months: 0,
			within12Months: 0,
			longerAgo: 0,
			never: 0,
		};
		const eventKinds = { chapterOnly: 0, globalOnly: 0, both: 0, never: 0 };
		const formats = { inPersonOnly: 0, onlineOnly: 0, both: 0, never: 0 };
		for (const id of new Set(memberIds)) {
			const last = lastStart.get(id);
			if (!last) lastCame.never++;
			else if (last >= monthsAgo(3)) lastCame.within3Months++;
			else if (last >= monthsAgo(6)) lastCame.within6Months++;
			else if (last >= monthsAgo(12)) lastCame.within12Months++;
			else lastCame.longerAgo++;
			const k = kinds.get(id);
			if (!k) eventKinds.never++;
			else if (k.chapter && k.global) eventKinds.both++;
			else if (k.global) eventKinds.globalOnly++;
			else eventKinds.chapterOnly++;
			if (!k) formats.never++;
			else if (k.inPerson && k.online) formats.both++;
			else if (k.online) formats.onlineOnly++;
			else formats.inPersonOnly++;
		}

		const cameRecently = came.filter(
			(p) => (startOf.get(p.eventId) ?? "") >= yearAgo,
		);
		const eventsPerUser = new Map<string, Set<string>>();
		for (const p of came)
			if (p.userId)
				eventsPerUser.set(
					p.userId,
					(eventsPerUser.get(p.userId) ?? new Set()).add(p.eventId),
				);
		const visits = { once: 0, twoToFour: 0, fivePlus: 0 };
		for (const set of eventsPerUser.values()) {
			if (set.size === 1) visits.once++;
			else if (set.size < 5) visits.twoToFour++;
			else visits.fivePlus++;
		}

		const recentUsers = distinctUsers(cameRecently);
		const [whoCame, homes, breakdowns] = await Promise.all([
			statisticsService.demographicsOf(recentUsers, now),
			statisticsService.homesOf(recentUsers, homeScopeId),
			peopleBreakdowns(recentUsers),
		]);

		return {
			eventsPerMonth: perMonth(
				recent.map((e) => e.startDate),
				months,
			),
			attendeesPerMonth: perMonth(
				cameRecently.map((p) => startOf.get(p.eventId)),
				months,
			),
			ticketsIssued: endedTickets.length,
			ticketsScanned: endedTickets.filter((t) => t.scannedAt).length,
			lastCame,
			eventKinds,
			formats,
			visits,
			whoCame,
			homes,
			breakdowns,
		};
	},
};
