import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { peopleBreakdowns } from "~/core/registry/statistics";
import { statisticsService } from "~/core/statistics/statistics.service";
import { suppressCount, suppressSmall } from "~/core/statistics/suppress";
import { eventStatisticsService } from "~/modules/events/services/statistics";
import { qualificationsService } from "~/modules/qualifications/service";
import {
	createTestEvent,
	createTestParticipation,
	createTestQualification,
	createTestQualificationType,
	createTestUser,
	ensureRootScope,
	openDb,
} from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
	for (const fn of cleanups.splice(0).reverse()) fn();
});

function user(profile: { birthPeriod?: number; sex?: string } = {}) {
	const u = createTestUser();
	const db = openDb();
	db.prepare("UPDATE users SET birth_period = ?, sex = ? WHERE id = ?").run(
		profile.birthPeriod ?? null,
		profile.sex ?? null,
		u.userId,
	);
	db.close();
	cleanups.push(u.cleanup);
	return u.userId;
}

/** A paid order of one ticket for `people` (the first is the buyer; null = no account). */
function order(
	eventId: string,
	buyerId: string,
	people: Array<string | null>,
	scanned: boolean,
) {
	const db = openDb();
	const groupId = crypto.randomUUID();
	const productId = crypto.randomUUID();
	const transactionId = crypto.randomUUID();
	const ticketId = crypto.randomUUID();
	db.prepare(
		`INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
	).run(groupId, eventId, "General", 100, 1);
	db.prepare(
		`INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		productId,
		eventId,
		groupId,
		`Ticket ${people.length}`,
		10,
		10,
		people.length,
		"[]",
	);
	db.prepare(
		`INSERT INTO transactions (id, user_id, event_id, total_amount, transaction_fee, status)
     VALUES (?, ?, ?, 10, 0, 'paid')`,
	).run(transactionId, buyerId, eventId);
	db.prepare(
		`INSERT INTO transaction_items (id, transaction_id, product_id, quantity, unit_price)
     VALUES (?, ?, ?, 1, 10)`,
	).run(crypto.randomUUID(), transactionId, productId);
	db.prepare(
		`INSERT INTO tickets (id, qr_code_uuid, transaction_id, product_id, event_id, buyer_id, scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		ticketId,
		crypto.randomUUID(),
		transactionId,
		productId,
		eventId,
		buyerId,
		scanned ? new Date().toISOString() : null,
	);
	people.forEach((userId, i) => {
		db.prepare(
			`INSERT INTO ticket_participants (id, ticket_id, participant_order, name, email, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
		).run(
			crypto.randomUUID(),
			ticketId,
			i + 1,
			"Person",
			`p${i}-${ticketId}@example.com`,
			userId,
		);
	});
	db.close();
	cleanups.push(() => {
		const db2 = openDb();
		db2
			.prepare("DELETE FROM ticket_participants WHERE ticket_id = ?")
			.run(ticketId);
		db2.prepare("DELETE FROM tickets WHERE id = ?").run(ticketId);
		db2
			.prepare("DELETE FROM transaction_items WHERE transaction_id = ?")
			.run(transactionId);
		db2.prepare("DELETE FROM transactions WHERE id = ?").run(transactionId);
		db2.prepare("DELETE FROM products WHERE id = ?").run(productId);
		db2.prepare("DELETE FROM inventory_groups WHERE id = ?").run(groupId);
		db2.close();
	});
}

describe("suppressSmall", () => {
	it("hides groups of 1 to 4 and keeps 0 and 5+", () => {
		expect(
			suppressSmall([
				{ key: "a", count: 0 },
				{ key: "b", count: 3 },
				{ key: "c", count: 4 },
				{ key: "d", count: 7 },
			]),
		).toEqual([
			{ key: "a", count: 0 },
			{ key: "b", count: null },
			{ key: "c", count: null },
			{ key: "d", count: 7 },
		]);
	});

	it("hides the next smallest group when only one would be hidden", () => {
		expect(
			suppressSmall([
				{ key: "a", count: 2 },
				{ key: "b", count: 9 },
				{ key: "c", count: 6 },
			]).map((b) => b.count),
		).toEqual([null, 9, null]);
	});

	it("hides a small headline figure", () => {
		expect(suppressCount(3)).toBeNull();
		expect(suppressCount(0)).toBe(0);
		expect(suppressCount(5)).toBe(5);
	});
});

