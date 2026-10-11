import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postsService } from "~/core/content/posts.service";
import { scopeContentFilter } from "~/core/scopes/content-filter";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const scopeIds: string[] = [];
let region: Scope;
let chapter: Scope;
let sibling: Scope;
let author: string;
let chapterMember: string;
let siblingMember: string;
let regionPostId: string;

function user() {
	const t = createTestUser();
	cleanups.push(t.cleanup);
	return t.userId;
}

function insertPost(scopeId: string, visibility: string) {
	const id = crypto.randomUUID();
	const db = openDb();
	db.prepare(
		"INSERT INTO posts (id, title, body, user_id, scope_id, visibility) VALUES (?, ?, ?, ?, ?, ?)",
	).run(id, `Scope post ${tag} ${id}`, "<p>x</p>", author, scopeId, visibility);
	db.close();
	cleanups.unshift(() => {
		const d = openDb();
		d.prepare("DELETE FROM posts WHERE id = ?").run(id);
		d.close();
	});
	return id;
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `reg-${tag}`, name: "Region" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "a", name: "Chapter A" },
		new Set(),
	);
	sibling = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `sib-${tag}`, name: "Sibling" },
		new Set(),
	);
	scopeIds.push(region.id, chapter.id, sibling.id);
	author = user();
	chapterMember = user();
	siblingMember = user();
	await scopesService.join(chapterMember, chapter.id);
	await scopesService.join(siblingMember, sibling.id);
	regionPostId = insertPost(region.id, "members");
});

afterAll(() => {
	for (const c of cleanups.splice(0)) c();
	const db = openDb();
	for (const id of [...scopeIds].reverse()) {
		db.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		db.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	db.close();
});

describe("members-only content flows to members of the scopes below", () => {
	it("canView: a chapter member sees the region's members-only post", async () => {
		const post = { visibility: "members", scopeId: region.id };
		expect(await postsService.canView(post, { id: chapterMember })).toBe(true);
		expect(await postsService.canView(post, { id: siblingMember })).toBe(false);
		expect(await postsService.canView(post, null)).toBe(false);
	});

	it("the chapter's listing includes it for the chapter member only", async () => {
		const ids = async (viewer: string | null) =>
			(
				await postsService.getAll(
					await scopeContentFilter(viewer ? { id: viewer } : null, chapter.id),
					100,
				)
			).items.map((p) => p.id);
		expect(await ids(chapterMember)).toContain(regionPostId);
		expect(await ids(siblingMember)).not.toContain(regionPostId);
		expect(await ids(null)).not.toContain(regionPostId);
	});

	it("never flows up: the root listing does not show it, even to the member", async () => {
		const rootIds = (
			await postsService.getAll(
				await scopeContentFilter({ id: chapterMember }),
				100,
			)
		).items.map((p) => p.id);
		expect(rootIds).not.toContain(regionPostId);
	});

	it("a region member does not see a chapter's members-only post", async () => {
		const regionMember = user();
		await scopesService.join(regionMember, region.id);
		const post = { visibility: "members", scopeId: chapter.id };
		expect(await postsService.canView(post, { id: regionMember })).toBe(false);
		expect(await postsService.canView(post, { id: chapterMember })).toBe(true);
	});
});

describe("scope labels and member scopes", () => {
	it("labels representatives and members", async () => {
		const rep = user();
		await scopesService.grantRole(rep, chapter.id, "representative");
		const labels = await scopesService.getScopeLabels([
			rep,
			chapterMember,
			author,
		]);
		expect(labels[rep]).toBe("Local Rep Chapter A");
		expect(labels[chapterMember]).toBe("Chapter A");
		expect(labels[author]).toBeUndefined();
	});

	it("lists the joined scopes", async () => {
		expect(
			(await scopesService.listUserScopes(chapterMember)).map((s) => s.id),
		).toEqual([chapter.id]);
	});
});
