import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stream } from "~/core/content/stream.service";
import { formPurposes } from "~/core/registry/forms";
import { resolveHandlerCall } from "~/core/registry/handlers";
import { activeModules } from "~/core/registry/manifests";
import { decideReview, reviews } from "~/core/reviews/reviews";
import { processHandlerCallsOnce } from "~/core/scheduler/handler-calls";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { onEventApproved } from "~/modules/events/review";
import { eventsService } from "~/modules/events/services/events";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
let region: Scope;
let chapter: Scope;
let rep: string;
let coordinator: string;

const runHandlers = () =>
	processHandlerCallsOnce(resolveHandlerCall, new Date(Date.now() + 1000));

function draftEvent(title: string) {
	const e = createTestEvent(rep, {
		scopeId: chapter.id,
		title,
		startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
		endDate: new Date(Date.now() + 8 * 86400000).toISOString(),
	});
	cleanups.push(e.cleanup);
	const db = openDb();
	db.prepare("UPDATE events SET status = 'draft' WHERE id = ?").run(e.eventId);
	db.close();
	return e.eventId;
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `er-${tag}`, name: "ER" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "city", name: "City" },
		new Set(),
	);
	for (const set of [
		(id: string) => {
			rep = id;
		},
		(id: string) => {
			coordinator = id;
		},
	]) {
		const u = createTestUser();
		cleanups.push(u.cleanup);
		set(u.userId);
	}
	await scopesService.grantRole(rep, chapter.id, "representative");
	await scopesService.grantRole(coordinator, region.id, "coordinator");
});

afterAll(() => {
	const db = openDb();
	for (const id of [chapter.id, region.id]) {
		db.prepare(
			"DELETE FROM handler_calls WHERE dedupe_key IN (SELECT 'review:' || id FROM reviews WHERE scope_id = ?)",
		).run(id);
		db.prepare("DELETE FROM reviews WHERE scope_id = ?").run(id);
		db.prepare("DELETE FROM notes WHERE scope_id = ?").run(id);
	}
	db.close();
	for (const c of cleanups.reverse()) c();
	const d = openDb();
	for (const id of [chapter.id, region.id]) {
		d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	d.close();
});

describe("events proposals through review", () => {
	it("the events module declares its proposal and debrief forms and review handlers", () => {
		const purposes = formPurposes().map((p) => p.purpose);
		expect(purposes).toEqual(
			expect.arrayContaining(["events.proposal", "events.debrief"]),
		);
		const events = activeModules.find((m) => m.id === "events");
		expect(events?.reviews?.event?.onApproved).toBeTypeOf("function");
		expect(events?.reviews?.event?.onRejected).toBeTypeOf("function");
	});

	it("draft events are not listed; approval publishes and announces once; rejection goes back to draft", async () => {
		const id = draftEvent(`Proposal ${tag}`);
		const ref = `events:event:${id}`;
		expect(await reviews.isRequired({ userId: rep }, ref)).toBe(true);
		expect(await reviews.isRequired({ userId: coordinator }, ref)).toBe(false);
		const { required, reviewId } = await reviews.submit({ userId: rep }, ref);
		expect(required).toBe(true);
		await eventsService.setStatus(id, "in_review");
		expect(
			(await eventsService.searchPublic(`Proposal ${tag}`, 5)).map((e) => e.id),
		).not.toContain(id);

		// Rejected → draft, the comment stays with the review.
		await decideReview({ id: coordinator }, reviewId as string, {
			approve: false,
			comment: "Which room?",
		});
		await runHandlers();
		expect((await eventsService.getById(id))?.status).toBe("draft");
		expect((await reviews.statusOf(ref))?.comment).toBe("Which room?");

		// Resubmitted and approved → published with one announcement note by the organiser.
		const again = await reviews.submit({ userId: rep }, ref);
		await eventsService.setStatus(id, "in_review");
		await decideReview({ id: coordinator }, again.reviewId as string, {
			approve: true,
		});
		await runHandlers();
		const published = await eventsService.getById(id);
		expect(published?.status).toBe("published");
		expect(published?.announcementNoteId).toBeTruthy();
		const updates = await stream.forSubject("events:event", id, null);
		expect(updates).toHaveLength(1);
		expect(updates[0].authorId).toBe(rep);
		expect(updates[0].publishedAt).not.toBeNull();
		expect(updates[0].body).toContain(`Proposal ${tag}`);

		// Called again (a retry): no second announcement.
		await onEventApproved(
			{ now: new Date() },
			{
				id,
				ref,
				reviewId: again.reviewId as string,
				submittedBy: rep,
				reviewedBy: coordinator,
				comment: null,
				data: null,
			},
		);
		expect(await stream.forSubject("events:event", id, null)).toHaveLength(1);
	});

	it("without Post announcement no note is added", async () => {
		const id = draftEvent(`Quiet ${tag}`);
		await eventsService.setAnnounceOnApproval(id, false);
		const { reviewId } = await reviews.submit(
			{ userId: rep },
			`events:event:${id}`,
		);
		await decideReview({ id: coordinator }, reviewId as string, {
			approve: true,
		});
		await runHandlers();
		expect((await eventsService.getById(id))?.status).toBe("published");
		expect(await stream.forSubject("events:event", id, null)).toHaveLength(0);
	});
});
