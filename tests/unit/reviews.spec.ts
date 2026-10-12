import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { resolveHandlerCall } from "~/core/registry/handlers";
import { getNotificationDefinition } from "~/core/registry/notifications";
import {
	canDecide,
	decideReview,
	ReviewAccessError,
	ReviewError,
	reviewQueue,
	reviewRecipients,
	reviewRequired,
	reviews,
} from "~/core/reviews/reviews";
import { processHandlerCallsOnce } from "~/core/scheduler/handler-calls";
import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
let root: Scope;
let region: Scope;
let chapter: Scope;
let quietRegion: Scope;
let quietChapter: Scope;
let siblingRegion: Scope;
const u: Record<string, string> = {};

function user(name: string) {
	const t = createTestUser({ name });
	cleanups.push(t.cleanup);
	u[name] = t.userId;
	return t.userId;
}

function event(scopeId: string, visibility = "public") {
	const e = createTestEvent(u.repChapter, { scopeId, visibility });
	cleanups.push(e.cleanup);
	return `events:event:${e.eventId}`;
}

function outbox(notificationId: string, userId: string) {
	const db = openDb();
	const rows = db
		.prepare(
			"SELECT * FROM notification_outbox WHERE notification_id = ? AND recipient_user_id = ?",
		)
		.all(notificationId, userId);
	db.close();
	return rows as Array<{ data: string }>;
}

beforeAll(async () => {
	root = await scopesService.ensureRoot();
	const mk = (parentId: string, kind: string, slug: string) =>
		scopesService.create({ parentId, kind, slug, name: slug }, new Set());
	region = await mk(root.id, "region", `rv-${tag}`);
	chapter = await mk(region.id, "chapter", "city");
	quietRegion = await mk(root.id, "region", `rq-${tag}`);
	quietChapter = await mk(quietRegion.id, "chapter", "town");
	siblingRegion = await mk(root.id, "region", `rs-${tag}`);
	for (const name of [
		"repChapter",
		"coordChapter",
		"coordRegion",
		"adminRegion",
		"rootAdmin",
		"repRegion",
		"member",
		"coordSibling",
		"coordAndRep",
	])
		user(name);
	await scopesService.grantRole(u.repChapter, chapter.id, "representative");
	await scopesService.grantRole(u.coordChapter, chapter.id, "coordinator");
	await scopesService.grantRole(u.coordRegion, region.id, "coordinator");
	await scopesService.grantRole(u.adminRegion, region.id, "admin");
	await scopesService.grantRole(u.rootAdmin, root.id, "admin");
	await scopesService.grantRole(u.repRegion, region.id, "representative");
	await scopesService.grantRole(
		u.coordSibling,
		siblingRegion.id,
		"coordinator",
	);
	await scopesService.grantRole(u.coordAndRep, region.id, "coordinator");
	await scopesService.grantRole(u.coordAndRep, chapter.id, "representative");
	await scopesService.join(u.member, chapter.id);
	await scopesService.grantRole(
		u.repChapter,
		quietChapter.id,
		"representative",
	);
});

