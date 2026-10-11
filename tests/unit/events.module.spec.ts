import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { canViewEvent } from "~/modules/events/public-event";
import { eventsModule } from "../../src/modules/events/module";
import {
	createTestEvent,
	createTestParticipation,
	createTestUser,
	ensureRootScope,
	grantRootAdmin,
	openDb,
} from "./helpers";

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const fn of cleanups.splice(0).reverse()) fn();
});

/** A chapter scope under the root; returns its id. */
function createScope() {
	const rootId = ensureRootScope();
	const db = openDb();
	const id = crypto.randomUUID();
	db.prepare(
		"INSERT INTO scopes (id, parent_id, kind, slug, name, path) VALUES (?, ?, 'chapter', ?, ?, ?)",
	).run(id, rootId, `unit-${id}`, "Unit Group", `/unit-${id}/`);
	db.close();
	cleanups.push(() => {
		const d = openDb();
		d.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
		d.close();
	});
	return id;
}

function assignEventToScope(eventId: string, scopeId: string) {
	const db = openDb();
	db.prepare("UPDATE events SET scope_id = ? WHERE id = ?").run(
		scopeId,
		eventId,
	);
	db.close();
}

function addMember(userId: string, scopeId: string) {
	const db = openDb();
	db.prepare(
		"INSERT INTO scope_memberships (user_id, scope_id) VALUES (?, ?)",
	).run(userId, scopeId);
	db.close();
}

const future = (days: number) =>
	new Date(Date.now() + days * 86400000).toISOString();

describe("events profile hook", () => {
	it("lists the events the user said yes to, split into upcoming and past", async () => {
		const user = createTestUser();
		cleanups.push(user.cleanup);
		const upcoming = createTestEvent(user.userId, {
			title: "Hook Upcoming",
			startDate: future(5),
			endDate: future(6),
		});
		const past = createTestEvent(user.userId, { title: "Hook Past" });
		const maybe = createTestEvent(user.userId, {
			title: "Hook Maybe",
			startDate: future(7),
			endDate: future(8),
		});
		for (const e of [upcoming, past, maybe]) cleanups.push(e.cleanup);
		for (const [e, status] of [
			[upcoming, "yes"],
			[past, "yes"],
			[maybe, "maybe"],
		] as const) {
			cleanups.push(
				createTestParticipation(user.userId, e.eventId, status).cleanup,
			);
		}

		const extras = await eventsModule.profile?.({
			userId: user.userId,
			viewerId: crypto.randomUUID(),
			isOwnProfile: false,
		});

		expect(extras?.upcomingEvents?.map((e) => e.title)).toEqual([
			"Hook Upcoming",
		]);
		expect(extras?.pastEvents?.map((e) => e.title)).toEqual(["Hook Past"]);
	});

	it("is empty for a user without participation", async () => {
		const user = createTestUser();
		cleanups.push(user.cleanup);
		const extras = await eventsModule.profile?.({
			userId: user.userId,
			viewerId: user.userId,
			isOwnProfile: true,
		});
		expect(extras).toEqual({ upcomingEvents: [], pastEvents: [] });
	});
});

describe("events scope page hook", () => {
	it("lists the group's upcoming events and counts its past ones", async () => {
		const owner = createTestUser();
		cleanups.push(owner.cleanup);
		const groupId = createScope();
		const next = createTestEvent(owner.userId, {
			title: "Group Next",
			startDate: future(3),
			endDate: future(4),
		});
		const old = createTestEvent(owner.userId, { title: "Group Old" });
		const elsewhere = createTestEvent(owner.userId, {
			title: "Other Group Event",
			startDate: future(3),
			endDate: future(4),
		});
		for (const e of [next, old, elsewhere]) cleanups.push(e.cleanup);
		assignEventToScope(next.eventId, groupId);
		assignEventToScope(old.eventId, groupId);

		const extras = await eventsModule.scopePage?.({
			scopeId: groupId,
			viewerId: null,
		});

		expect(extras?.pastEventCount).toBe(1);
		expect(extras?.upcomingEvents?.map((e) => e.title)).toEqual(["Group Next"]);
		expect(extras?.upcomingEvents?.[0]).toMatchObject({
			id: next.eventId,
			locationType: "in-person",
		});
	});

	it("shows group-only events to members only", async () => {
		const owner = createTestUser();
		const member = createTestUser();
		const outsider = createTestUser();
		cleanups.push(owner.cleanup, member.cleanup, outsider.cleanup);
		const groupId = createScope();
		addMember(member.userId, groupId);
		const secret = createTestEvent(owner.userId, {
			title: "Members Only",
			visibility: "group-only",
			startDate: future(3),
			endDate: future(4),
		});
		cleanups.push(secret.cleanup);
		assignEventToScope(secret.eventId, groupId);

		const titles = async (viewerId: string | null) =>
			(
				await eventsModule.scopePage?.({ scopeId: groupId, viewerId })
			)?.upcomingEvents?.map((e) => e.title);

		expect(await titles(null)).toEqual([]);
		expect(await titles(outsider.userId)).toEqual([]);
		expect(await titles(member.userId)).toEqual(["Members Only"]);
	});
});

describe("canViewEvent", () => {
	it("allows everyone on global events", async () => {
		const event = { visibility: "global", scopeId: null };
		expect(await canViewEvent(event, null)).toBe(true);
		expect(await canViewEvent(event, { id: "x" })).toBe(true);
	});

	it("limits group-only events to members and platform admins", async () => {
		const member = createTestUser();
		const outsider = createTestUser();
		cleanups.push(member.cleanup, outsider.cleanup);
		const groupId = createScope();
		addMember(member.userId, groupId);
		const event = { visibility: "group-only", scopeId: groupId };

		expect(await canViewEvent(event, null)).toBe(false);
		expect(await canViewEvent(event, { id: outsider.userId })).toBe(false);
		expect(await canViewEvent(event, { id: member.userId })).toBe(true);
		grantRootAdmin(outsider.userId);
		expect(await canViewEvent(event, { id: outsider.userId })).toBe(true);
	});

	it("hides a group-only event without a group from non-admins", async () => {
		const user = createTestUser();
		cleanups.push(user.cleanup);
		const event = { visibility: "group-only", scopeId: null };
		expect(await canViewEvent(event, { id: user.userId })).toBe(false);
	});
});