describe("statisticsService.demographicsOf", () => {
	it("counts birth periods, gender and tier, hiding small groups", async () => {
		const ids = [
			...Array.from({ length: 5 }, () =>
				user({ birthPeriod: 1995, sex: "female" }),
			),
			...Array.from({ length: 6 }, () =>
				user({ birthPeriod: 1980, sex: "male" }),
			),
			user({ sex: "other" }),
		];
		const d = await statisticsService.demographicsOf(ids);
		expect(d.people).toBe(12);
		const count = (list: typeof d.birthPeriods, key: string) =>
			list.find((b) => b.key === key)?.count;
		// Oldest period first, then "unknown".
		expect(d.birthPeriods.map((b) => b.key)).toEqual([
			"1980",
			"1995",
			"unknown",
		]);
		expect(count(d.birthPeriods, "1980")).toBe(6);
		// One person without a birth period: hidden, and so is the next smallest group
		// (else it could be worked out from the total).
		expect(count(d.birthPeriods, "unknown")).toBeNull();
		expect(count(d.birthPeriods, "1995")).toBeNull();
		expect(count(d.gender, "other")).toBeNull();
		expect(count(d.gender, "female")).toBeNull();
		expect(count(d.gender, "male")).toBe(6);
		expect(count(d.tier, "none")).toBe(12);
	});
});

describe("statisticsService.demographicsOf: where people live", () => {
	it("names places with 5 or more people and merges the rest", async () => {
		const place = (city: string | null, country: string | null) => {
			const id = user();
			const db = openDb();
			db.prepare("UPDATE users SET city = ?, country = ? WHERE id = ?").run(
				city,
				country,
				id,
			);
			db.close();
			return id;
		};
		const ids = [
			...Array.from({ length: 6 }, () => place("Berlin", "Germany")),
			...Array.from({ length: 5 }, () => place("Paris", "France")),
			place("Vienna", "Austria"),
			place(null, null),
		];
		const d = await statisticsService.demographicsOf(ids);
		const count = (list: typeof d.countries, key: string) =>
			list.find((b) => b.key === key)?.count;
		expect(count(d.countries, "Germany")).toBe(6);
		expect(count(d.countries, "France")).toBe(5);
		// Austria has one person: not named, merged into "other" (which names no place, so its
		// count is exact, like "not given").
		expect(d.countries.some((b) => b.key === "Austria")).toBe(false);
		expect(d.countries.find((b) => b.key === "other")).toEqual({
			key: "other",
			count: 1,
			groups: 1,
		});
		expect(count(d.countries, "unknown")).toBe(1);
		expect(d.countryCount).toBe(3);
		expect(count(d.cities, "Berlin, Germany")).toBe(6);
		expect(count(d.cities, "Paris, France")).toBe(5);
	});
});

