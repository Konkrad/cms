import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { canViewEvent } from "~/modules/events/public-event";
import { eventsModule } from "../../src/modules/events/module";
import {
	createTestEvent,
	createTestParticipation,
	createTestUser,
	grantRootAdmin,
	openDb,
} from "./helpers";

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const fn of cleanups.splice(0).reverse()) fn();
});

function createGroup() {
	const db = openDb();
	const id = crypto.randomUUID();
	db.prepare(
		"INSERT INTO groups (id, name, slug, latitude, longitude) VALUES (?, ?, ?, ?, ?)",
	).run(id, "Unit Group", `unit-group-${id}`, "0", "0");
	db.close();
	cleanups.push(() => {
		const d = openDb();
		d.prepare("DELETE FROM groups WHERE id = ?").run(id);
		d.close();
	});
	return id;
}

function assignEventToGroup(eventId: string, groupId: string) {
	const db = openDb();
	db.prepare("UPDATE events SET group_id = ? WHERE id = ?").run(
		groupId,
		eventId,
	);
	db.close();
}

function addMember(userId: string, groupId: string) {
	const db = openDb();
	db.prepare(
		"INSERT INTO group_memberships (id, user_id, group_id) VALUES (?, ?, ?)",
	).run(crypto.randomUUID(), userId, groupId);
	db.close();
	cleanups.push(() => {
		const d = openDb();
		d.prepare(
			"DELETE FROM group_memberships WHERE user_id = ? AND group_id = ?",
		).run(userId, groupId);
		d.close();
	});
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

describe("events group page hook", () => {
	it("lists the group's upcoming events and counts its past ones", async () => {
		const owner = createTestUser();
		cleanups.push(owner.cleanup);
		const groupId = createGroup();
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
		assignEventToGroup(next.eventId, groupId);
		assignEventToGroup(old.eventId, groupId);

		const extras = await eventsModule.groupPage?.({ groupId, viewerId: null });

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
		const groupId = createGroup();
		addMember(member.userId, groupId);
		const secret = createTestEvent(owner.userId, {
			title: "Members Only",
			visibility: "group-only",
			startDate: future(3),
			endDate: future(4),
		});
		cleanups.push(secret.cleanup);
		assignEventToGroup(secret.eventId, groupId);

		const titles = async (viewerId: string | null) =>
			(
				await eventsModule.groupPage?.({ groupId, viewerId })
			)?.upcomingEvents?.map((e) => e.title);

		expect(await titles(null)).toEqual([]);
		expect(await titles(outsider.userId)).toEqual([]);
		expect(await titles(member.userId)).toEqual(["Members Only"]);
	});
});

describe("canViewEvent", () => {
	it("allows everyone on global events", async () => {
		const event = { visibility: "global", groupId: null };
		expect(await canViewEvent(event, null)).toBe(true);
		expect(await canViewEvent(event, { id: "x" })).toBe(true);
	});

	it("limits group-only events to members and platform admins", async () => {
		const member = createTestUser();
		const outsider = createTestUser();
		cleanups.push(member.cleanup, outsider.cleanup);
		const groupId = createGroup();
		addMember(member.userId, groupId);
		const event = { visibility: "group-only", groupId };

		expect(await canViewEvent(event, null)).toBe(false);
		expect(await canViewEvent(event, { id: outsider.userId })).toBe(false);
		expect(await canViewEvent(event, { id: member.userId })).toBe(true);
		grantRootAdmin(outsider.userId);
		expect(await canViewEvent(event, { id: outsider.userId })).toBe(true);
	});

	it("hides a group-only event without a group from non-admins", async () => {
		const user = createTestUser();
		cleanups.push(user.cleanup);
		const event = { visibility: "group-only", groupId: null };
		expect(await canViewEvent(event, { id: user.userId })).toBe(false);
	});
});
