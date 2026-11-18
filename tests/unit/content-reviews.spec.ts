import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { articlesService } from "~/core/content/articles.service";
import { updatesFor } from "~/core/content/content-api";
import { canPreviewUnpublished } from "~/core/content/content-review";
import { notesService } from "~/core/content/notes.service";
import { stream } from "~/core/content/stream.service";
import { resolveHandlerCall } from "~/core/registry/handlers";
import { decideReview, reviews } from "~/core/reviews/reviews";
import { processHandlerCallsOnce } from "~/core/scheduler/handler-calls";
import { allowedVisibilities } from "~/core/scopes/access";
import { scopeContentFilter } from "~/core/scopes/content-filter";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const created: Array<{ table: "notes" | "articles"; id: string }> = [];
let root: Scope;
let region: Scope;
let chapter: Scope;
let rep: string;
let coordinator: string;
let member: string;
let eventId: string;

function user() {
	const t = createTestUser();
	cleanups.push(t.cleanup);
	return t.userId;
}

/** Runs the queued review handlers (what the scheduler tick does). */
const runHandlers = () =>
	processHandlerCallsOnce(resolveHandlerCall, new Date(Date.now() + 1000));

beforeAll(async () => {
	root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `cr-${tag}`, name: "CR" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "city", name: "City" },
		new Set(),
	);
	rep = user();
	coordinator = user();
	member = user();
	await scopesService.grantRole(rep, chapter.id, "representative");
	await scopesService.grantRole(coordinator, region.id, "coordinator");
	await scopesService.join(member, chapter.id);
	const e = createTestEvent(rep, { scopeId: chapter.id });
	eventId = e.eventId;
	cleanups.push(e.cleanup);
});

afterAll(() => {
	const db = openDb();
	for (const { table, id } of created) {
		db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
		const kind = table === "notes" ? "note" : "article";
		db.prepare(
			"DELETE FROM handler_calls WHERE dedupe_key IN (SELECT 'review:' || id FROM reviews WHERE ref = ?)",
		).run(`core:${kind}:${id}`);
		db.prepare("DELETE FROM reviews WHERE ref = ?").run(`core:${kind}:${id}`);
	}
	db.close();
	for (const c of cleanups.reverse()) c();
	const d = openDb();
	for (const id of [chapter.id, region.id]) {
		d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	d.close();
});

describe("notes and articles through review", () => {
	it("representatives may now choose public", async () => {
		expect(await allowedVisibilities({ id: rep }, chapter.id)).toContain(
			"public",
		);
		expect(await allowedVisibilities({ id: member }, chapter.id)).not.toContain(
			"public",
		);
	});

	it("a representative's public note is unpublished and hidden everywhere until approved", async () => {
		const note = await notesService.create({
			scopeId: chapter.id,
			subjectType: "events:event",
			subjectId: eventId,
			body: `<p>In review ${tag}</p>`,
			visibility: "public",
			authorId: rep,
		});
		created.push({ table: "notes", id: note.id });
		expect(note.publishedAt).toBeNull();
		const ref = `core:note:${note.id}`;
		expect((await reviews.statusOf(ref))?.status).toBe("in_review");

		const visibleIds = async () =>
			[
				...(await stream.list(await scopeContentFilter(null, chapter.id)))
					.items,
				...(await stream.list(await scopeContentFilter(null, root.id))).items,
			].map((i) => i.id);
		expect(await visibleIds()).not.toContain(note.id);
		expect(
			(await updatesFor("events:event", eventId, { id: rep })).map((u) => u.id),
		).not.toContain(note.id);
		expect(
			(await notesService.searchPublic(`In review ${tag}`, 5)).map((n) => n.id),
		).not.toContain(note.id);
		// Its own URL: 404 for the public and members; the author and reviewers preview it.
		expect(await notesService.canView(note, null)).toBe(false);
		expect(await notesService.canView(note, { id: member })).toBe(false);
		expect(await canPreviewUnpublished("note", note, { id: member })).toBe(
			false,
		);
		expect(await canPreviewUnpublished("note", note, null)).toBe(false);
		expect(await canPreviewUnpublished("note", note, { id: rep })).toBe(true);
		expect(await canPreviewUnpublished("note", note, { id: coordinator })).toBe(
			true,
		);

		const { reviewId } = (await reviews.statusOf(ref)) ?? {};
		await decideReview({ id: coordinator }, reviewId as string, {
			approve: true,
		});
		await runHandlers();
		const published = await notesService.getById(note.id);
		expect(published?.publishedAt).not.toBeNull();
		expect(await visibleIds()).toContain(note.id);
		expect(
			await canPreviewUnpublished("note", published ?? note, { id: rep }),
		).toBe(false);
	});

	it("a rejected article stays hidden; saving it again resubmits it; approval publishes it", async () => {
		const article = await articlesService.create({
			scopeId: chapter.id,
			title: `Rejected ${tag}`,
			body: "<p>Draft</p>",
			visibility: "public",
			authorId: rep,
		});
		created.push({ table: "articles", id: article.id });
		const ref = `core:article:${article.id}`;
		const first = await reviews.statusOf(ref);
		await decideReview({ id: coordinator }, first?.reviewId as string, {
			approve: false,
			comment: "Add a date",
		});
		await runHandlers();
		expect((await articlesService.getById(article.id))?.publishedAt).toBeNull();
		expect((await reviews.statusOf(ref))?.comment).toBe("Add a date");

		const edited = await articlesService.update(
			article.id,
			{ body: "<p>On 1 May</p>" },
			rep,
		);
		expect(edited?.publishedAt).toBeNull();
		const second = await reviews.statusOf(ref);
		expect(second?.status).toBe("in_review");
		expect(second?.reviewId).not.toBe(first?.reviewId);

		await decideReview({ id: coordinator }, second?.reviewId as string, {
			approve: true,
		});
		await runHandlers();
		expect(
			(await articlesService.getById(article.id))?.publishedAt,
		).not.toBeNull();
		// Edits after approval are published directly.
		const later = await articlesService.update(
			article.id,
			{ body: "<p>On 2 May</p>" },
			rep,
		);
		expect(later?.publishedAt).not.toBeNull();
		expect((await reviews.statusOf(ref))?.status).toBe("approved");
	});

	it("members-only content and a coordinator's public content are published directly", async () => {
		const members = await notesService.create({
			scopeId: chapter.id,
			body: "<p>members</p>",
			visibility: "members",
			authorId: rep,
		});
		created.push({ table: "notes", id: members.id });
		expect(members.publishedAt).not.toBeNull();
		const byCoordinator = await notesService.create({
			scopeId: chapter.id,
			body: "<p>coordinator</p>",
			visibility: "public",
			authorId: coordinator,
		});
		created.push({ table: "notes", id: byCoordinator.id });
		expect(byCoordinator.publishedAt).not.toBeNull();
		expect(await reviews.statusOf(`core:note:${byCoordinator.id}`)).toBeNull();
	});

	it("making a published members-only note public by a representative sends it to review", async () => {
		const note = await notesService.create({
			scopeId: chapter.id,
			body: "<p>soon public</p>",
			visibility: "members",
			authorId: rep,
		});
		created.push({ table: "notes", id: note.id });
		const updated = await notesService.update(
			note.id,
			{ visibility: "public" },
			rep,
		);
		expect(updated?.publishedAt).toBeNull();
		expect((await reviews.statusOf(`core:note:${note.id}`))?.status).toBe(
			"in_review",
		);
	});
});