describe("eventStatisticsService.forEvent", () => {
	it("counts who came, with whom, and who came before", async () => {
		const organizer = user();
		const a = user();
		const c = user();
		const d = user();
		const scopeId = ensureRootScope();

		const earlier = createTestEvent(organizer, {
			startDate: new Date(Date.now() - 40 * 86400000).toISOString(),
			endDate: new Date(Date.now() - 39 * 86400000).toISOString(),
		});
		cleanups.push(earlier.cleanup);
		order(earlier.eventId, c, [c], true);

		const { eventId } = createTestEvent(organizer);
		order(eventId, a, [a, null], true); // A with a companion without an account
		order(eventId, c, [c], true); // C alone, came before
		order(eventId, d, [d], false); // D never scanned

		const db = openDb();
		const event = db
			.prepare("SELECT start_date, end_date FROM events WHERE id = ?")
			.get(eventId) as { start_date: string; end_date: string };
		db.close();

		const s = await eventStatisticsService.forEvent({
			id: eventId,
			scopeId,
			startDate: event.start_date,
			endDate: event.end_date,
		});
		expect(s.past).toBe(true);
		expect(s.paidOrders).toBe(3);
		expect(s.ticketsIssued).toBe(3);
		expect(s.ticketsScanned).toBe(2);
		expect(s.peopleOnTickets).toBe(4);
		expect(s.peopleCame).toBe(3);
		expect(s.cameWithoutAccount).toBe(1);
		expect(s.party).toEqual({ alone: 1, plusOne: 1, group: 0 });
		// A came for the first time; C came before (how engaged depends on the other events).
		expect(s.history.firstTime).toBe(1);
		expect(
			s.history.new +
				s.history.cameBack +
				s.history.occasional +
				s.history.regular +
				s.history.core,
		).toBe(1);
		expect(s.products.reduce((sum, p) => sum + p.revenue, 0)).toBe(30);
		// The output carries no person, only counts.
		expect(JSON.stringify(s)).not.toContain(a);
	});

	it("sorts members into chapter or global events", async () => {
		const organizer = user();
		const active = user();
		const lost = user();
		const never = user();
		const root = ensureRootScope();
		const chapterId = crypto.randomUUID();
		const db = openDb();
		db.prepare(
			"INSERT INTO scopes (id, parent_id, kind, slug, name, path) VALUES (?, ?, 'chapter', ?, ?, ?)",
		).run(chapterId, root, `c-${chapterId}`, "Chapter", `/c-${chapterId}`);
		db.close();
		cleanups.push(() => {
			const db2 = openDb();
			db2.prepare("DELETE FROM scopes WHERE id = ?").run(chapterId);
			db2.close();
		});
		const day = 86400000;
		const recentChapter = createTestEvent(organizer, { scopeId: chapterId });
		const recentGlobal = createTestEvent(organizer, {
			startDate: new Date(Date.now() - 20 * day).toISOString(),
			endDate: new Date(Date.now() - 19 * day).toISOString(),
		});
		const oldChapter = createTestEvent(organizer, {
			scopeId: chapterId,
			startDate: new Date(Date.now() - 250 * day).toISOString(),
			endDate: new Date(Date.now() - 249 * day).toISOString(),
		});
		cleanups.push(
			recentChapter.cleanup,
			recentGlobal.cleanup,
			oldChapter.cleanup,
		);
		order(recentChapter.eventId, active, [active], true);
		order(recentGlobal.eventId, active, [active], true);
		order(oldChapter.eventId, lost, [lost], true);
		order(recentChapter.eventId, never, [never], false); // ticket never scanned

		const s = await eventStatisticsService.forScopes([chapterId], chapterId, [
			active,
			lost,
			never,
		]);
		expect(s.eventKinds).toEqual({
			chapterOnly: 1,
			globalOnly: 0,
			both: 1,
			never: 1,
		});
	});

	it("rates engagement against the last events a member could attend", async () => {
		// In the year 2000, so the events of other tests (all recent) stay out of it.
		const organizer = user();
		const [core, regular, occasional, lost, newcomer, never] = [
			user(),
			user(),
			user(),
			user(),
			user(),
			user(),
		];
		const root = ensureRootScope();
		const chapterId = crypto.randomUUID();
		const db = openDb();
		db.prepare(
			"INSERT INTO scopes (id, parent_id, kind, slug, name, path) VALUES (?, ?, 'chapter', ?, ?, ?)",
		).run(chapterId, root, `c-${chapterId}`, "Chapter", `/c-${chapterId}`);
		for (const id of [core, regular, occasional, lost, newcomer, never]) {
			db.prepare("UPDATE users SET created_at = ? WHERE id = ?").run(
				// The newcomer joined before the last two events only.
				id === newcomer
					? "2000-06-01T00:00:00.000Z"
					: "1997-01-01T00:00:00.000Z",
				id,
			);
			db.prepare(
				"INSERT INTO scope_memberships (user_id, scope_id) VALUES (?, ?)",
			).run(id, chapterId);
		}
		db.close();
		cleanups.push(() => {
			const db2 = openDb();
			db2.prepare("DELETE FROM scopes WHERE id = ?").run(chapterId);
			db2.close();
		});
		const at = (iso: string) => ({
			scopeId: chapterId,
			startDate: iso,
			endDate: iso,
		});
		// One event in 1998, then 13 in 2000: the last 12 leave the 1998 one out.
		const old = createTestEvent(organizer, at("1998-06-01T18:00:00.000Z"));
		const recent = Array.from({ length: 13 }, (_, i) =>
			createTestEvent(
				organizer,
				at(new Date(Date.UTC(2000, 0, 1 + i * 14, 18)).toISOString()),
			),
		);
		cleanups.push(old.cleanup, ...recent.map((e) => e.cleanup));
		const sql = openDb();
		for (const e of [old, ...recent])
			sql
				.prepare("UPDATE events SET status = 'published' WHERE id = ?")
				.run(e.eventId);
		sql.close();
		// Core: 7 of the last 12 (58%); regular: 3 (25%); occasional: 1; lost: only in 1998.
		recent.slice(6).forEach((e) => {
			order(e.eventId, core, [core], true);
		});
		recent.slice(10).forEach((e) => {
			order(e.eventId, regular, [regular], true);
		});
		order(recent[12].eventId, occasional, [occasional], true);
		order(old.eventId, lost, [lost], true);
		order(recent[12].eventId, newcomer, [newcomer], true);

		const s = await eventStatisticsService.forScopes(
			[chapterId],
			chapterId,
			[core, regular, occasional, lost, newcomer, never],
			new Date("2001-01-01T00:00:00.000Z"),
		);
		expect(s.engagement).toEqual({
			core: 1,
			regular: 1,
			occasional: 1,
			lost: 1,
			new: 1,
			never: 1,
		});
		// Compared from the root, the chapter is ranked with its own numbers (Feb 2000 to Jan 2001:
		// 10 of its events, the 3 in January are older; 12 people came; core and regular are engaged).
		const fromRoot = await eventStatisticsService.ranking(
			root,
			"leaves",
			new Date("2001-01-01T00:00:00.000Z"),
		);
		expect(fromRoot.find((c) => c.id === chapterId)).toMatchObject({
			name: "Chapter",
			members: 6,
			events: 10,
			came: 12,
			engaged: 2,
			parentName: null,
		});
		// Directly below the root too, so "one level below" lists it the same way.
		const children = await eventStatisticsService.ranking(
			root,
			"children",
			new Date("2001-01-01T00:00:00.000Z"),
		);
		expect(children.find((c) => c.id === chapterId)?.came).toBe(12);
		expect(s.engagementRule).toEqual({
			window: 12,
			corePercent: 50,
			regularPercent: 25,
			minEvents: 4,
		});
	});

	it("counts a yes to an online event as taking part online", async () => {
		const organizer = user();
		const onlineOnly = user();
		const mixed = user();
		const online = createTestEvent(organizer, { locationType: "online" });
		const inPerson = createTestEvent(organizer);
		cleanups.push(online.cleanup, inPerson.cleanup);
		createTestParticipation(onlineOnly, online.eventId, "yes");
		order(online.eventId, mixed, [mixed], false); // online: no scan needed
		order(inPerson.eventId, mixed, [mixed], true);

		const s = await eventStatisticsService.forScopes(
			[ensureRootScope()],
			ensureRootScope(),
			[onlineOnly, mixed],
		);
		expect(s.formats).toEqual({
			inPersonOnly: 0,
			onlineOnly: 1,
			both: 1,
			never: 0,
		});
	});

	it("summarizes a scope's events", async () => {
		const organizer = user();
		const a = user();
		const { eventId } = createTestEvent(organizer, { status: "published" });
		const db = openDb();
		db.prepare("UPDATE events SET status = 'published' WHERE id = ?").run(
			eventId,
		);
		db.close();
		order(eventId, a, [a], true);
		const s = await eventStatisticsService.forScopes(
			[ensureRootScope()],
			ensureRootScope(),
			[a],
		);
		expect(s.ticketsScanned).toBeGreaterThanOrEqual(1);
		expect(s.engagement.never).toBe(0);
		expect(s.eventKinds.globalOnly).toBe(1);
		expect(
			s.attendeesPerMonth.reduce((sum, b) => sum + (b.count ?? 0), 0),
		).toBeGreaterThanOrEqual(1);
	});
});

