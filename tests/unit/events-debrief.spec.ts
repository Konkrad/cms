import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { forms } from "~/core/forms/forms-api";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import {
	listOverdueDebriefs,
	runDebriefRequests,
} from "~/modules/events/debrief";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
let region: Scope;
let organiser: string;
let formId: string;
const DAY = 86_400_000;

function endedEvent(daysAgo: number, status = "published") {
	const e = createTestEvent(organiser, {
		scopeId: region.id,
		startDate: new Date(Date.now() - (daysAgo + 1) * DAY).toISOString(),
		endDate: new Date(Date.now() - daysAgo * DAY).toISOString(),
	});
	cleanups.push(e.cleanup);
	const db = openDb();
	db.prepare("UPDATE events SET status = ? WHERE id = ?").run(
		status,
		e.eventId,
	);
	db.close();
	return e.eventId;
}

function requests(eventId: string) {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT data FROM notification_outbox WHERE notification_id = 'events.debrief-requested' AND recipient_user_id = ?",
		)
		.all(organiser) as Array<{ data: string }>;
	db.close();
	return rows
		.map((r) => JSON.parse(r.data) as { eventId: string; reminder: boolean })
		.filter((d) => d.eventId === eventId);
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `db-${tag}`, name: "DB" },
		new Set(),
	);
	const u = createTestUser();
	cleanups.push(u.cleanup);
	organiser = u.userId;
	const form = await formsService.create({
		scopeId: region.id,
		title: "Debrief",
		slug: "debrief",
		schema: {
			pages: [
				{
					name: "p",
					elements: [{ type: "comment", name: "how", title: "How did it go?" }],
				},
			],
		},
		purpose: "events.debrief",
		createdBy: null,
	});
	formId = form.id;
	await formAssignmentsService.setActive("events.debrief", region.id, form.id);
});

afterAll(() => {
	for (const c of cleanups.reverse()) c();
	const db = openDb();
	db.prepare("DELETE FROM form_assignments WHERE scope_id = ?").run(region.id);
	db.prepare("DELETE FROM form_results WHERE form_id = ?").run(formId);
	db.prepare("DELETE FROM forms WHERE scope_id = ?").run(region.id);
	db.prepare("DELETE FROM scopes WHERE id = ?").run(region.id);
	db.close();
});

describe("debrief requests", () => {
	it("one request, one reminder a week later, nothing more", async () => {
		const id = endedEvent(1);
		const now = new Date();
		await runDebriefRequests({ now });
		expect(requests(id)).toEqual([{ eventId: id, reminder: false }]);
		await runDebriefRequests({ now: new Date(now.getTime() + 1000) });
		await runDebriefRequests({ now: new Date(now.getTime() + 6 * DAY) });
		expect(requests(id)).toHaveLength(1);
		expect(
			(
				await listOverdueDebriefs(
					[region.id],
					new Date(now.getTime() + 6 * DAY),
				)
			).map((e) => e.id),
		).not.toContain(id);
		await runDebriefRequests({ now: new Date(now.getTime() + 8 * DAY) });
		expect(requests(id)).toEqual([
			{ eventId: id, reminder: false },
			{ eventId: id, reminder: true },
		]);
		await runDebriefRequests({ now: new Date(now.getTime() + 20 * DAY) });
		expect(requests(id)).toHaveLength(2);
		expect(
			(
				await listOverdueDebriefs(
					[region.id],
					new Date(now.getTime() + 8 * DAY),
				)
			).map((e) => e.id),
		).toContain(id);
	});

	it("a filled-in debrief stops reminders and is no longer overdue", async () => {
		const id = endedEvent(2);
		const now = new Date();
		await runDebriefRequests({ now });
		await forms.submit({ userId: organiser }, formId, {
			subjectRef: `events:event:${id}`,
			answers: { how: "Great" },
		});
		await runDebriefRequests({ now: new Date(now.getTime() + 8 * DAY) });
		expect(requests(id)).toHaveLength(1);
		expect(
			(
				await listOverdueDebriefs(
					[region.id],
					new Date(now.getTime() + 8 * DAY),
				)
			).map((e) => e.id),
		).not.toContain(id);
	});

	it("ignores drafts, upcoming events and events that ended long before", async () => {
		const draft = endedEvent(1, "draft");
		const old = endedEvent(60);
		const upcoming = endedEvent(-3);
		await runDebriefRequests({ now: new Date() });
		expect(requests(draft)).toHaveLength(0);
		expect(requests(old)).toHaveLength(0);
		expect(requests(upcoming)).toHaveLength(0);
	});
});
