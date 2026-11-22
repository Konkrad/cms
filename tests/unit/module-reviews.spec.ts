import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveHandlerCall } from "~/core/registry/handlers";
import {
	canDecide,
	decideReview,
	ReviewAccessError,
	reviewQueue,
	reviewRecipients,
	reviewRequired,
	reviews,
} from "~/core/reviews/reviews";
import { processHandlerCallsOnce } from "~/core/scheduler/handler-calls";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { submitApplicationForReview } from "~/modules/elections/review";
import { electionsService } from "~/modules/elections/service";
import { jobRef, submitJobForReview } from "~/modules/jobs/review";
import { jobsService } from "~/modules/jobs/service";
import { claimRef } from "~/modules/qualifications/review";
import {
	createTestElectionCycle,
	createTestElectionPosition,
	createTestQualification,
	createTestQualificationType,
	createTestUser,
	openDb,
} from "./helpers";

// The one review flow for every module (spec 4.9): per-type rules (`required`, `deciders`),
// items without a page (`locate`), labelled details, and the modules' handlers.

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
let root: Scope;
let region: Scope;
let chapter: Scope;
let quietChapter: Scope;
let otherRegion: Scope;
const u: Record<string, string> = {};

function user(name: string) {
	const t = createTestUser({ name });
	cleanups.push(t.cleanup);
	u[name] = t.userId;
}

function outbox(notificationId: string, userId: string): number {
	const db = openDb();
	const row = db
		.prepare(
			"SELECT COUNT(*) AS n FROM notification_outbox WHERE notification_id = ? AND recipient_user_id = ?",
		)
		.get(notificationId, userId) as { n: number };
	db.close();
	return row.n;
}

const runHandlers = () =>
	processHandlerCallsOnce(resolveHandlerCall, new Date(Date.now() + 60_000));

async function newJob(by: string, scopeId: string) {
	const job = await jobsService.create({
		title: `Job ${tag} ${Math.random()}`,
		body: "<p>body</p>",
		locationType: "on-site",
		expiresAt: new Date(Date.now() + 7 * 86_400_000),
		status: "pending",
		suggestedBy: by,
		scopeId,
	} as never);
	cleanups.push(() => {
		const db = openDb();
		db.prepare("DELETE FROM jobs WHERE id = ?").run(job.id);
		db.close();
	});
	return job;
}

beforeAll(async () => {
	root = await scopesService.ensureRoot();
	const mk = (parentId: string, kind: string, slug: string) =>
		scopesService.create({ parentId, kind, slug, name: slug }, new Set());
	region = await mk(root.id, "region", `mr-${tag}`);
	chapter = await mk(region.id, "chapter", "city");
	quietChapter = await mk(region.id, "chapter", "quiet");
	otherRegion = await mk(root.id, "region", `mo-${tag}`);
	for (const name of [
		"member",
		"repChapter",
		"repRegion",
		"coordRegion",
		"adminChapter",
		"rootAdmin",
		"repOther",
	])
		user(name);
	await scopesService.grantRole(u.repChapter, chapter.id, "representative");
	await scopesService.grantRole(u.adminChapter, chapter.id, "admin");
	await scopesService.grantRole(u.repRegion, region.id, "representative");
	await scopesService.grantRole(u.coordRegion, region.id, "coordinator");
	await scopesService.grantRole(u.rootAdmin, root.id, "admin");
	await scopesService.grantRole(u.repOther, otherRegion.id, "representative");
});