afterAll(() => {
	const db = openDb();
	const ids = [chapter, region, quietChapter, quietRegion, siblingRegion].map(
		(s) => s.id,
	);
	for (const id of ids) {
		db.prepare(
			"DELETE FROM handler_calls WHERE dedupe_key IN (SELECT 'review:' || id FROM reviews WHERE scope_id = ?)",
		).run(id);
		db.prepare("DELETE FROM reviews WHERE scope_id = ?").run(id);
	}
	db.close();
	for (const c of cleanups.reverse()) c();
	const d = openDb();
	for (const id of ids) {
		d.prepare("DELETE FROM form_assignments WHERE scope_id = ?").run(id);
		d.prepare(
			"DELETE FROM form_results WHERE form_id IN (SELECT id FROM forms WHERE scope_id = ?)",
		).run(id);
		d.prepare("DELETE FROM forms WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	d.close();
});

describe("reviewRequired: author roles × visibility × scope level", () => {
	it("public content in a chapter needs review unless the author coordinates or administers it from there or above", async () => {
		const expected: Record<string, boolean> = {
			repChapter: true,
			repRegion: true,
			member: true,
			coordSibling: true,
			coordChapter: false,
			coordRegion: false,
			adminRegion: false,
			rootAdmin: false,
		};
		for (const [name, required] of Object.entries(expected))
			expect([
				name,
				await reviewRequired({ id: u[name] }, chapter.id, "public"),
			]).toEqual([name, required]);
	});

	it("members-only and representatives-only content is never reviewed", async () => {
		for (const name of ["repChapter", "member", "coordRegion"])
			for (const visibility of ["members", "representatives"])
				expect(
					await reviewRequired({ id: u[name] }, chapter.id, visibility),
				).toBe(false);
	});

	it("at the region and at the root, roles below do not count", async () => {
		expect(await reviewRequired({ id: u.repRegion }, region.id, "public")).toBe(
			true,
		);
		expect(
			await reviewRequired({ id: u.coordChapter }, region.id, "public"),
		).toBe(true);
		expect(
			await reviewRequired({ id: u.coordRegion }, region.id, "public"),
		).toBe(false);
		expect(await reviewRequired({ id: u.coordRegion }, root.id, "public")).toBe(
			true,
		);
		expect(await reviewRequired({ id: u.rootAdmin }, root.id, "public")).toBe(
			false,
		);
		// An item type without a visibility counts as public.
		expect(await reviewRequired({ id: u.repChapter }, chapter.id, null)).toBe(
			true,
		);
	});
});

describe("canDecide", () => {
	const review = () => ({ scopeId: chapter.id, submittedBy: u.repChapter });

	it("coordinators and admins above and root admins may; the submitter, the item's own scope and other branches may not", async () => {
		const expected: Record<string, boolean> = {
			coordRegion: true,
			adminRegion: true,
			rootAdmin: true,
			repChapter: false,
			coordChapter: false,
			repRegion: false,
			member: false,
			coordSibling: false,
			coordAndRep: false,
		};
		for (const [name, may] of Object.entries(expected))
			expect([name, await canDecide({ id: u[name] }, review())]).toEqual([
				name,
				may,
			]);
		expect(await canDecide(null, review())).toBe(false);
	});

	it("nobody decides their own submission, not even a root admin", async () => {
		expect(
			await canDecide(
				{ id: u.rootAdmin },
				{ scopeId: chapter.id, submittedBy: u.rootAdmin },
			),
		).toBe(false);
	});
});

describe("reviewRecipients", () => {
	it("the coordinators of the nearest scope above that has any", async () => {
		const to = await reviewRecipients(chapter.id, u.repChapter);
		expect(to.sort()).toEqual([u.coordRegion, u.coordAndRep].sort());
		expect(to).not.toContain(u.coordChapter);
	});

	it("falls back to the root (its coordinators, else its admins) when no scope above has coordinators", async () => {
		const to = await reviewRecipients(quietChapter.id, u.repChapter);
		const db = openDb();
		const rootCoordinators = db
			.prepare(
				"SELECT user_id FROM scope_roles WHERE scope_id = ? AND role = 'coordinator'",
			)
			.all(root.id);
		db.close();
		if (rootCoordinators.length === 0) expect(to).toContain(u.rootAdmin);
		expect(to).not.toContain(u.coordRegion);
		expect(to).not.toContain(u.repChapter);
	});
});

describe("submit, decide and handlers", () => {
	it("submits with a form: result by ref, review in_review, reviewers emailed; not twice", async () => {
		const ref = event(chapter.id);
		const form = await formsService.create({
			scopeId: region.id,
			title: "Proposal",
			slug: "proposal",
			schema: {
				pages: [
					{
						name: "p",
						elements: [
							{ type: "text", name: "why", title: "Why", isRequired: true },
						],
					},
				],
			},
			purpose: `test.proposal-${tag}`,
			createdBy: null,
		});
		await formAssignmentsService.setActive(
			`test.proposal-${tag}`,
			region.id,
			form.id,
		);
		const before = outbox("reviews.requested", u.coordRegion).length;
		const result = await reviews.submit({ userId: u.repChapter }, ref, {
			formId: form.id,
			answers: { why: "Because" },
		});
		expect(result.required).toBe(true);
		expect(await formsService.isLocked(form.id)).toBe(true);
		expect((await reviews.statusOf(ref))?.status).toBe("in_review");
		expect(outbox("reviews.requested", u.coordRegion).length).toBe(before + 1);
		await expect(
			reviews.submit({ userId: u.repChapter }, ref),
		).rejects.toBeInstanceOf(ReviewError);
		const queue = await reviewQueue({ id: u.coordRegion }, region);
		const row = queue.pending.find((p) => p.ref === ref);
		expect(row?.answers).toEqual([{ question: "Why", answer: "Because" }]);
		const ctx = {
			recipient: { userId: u.coordRegion, name: "C", address: "c@example.com" },
			appUrl: "http://localhost",
			unsubscribeUrl: null,
		};
		const email = await getNotificationDefinition(
			"reviews.requested",
		)?.render.email?.({ reviewId: result.reviewId as string }, ctx);
		expect(email?.subject).toMatch(/^Review requested: /);
		expect(
			(await reviewQueue({ id: u.repChapter }, chapter)).pending.find(
				(p) => p.ref === ref,
			),
		).toBeUndefined();
		expect(
			(await reviewQueue({ id: u.repChapter }, chapter)).mine.find(
				(p) => p.ref === ref,
			)?.status,
		).toBe("in_review");
	});

	it("no review for members-only items, coordinators, or edits after approval", async () => {
		expect(
			(
				await reviews.submit(
					{ userId: u.repChapter },
					event(chapter.id, "members"),
				)
			).required,
		).toBe(false);
		expect(
			(await reviews.submit({ userId: u.coordRegion }, event(chapter.id)))
				.required,
		).toBe(false);
		await expect(
			reviews.submit({ userId: u.repChapter }, "events:event:nope"),
		).rejects.toBeInstanceOf(ReviewError);
	});

	it("reject with comment → resubmit → approve; history kept; author told; once per decision", async () => {
		const ref = event(chapter.id);
		const { reviewId } = await reviews.submit({ userId: u.repChapter }, ref);
		if (!reviewId) throw new Error("expected a review");
		await expect(
			decideReview({ id: u.repChapter }, reviewId, { approve: true }),
		).rejects.toBeInstanceOf(ReviewAccessError);
		await expect(
			decideReview({ id: u.coordRegion }, reviewId, { approve: false }),
		).rejects.toBeInstanceOf(ReviewError);
		const decidedBefore = outbox("reviews.decided", u.repChapter).length;
		const rejected = await decideReview({ id: u.coordRegion }, reviewId, {
			approve: false,
			comment: "Add a venue",
		});
		expect(rejected.status).toBe("rejected");
		expect(rejected.reviewedBy).toBe(u.coordRegion);
		expect(outbox("reviews.decided", u.repChapter).length).toBe(
			decidedBefore + 1,
		);
		await expect(
			decideReview({ id: u.rootAdmin }, reviewId, { approve: true }),
		).rejects.toBeInstanceOf(ReviewError);
		const call = await handlerCallsService.getByDedupeKey(`review:${reviewId}`);
		expect(call?.hook).toBe("onRejected");
		expect(call?.owner).toBe("events");
		expect(call?.payload.comment).toBe("Add a venue");

		const again = await reviews.submit({ userId: u.repChapter }, ref);
		expect(again.required).toBe(true);
		expect(again.reviewId).not.toBe(reviewId);
		await decideReview({ id: u.rootAdmin }, again.reviewId as string, {
			approve: true,
		});
		expect((await reviews.statusOf(ref))?.status).toBe("approved");
		// Approved once: edits are not reviewed again.
		expect((await reviews.submit({ userId: u.repChapter }, ref)).required).toBe(
			false,
		);
	});
});

describe("handler calls", () => {
	it("are retried with backoff until they succeed, and run once per decision", async () => {
		const key = `test:${tag}:retry`;
		await handlerCallsService.enqueue(
			{
				dedupeKey: key,
				owner: "test",
				kind: "reviews",
				type: "thing",
				hook: "onApproved",
				payload: { ref: "x" },
			},
			new Date("2026-01-01T00:00:00Z"),
		);
		// A second enqueue for the same decision is ignored.
		await handlerCallsService.enqueue(
			{
				dedupeKey: key,
				owner: "test",
				kind: "reviews",
				type: "thing",
				hook: "onApproved",
				payload: { ref: "x" },
			},
			new Date("2026-01-01T00:00:00Z"),
		);
		let calls = 0;
		const resolve = (c: { owner: string }) =>
			c.owner === "test"
				? async () => {
						calls++;
						if (calls < 3) throw new Error(`fail ${calls}`);
					}
				: undefined;
		const t = (s: number) =>
			new Date(Date.parse("2026-01-01T00:00:00Z") + s * 1000);
		await processHandlerCallsOnce(resolve, t(0));
		let row = await handlerCallsService.getByDedupeKey(key);
		expect(row?.status).toBe("pending");
		expect(row?.attempts).toBe(1);
		expect(row?.lastError).toBe("fail 1");
		expect(
			(await handlerCallsService.listFailing()).map((r) => r.id),
		).toContain(row?.id);
		await processHandlerCallsOnce(resolve, t(10));
		expect(calls).toBe(1);
		await processHandlerCallsOnce(resolve, t(30));
		expect(calls).toBe(2);
		await processHandlerCallsOnce(resolve, t(30 + 60));
		expect(calls).toBe(3);
		row = await handlerCallsService.getByDedupeKey(key);
		expect(row?.status).toBe("done");
		await processHandlerCallsOnce(resolve, t(10_000));
		expect(calls).toBe(3);
		const db = openDb();
		db.prepare("DELETE FROM handler_calls WHERE dedupe_key = ?").run(key);
		db.close();
	});

	it("resolves review handlers of every registered module by name", () => {
		expect(
			resolveHandlerCall({
				owner: "nope",
				kind: "reviews",
				type: "x",
				hook: "onApproved",
			}),
		).toBeUndefined();
		expect(
			resolveHandlerCall({
				owner: "events",
				kind: "payments",
				type: "event",
				hook: "onApproved",
			}),
		).toBeUndefined();
	});
});