describe("statistics by qualification", () => {
	it("counts approved holders per type and people with none", async () => {
		const batch2019 = createTestQualificationType({ label: "Graduate 2019" });
		const batch2020 = createTestQualificationType({ label: "Graduate 2020" });
		cleanups.push(batch2019.cleanup, batch2020.cleanup);
		const people = Array.from({ length: 12 }, () => user());
		people.slice(0, 6).forEach((id) => {
			createTestQualification(id, batch2019.typeId, { status: "approved" });
		});
		createTestQualification(people[6], batch2020.typeId, {
			status: "approved",
		});
		createTestQualification(people[7], batch2020.typeId); // pending: not counted

		const groups = await qualificationsService.countHoldersByType(people);
		const count = (label: string) =>
			groups.find((g) => g.label === label)?.count;
		expect(count("Graduate 2019")).toBe(6);
		expect(count("Graduate 2020")).toBe(1);
		expect(groups.at(-1)).toMatchObject({ key: "none", count: 5 });

		// On the statistics pages the single 2020 graduate is hidden, and so is the next smallest.
		const [byType] = (await peopleBreakdowns(people)).filter(
			(b) => b.id === "qualifications.byType",
		);
		const shown = (label: string) =>
			byType.rows.find((r) => r.label === label)?.count;
		expect(shown("Graduate 2019")).toBe(6);
		expect(shown("Graduate 2020")).toBeNull();
		expect(shown("No qualification")).toBeNull();
	});
});