afterAll(() => {
	const db = openDb();
	const ids = [chapter, quietChapter, region, otherRegion].map((s) => s.id);
	const refs = (like: string) =>
		db.prepare("SELECT id FROM reviews WHERE ref LIKE ?").all(like) as Array<{
			id: string;
		}>;
	for (const like of [
		"jobs:job:%",
		"elections:application:%",
		"qualifications:claim:%",
	])
		for (const r of refs(like)) {
			db.prepare("DELETE FROM handler_calls WHERE dedupe_key = ?").run(
				`review:${r.id}`,
			);
		}
	for (const id of [...ids, root.id])
		db.prepare(
			"DELETE FROM reviews WHERE scope_id = ? AND (ref LIKE 'jobs:%' OR ref LIKE 'elections:%' OR ref LIKE 'qualifications:%')",
		).run(id);
	db.close();
	for (const c of cleanups.reverse()) c();
	const d = openDb();
	for (const id of ids) {
		d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	d.close();
});

describe("rules per item type", () => {
	it('"always" reviews everyone; "unless-manager" skips the scope\'s managers only', async () => {
		for (const who of ["member", "repChapter", "rootAdmin"])
			expect(
				await reviewRequired({ id: u[who] }, chapter.id, null, "always"),
			).toBe(true);
		const unless = (who: string) =>
			reviewRequired({ id: u[who] }, chapter.id, null, "unless-manager");
		expect(await unless("member")).toBe(true);
		// A coordinator reviews content but does not manage the scope.
		expect(await unless("coordRegion")).toBe(true);
		expect(await unless("repChapter")).toBe(false);
		expect(await unless("repRegion")).toBe(false);
		expect(await unless("rootAdmin")).toBe(false);
		expect(await unless("repOther")).toBe(true);
	});

	it('"scope-managers": the scope\'s own managers and those above decide; coordinators and other branches do not', async () => {
		const review = { scopeId: chapter.id, submittedBy: u.member };
		const may = (who: string) =>
			canDecide({ id: u[who] }, review, "scope-managers");
		expect(await may("repChapter")).toBe(true);
		expect(await may("adminChapter")).toBe(true);
		expect(await may("repRegion")).toBe(true);
		expect(await may("rootAdmin")).toBe(true);
		expect(await may("coordRegion")).toBe(false);
		expect(await may("repOther")).toBe(false);
		expect(
			await canDecide(
				{ id: u.repChapter },
				{ scopeId: chapter.id, submittedBy: u.repChapter },
				"scope-managers",
			),
		).toBe(false);
		// The content rule stays as it was: the item's own representatives may not.
		expect(await canDecide({ id: u.repChapter }, review)).toBe(false);
	});

	it('"scope-managers" requests go to the nearest scope with managers, starting with the item\'s own', async () => {
		expect(
			(await reviewRecipients(chapter.id, u.member, "scope-managers")).sort(),
		).toEqual([u.adminChapter, u.repChapter].sort());
		expect(
			await reviewRecipients(quietChapter.id, u.member, "scope-managers"),
		).toEqual([u.repRegion]);
	});
});

describe("jobs", () => {
	it("a member's listing waits for a scope manager; approval publishes it and sends only the job's own email", async () => {
		const job = await newJob(u.member, chapter.id);
		expect(await submitJobForReview(u.member, job.id)).toEqual({
			inReview: true,
		});
		const status = await reviews.statusOf(jobRef(job.id));
		if (!status) throw new Error("expected a review");
		expect(status.status).toBe("in_review");

		const queue = await reviewQueue({ id: u.repChapter }, chapter);
		const item = queue.pending.find((p) => p.ref === jobRef(job.id));
		expect(item?.title).toBe(job.title);
		expect(item?.canDecide).toBe(true);
		expect(
			(await reviewQueue({ id: u.coordRegion }, region)).pending.some(
				(p) => p.ref === jobRef(job.id),
			),
		).toBe(false);
		await expect(
			decideReview({ id: u.coordRegion }, status.reviewId, { approve: true }),
		).rejects.toBeInstanceOf(ReviewAccessError);

		const decidedBefore = outbox("reviews.decided", u.member);
		await decideReview({ id: u.repChapter }, status.reviewId, {
			approve: true,
		});
		await runHandlers();
		expect((await jobsService.getById(job.id))?.status).toBe("approved");
		expect(outbox("jobs.approved", u.member)).toBeGreaterThanOrEqual(1);
		expect(outbox("reviews.decided", u.member)).toBe(decidedBefore);
	});

	it("a rejected listing stays pending with the comment; the poster is emailed; a manager's own listing is approved at once", async () => {
		const job = await newJob(u.member, chapter.id);
		await submitJobForReview(u.member, job.id);
		const { reviewId } = (await reviews.statusOf(jobRef(job.id))) ?? {};
		const decidedBefore = outbox("reviews.decided", u.member);
		await decideReview({ id: u.repRegion }, reviewId as string, {
			approve: false,
			comment: "Add a salary range",
		});
		await runHandlers();
		expect((await jobsService.getById(job.id))?.status).toBe("pending");
		expect((await reviews.statusOf(jobRef(job.id)))?.comment).toBe(
			"Add a salary range",
		);
		expect(outbox("reviews.decided", u.member)).toBe(decidedBefore + 1);

		const own = await newJob(u.repChapter, chapter.id);
		expect(await submitJobForReview(u.repChapter, own.id)).toEqual({
			inReview: false,
		});
		expect((await jobsService.getById(own.id))?.status).toBe("approved");
	});

	it("a deleted listing leaves the queue", async () => {
		const job = await newJob(u.member, chapter.id);
		await submitJobForReview(u.member, job.id);
		await jobsService.delete(job.id);
		expect(
			(await reviewQueue({ id: u.rootAdmin }, root)).pending.some(
				(p) => p.ref === jobRef(job.id),
			),
		).toBe(false);
	});
});

describe("election applications", () => {
	it("are always reviewed by the election scope's managers, with the answers; the decision and comment reach the application", async () => {
		const cycle = createTestElectionCycle({
			status: "open",
			scopeId: chapter.id,
			title: `Board ${tag}`,
		});
		cleanups.push(cycle.cleanup);
		const position = createTestElectionPosition(cycle.cycleId, {
			title: "Treasurer",
		});
		cleanups.push(position.cleanup);
		const { application } = await electionsService.createApplication({
			positionId: position.positionId,
			cycleId: cycle.cycleId,
			userId: u.member,
			motivationWhy: "I care about the budget.",
			motivationExperience: "Ten years of bookkeeping.",
			motivationGoals: "Open books.",
		});
		if (!application) throw new Error("expected an application");
		await submitApplicationForReview(u.member, application);

		const ref = `elections:application:${application.id}`;
		const item = (
			await reviewQueue({ id: u.repChapter }, chapter)
		).pending.find((p) => p.ref === ref);
		expect(item?.title).toBe(`Candidacy for Treasurer (Board ${tag})`);
		expect(item?.url).toBeNull();
		expect(item?.answers.map((a) => a.answer)).toEqual([
			"I care about the budget.",
			"Ten years of bookkeeping.",
			"Open books.",
		]);

		await decideReview({ id: u.adminChapter }, item?.reviewId as string, {
			approve: false,
			comment: "Not a member long enough",
		});
		await runHandlers();
		const app = await electionsService.getApplicationById(application.id);
		expect(app?.status).toBe("rejected");
		expect(app?.adminNote).toBe("Not a member long enough");
	});
});

describe("qualification claims", () => {
	it("are decided by the root's managers; approval grants the badge", async () => {
		const type = createTestQualificationType({ label: `Course ${tag}` });
		cleanups.push(type.cleanup);
		const claim = createTestQualification(u.member, type.typeId);
		cleanups.push(() => {
			const db = openDb();
			db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(u.member);
			db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(
				u.member,
			);
			db.close();
		});
		const { reviewId } = await reviews.submit(
			{ userId: u.member },
			claimRef(claim.qualId),
		);
		if (!reviewId) throw new Error("expected a review");
		const item = (await reviewQueue({ id: u.rootAdmin }, root)).pending.find(
			(p) => p.reviewId === reviewId,
		);
		expect(item?.title).toBe(`Course ${tag}`);
		await expect(
			decideReview({ id: u.repRegion }, reviewId, { approve: true }),
		).rejects.toBeInstanceOf(ReviewAccessError);

		await decideReview({ id: u.rootAdmin }, reviewId, { approve: true });
		await runHandlers();
		const db = openDb();
		const row = db
			.prepare("SELECT status FROM user_qualifications WHERE id = ?")
			.get(claim.qualId) as { status: string };
		const badge = db
			.prepare("SELECT 1 FROM user_tags WHERE user_id = ? AND source_id = ?")
			.get(u.member, claim.qualId);
		db.close();
		expect(row.status).toBe("approved");
		expect(badge).toBeTruthy();
	});
});
