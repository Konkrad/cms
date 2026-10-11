import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coreRefModule } from "~/core/refs/core-refs";
import { LinkError, resolveRefsWith } from "~/core/refs/resolve";
import { allModules } from "~/core/registry/manifests";
import {
	itemUrl,
	refFromPath,
	resolveRef,
	resolveRefs,
	toStoredLink,
	withItemUrls,
} from "~/core/registry/refs";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { eventsService } from "~/modules/events/services/events";
import { createTestElectionCycle, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
let rootId: string;
let region: Scope;
let chapter: Scope;
let userId: string;
let articleId: string;
let deletedArticleId: string;
let noteId: string;
let pageId: string;
let eventId: string;
let eventSlug: string;
let jobId: string;
let dealId: string;
let cycleId: string;

function run(sql: string, ...args: unknown[]) {
	const db = openDb();
	db.prepare(sql).run(...args);
	db.close();
}

beforeAll(async () => {
	rootId = (await scopesService.ensureRoot()).id;
	region = await scopesService.create(
		{ parentId: rootId, kind: "region", slug: `refs-${tag}`, name: "Refs" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "city", name: "City" },
		new Set(),
	);
	const user = createTestUser();
	userId = user.userId;

	articleId = crypto.randomUUID();
	deletedArticleId = crypto.randomUUID();
	run(
		"INSERT INTO articles (id, title, body, author_id, scope_id, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		articleId,
		`Refs article ${tag}`,
		"<p>x</p>",
		userId,
		chapter.id,
		new Date().toISOString(),
		new Date().toISOString(),
	);
	noteId = crypto.randomUUID();
	run(
		"INSERT INTO notes (id, body, author_id, scope_id, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		noteId,
		"<p>Doors open at 18:00</p>",
		userId,
		region.id,
		new Date().toISOString(),
		new Date().toISOString(),
	);
	// A deleted article: its row is gone.
	pageId = crypto.randomUUID();
	run(
		"INSERT INTO pages (id, scope_id, slug, title, status) VALUES (?, ?, ?, ?, ?)",
		pageId,
		region.id,
		"about",
		"About",
		"published",
	);
	const event = await eventsService.create({
		title: `Summer BBQ ${tag}`,
		body: "<p>x</p>",
		startDate: new Date(Date.now() + 86400000).toISOString(),
		endDate: new Date(Date.now() + 90000000).toISOString(),
		locationType: "online",
		userId,
		scopeId: chapter.id,
	} as never);
	eventId = event.id;
	eventSlug = event.slug;
	jobId = crypto.randomUUID();
	run(
		"INSERT INTO jobs (id, title, body, location_type, expires_at, status, suggested_by, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		jobId,
		"Job",
		"<p>x</p>",
		"remote-eu",
		new Date(Date.now() + 86400000).toISOString(),
		"approved",
		userId,
		region.id,
	);
	dealId = crypto.randomUUID();
	run(
		"INSERT INTO deals (id, name, scope_id) VALUES (?, ?, ?)",
		dealId,
		"Deal",
		rootId,
	);
	const cycle = createTestElectionCycle({ scopeId: chapter.id });
	cycleId = cycle.cycleId;
	cleanups.push(cycle.cleanup, () => {
		run("DELETE FROM jobs WHERE id = ?", jobId);
		run("DELETE FROM deals WHERE id = ?", dealId);
		run("DELETE FROM events WHERE id = ?", eventId);
		run("DELETE FROM pages WHERE id = ?", pageId);
		run("DELETE FROM articles WHERE id IN (?, ?)", articleId, deletedArticleId);
		run("DELETE FROM notes WHERE id = ?", noteId);
	});
	cleanups.push(user.cleanup);
});

afterAll(async () => {
	for (const c of cleanups) c();
	await scopesService.delete(chapter.id);
	await scopesService.delete(region.id);
});

describe("resolveRef", () => {
	it("resolves scopes and module listings", async () => {
		expect(await resolveRef(`scope:${rootId}`)).toBe("/");
		expect(await resolveRef(`scope:${chapter.id}`)).toBe(`/refs-${tag}/city`);
		expect(await resolveRef(`ref:scope:${chapter.id}/events`)).toBe(
			`/refs-${tag}/city/events`,
		);
		expect(await resolveRef(`scope:${rootId}/jobs`)).toBe("/jobs");
		// "core" is no listing; unknown modules and scopes are unavailable.
		expect(await resolveRef(`scope:${rootId}/core`)).toBeNull();
		expect(await resolveRef(`scope:${rootId}/nope`)).toBeNull();
		expect(await resolveRef(`scope:${crypto.randomUUID()}`)).toBeNull();
	});

	it("resolves every item type under its owning scope", async () => {
		expect(await resolveRef(`core:article:${articleId}`)).toBe(
			`/refs-${tag}/city/articles/${articleId}`,
		);
		expect(await resolveRef(`core:note:${noteId}`)).toBe(
			`/refs-${tag}/notes/${noteId}`,
		);
		expect(await resolveRef(`core:page:${pageId}`)).toBe(`/refs-${tag}/about`);
		expect(eventSlug).toBe(`summer-bbq-${tag}`);
		expect(await resolveRef(`events:event:${eventId}`)).toBe(
			`/refs-${tag}/city/events/${eventSlug}`,
		);
		expect(await resolveRef(`jobs:job:${jobId}`)).toBe(
			`/refs-${tag}/jobs/${jobId}`,
		);
		expect(await resolveRef(`deals:deal:${dealId}`)).toBe(`/deals/${dealId}`);
		expect(await resolveRef(`elections:cycle:${cycleId}`)).toBe(
			`/refs-${tag}/city/elections/${cycleId}`,
		);
	});

	it("is unavailable for deleted items, unknown types and malformed refs", async () => {
		expect(await resolveRef(`core:article:${deletedArticleId}`)).toBeNull();
		expect(await resolveRef(`core:article:${crypto.randomUUID()}`)).toBeNull();
		// Posts are gone: their old references no longer resolve.
		expect(await resolveRef(`core:post:${articleId}`)).toBeNull();
		// A note id is not an article and vice versa.
		expect(await resolveRef(`core:article:${noteId}`)).toBeNull();
		expect(await resolveRef(`core:note:${articleId}`)).toBeNull();
		expect(await resolveRef(`events:nope:${eventId}`)).toBeNull();
		expect(await resolveRef("javascript:alert(1)")).toBeNull();
	});

	it("is unavailable while the module is inactive", async () => {
		const withoutEvents = [
			...allModules.filter((m) => m.id !== "events"),
			coreRefModule,
		];
		const urls = await resolveRefsWith(withoutEvents, [
			`events:event:${eventId}`,
			`scope:${chapter.id}/events`,
			`jobs:job:${jobId}`,
		]);
		expect(urls.get(`events:event:${eventId}`)).toBeNull();
		expect(urls.get(`scope:${chapter.id}/events`)).toBeNull();
		expect(urls.get(`jobs:job:${jobId}`)).toBe(`/refs-${tag}/jobs/${jobId}`);
	});

	it("follows a scope move without any data change", async () => {
		const other = await scopesService.create(
			{ parentId: rootId, kind: "region", slug: `refs2-${tag}`, name: "R2" },
			new Set(),
		);
		try {
			await scopesService.move(chapter.id, other.id);
			expect(await resolveRef(`events:event:${eventId}`)).toBe(
				`/refs2-${tag}/city/events/${eventSlug}`,
			);
		} finally {
			await scopesService.move(chapter.id, region.id);
			await scopesService.delete(other.id);
		}
	});

	it("resolves a batch, one entry per input", async () => {
		const refs = [
			`core:article:${articleId}`,
			`core:article:${deletedArticleId}`,
			`ref:core:page:${pageId}`,
		];
		const urls = await resolveRefs(refs);
		expect([...urls.keys()]).toEqual(refs);
		expect(urls.get(`core:article:${deletedArticleId}`)).toBeNull();
		expect(urls.get(`ref:core:page:${pageId}`)).toBe(`/refs-${tag}/about`);
	});
});

describe("itemUrl", () => {
	it("builds canonical URLs of items held", async () => {
		expect(
			await itemUrl("events:event", {
				id: eventId,
				scopeId: chapter.id,
				slug: "x",
			}),
		).toBe(`/refs-${tag}/city/events/x`);
		const [job] = await withItemUrls("jobs:job", [
			{ id: jobId, scopeId: rootId, title: "Job" },
		]);
		expect(job).toEqual({
			id: jobId,
			scopeId: rootId,
			title: "Job",
			url: `/jobs/${jobId}`,
		});
		await expect(
			itemUrl("nope:x", { id: "1", scopeId: rootId }),
		).rejects.toThrow();
	});
});

describe("refFromPath / toStoredLink", () => {
	it("maps site paths to references", async () => {
		expect(await refFromPath(`/refs-${tag}/city`)).toBe(`scope:${chapter.id}`);
		expect(await refFromPath(`/refs-${tag}/city/events/`)).toBe(
			`scope:${chapter.id}/events`,
		);
		expect(await refFromPath(`/refs-${tag}/about`)).toBe(`core:page:${pageId}`);
		expect(await refFromPath(`/refs-${tag}/city/events/${eventSlug}`)).toBe(
			`events:event:${eventId}`,
		);
		// An old id URL at the root still names the event.
		expect(await refFromPath(`/events/${eventId}`)).toBe(
			`events:event:${eventId}`,
		);
		expect(await refFromPath(`/refs-${tag}/city/articles/${articleId}`)).toBe(
			`core:article:${articleId}`,
		);
		expect(await refFromPath(`/refs-${tag}/notes/${noteId}`)).toBe(
			`core:note:${noteId}`,
		);
		expect(await refFromPath("/login")).toBeNull();
		expect(await refFromPath(`/refs-${tag}/missing-page`)).toBeNull();
	});

	it("normalizes typed links into stored values", async () => {
		expect(await toStoredLink(`root/refs-${tag}/city:events`)).toBe(
			`ref:scope:${chapter.id}/events`,
		);
		expect(await toStoredLink(`/refs-${tag}/about`)).toBe(
			`ref:core:page:${pageId}`,
		);
		expect(await toStoredLink(`ref:core:article:${articleId}`)).toBe(
			`ref:core:article:${articleId}`,
		);
		expect(await toStoredLink("https://example.com/x")).toBe(
			"https://example.com/x",
		);
		expect(await toStoredLink("mailto:a@b.c")).toBe("mailto:a@b.c");
		expect(await toStoredLink("/login")).toBe("/login");
		expect(await toStoredLink("")).toBe("");
		await expect(toStoredLink("javascript:alert(1)")).rejects.toThrow(
			LinkError,
		);
		await expect(
			toStoredLink(`ref:core:article:${deletedArticleId}`),
		).rejects.toThrow(LinkError);
		await expect(toStoredLink("root/no-such-scope")).rejects.toThrow(LinkError);
	});
});
