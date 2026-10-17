import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { articlesService } from "~/core/content/articles.service";
import { notesService } from "~/core/content/notes.service";
import { publicFeed } from "~/core/content/public-feed.service";
import { tombstonesService } from "~/core/content/tombstones.service";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

// The public feed (spec 5.3): public, published notes and articles of the whole site as a guest
// sees them, plus tombstones. The test DB is shared with other files, so this file's items get
// far-future dates (they sort first) and assertions look at its own ids only.

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const created: Array<{ table: "notes" | "articles"; id: string }> = [];
let region: Scope;
let chapter: Scope;
let coordinator: string;
let representative: string;

function user() {
	const t = createTestUser();
	cleanups.push(t.cleanup);
	return t.userId;
}

/** A published item inserted directly with a chosen `publishedAt`. */
function insert(
	table: "notes" | "articles",
	scopeId: string,
	publishedAt: string | null,
	visibility = "public",
): string {
	const id = crypto.randomUUID();
	const db = openDb();
	const at = publishedAt ?? "2999-01-01T00:00:00.000Z";
	if (table === "notes")
		db.prepare(
			"INSERT INTO notes (id, body, author_id, scope_id, visibility, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).run(
			id,
			`<p>n ${tag}</p>`,
			coordinator,
			scopeId,
			visibility,
			publishedAt,
			at,
		);
	else
		db.prepare(
			"INSERT INTO articles (id, title, body, author_id, scope_id, visibility, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run(
			id,
			`a ${tag}`,
			"<p>a</p>",
			coordinator,
			scopeId,
			visibility,
			publishedAt,
			at,
		);
	db.close();
	created.push({ table, id });
	return id;
}

const at = (n: number) =>
	`2999-0${Math.floor(n / 28) + 1}-${String((n % 28) + 1).padStart(2, "0")}T00:00:00.000Z`;

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `pf-${tag}`, name: "PF" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "town", name: "Town" },
		new Set(),
	);
	coordinator = user();
	representative = user();
	await scopesService.grantRole(coordinator, region.id, "coordinator");
	await scopesService.grantRole(representative, chapter.id, "representative");
});

afterAll(() => {
	const db = openDb();
	for (const { table, id } of created)
		db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
	db.prepare("DELETE FROM content_tombstones WHERE scope_id IN (?, ?)").run(
		region.id,
		chapter.id,
	);
	db.prepare("DELETE FROM reviews WHERE scope_id IN (?, ?)").run(
		region.id,
		chapter.id,
	);
	db.close();
	for (const c of cleanups.splice(0).reverse()) c();
	const d = openDb();
	for (const id of [chapter.id, region.id]) {
		d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	d.close();
});

describe("publicFeed.items", () => {
	it("lists public, published notes and articles of every scope, newest first", async () => {
		const n = insert("notes", chapter.id, at(3));
		const a = insert("articles", region.id, at(2));
		const members = insert("notes", region.id, at(4), "members");
		const reps = insert("articles", chapter.id, at(4), "representatives");
		const unpublished = insert("notes", chapter.id, null);
		const ids = (await publicFeed.items({ limit: 200 })).map((i) => i.id);
		expect(ids.indexOf(n)).toBeGreaterThanOrEqual(0);
		expect(ids.indexOf(n)).toBeLessThan(ids.indexOf(a));
		for (const hidden of [members, reps, unpublished])
			expect(ids).not.toContain(hidden);
	});

	it("narrows to one type", async () => {
		const n = insert("notes", region.id, at(5));
		const a = insert("articles", region.id, at(5));
		const notesOnly = await publicFeed.items({ types: ["note"], limit: 200 });
		expect(notesOnly.every((i) => i.type === "note")).toBe(true);
		expect(notesOnly.map((i) => i.id)).toContain(n);
		const articlesOnly = await publicFeed.items({
			types: ["article"],
			limit: 200,
		});
		expect(articlesOnly.every((i) => i.type === "article")).toBe(true);
		expect(articlesOnly.map((i) => i.id)).toContain(a);
	});

	it("leaves out a representative's public note while it waits for review", async () => {
		const row = await notesService.create({
			scopeId: chapter.id,
			visibility: "public",
			authorId: representative,
			body: `<p>review ${tag}</p>`,
		});
		created.push({ table: "notes", id: row.id });
		expect(row.publishedAt).toBeNull();
		const ids = (await publicFeed.items({ limit: 500 })).map((i) => i.id);
		expect(ids).not.toContain(row.id);
		expect(await publicFeed.get("note", row.id)).toBeNull();
	});
});

describe("tombstones", () => {
	it("deleting a public, published note or article leaves a tombstone", async () => {
		const note = await notesService.create({
			scopeId: region.id,
			visibility: "public",
			authorId: coordinator,
			body: `<p>bye ${tag}</p>`,
		});
		expect(note.publishedAt).toBeTruthy();
		expect(await publicFeed.get("note", note.id)).toMatchObject({
			item: { id: note.id, type: "note" },
		});
		await notesService.delete(note.id);
		const grave = await tombstonesService.get("note", note.id);
		expect(grave).toMatchObject({
			ref: `core:note:${note.id}`,
			type: "note",
			itemId: note.id,
			scopeId: region.id,
			publishedAt: note.publishedAt,
		});
		expect(await publicFeed.get("note", note.id)).toMatchObject({
			item: null,
			tombstone: { itemId: note.id },
		});

		const article = await articlesService.create({
			scopeId: region.id,
			visibility: "public",
			authorId: coordinator,
			title: `Gone ${tag}`,
			body: "<p>x</p>",
		});
		await articlesService.delete(article.id);
		expect(await tombstonesService.get("article", article.id)).toMatchObject({
			type: "article",
		});
	});

	it("deleting a members-only or unpublished item leaves none", async () => {
		const members = insert("notes", region.id, at(6), "members");
		const unpublished = insert("articles", chapter.id, null);
		await notesService.delete(members);
		await articlesService.delete(unpublished);
		expect(await tombstonesService.get("note", members)).toBeNull();
		expect(await tombstonesService.get("article", unpublished)).toBeNull();
	});

	it("making an item members-only tombstones it; public again removes the tombstone", async () => {
		const note = await notesService.create({
			scopeId: region.id,
			visibility: "public",
			authorId: coordinator,
			body: `<p>flip ${tag}</p>`,
		});
		created.push({ table: "notes", id: note.id });
		await notesService.update(note.id, { visibility: "members" }, coordinator);
		expect(await tombstonesService.get("note", note.id)).not.toBeNull();
		expect(await publicFeed.get("note", note.id)).toMatchObject({
			item: null,
		});
		await notesService.update(note.id, { visibility: "public" }, coordinator);
		expect(await tombstonesService.get("note", note.id)).toBeNull();
		expect(await publicFeed.get("note", note.id)).toMatchObject({
			item: { id: note.id },
		});
	});
});

describe("publicFeed.entries", () => {
	it("pages creates and deletes newest first, stable across pages", async () => {
		const older = insert("notes", region.id, at(40));
		const newer = insert("articles", chapter.id, at(41));
		const doomed = insert("notes", region.id, at(42));
		const db = openDb();
		db.prepare(
			"INSERT INTO content_tombstones (ref, type, item_id, scope_id, published_at, deleted_at) VALUES (?, 'note', ?, ?, ?, ?)",
		).run(`core:note:${doomed}`, doomed, region.id, at(42), at(43));
		db.prepare("DELETE FROM notes WHERE id = ?").run(doomed);
		db.close();

		const first = await publicFeed.entries({ limit: 2 });
		expect(first?.entries.map((e) => [e.activity, e.id])).toEqual([
			["delete", doomed],
			["create", doomed],
		]);
		expect(first?.entries[0].tombstone?.deletedAt).toBe(at(43));
		expect(first?.entries[1]).toMatchObject({
			at: at(42),
			item: null,
			tombstone: { itemId: doomed },
		});
		const second = await publicFeed.entries({
			limit: 2,
			cursor: first?.nextCursor,
		});
		expect(second?.entries.map((e) => [e.activity, e.id])).toEqual([
			["create", newer],
			["create", older],
		]);
		expect(second?.entries[0].item).toMatchObject({
			type: "article",
			title: `a ${tag}`,
		});
		expect(second?.nextCursor).toBeTruthy();
		// Without the new entries the next page continues from the cursor.
		const third = await publicFeed.entries({
			limit: 500,
			cursor: second?.nextCursor,
		});
		const ids = third?.entries.map((e) => e.id) ?? [];
		expect(ids).not.toContain(older);
		expect(ids).not.toContain(doomed);
	});

	it("rejects a malformed cursor", async () => {
		expect(await publicFeed.entries({ cursor: "nonsense" })).toBeNull();
	});

	it("counts every entry", async () => {
		const before = await publicFeed.totalEntries();
		insert("notes", region.id, at(50));
		insert("notes", region.id, at(50), "members");
		expect(await publicFeed.totalEntries()).toBe(before + 1);
	});
});

describe("publicFeed.version", () => {
	it("changes after an edit and after a delete", async () => {
		const id = insert("notes", region.id, at(60));
		const v1 = await publicFeed.version();
		expect(v1.lastModified).toBeTruthy();
		const db = openDb();
		db.prepare("UPDATE notes SET updated_at = ? WHERE id = ?").run(at(61), id);
		db.close();
		const v2 = await publicFeed.version();
		expect(v2.tag).not.toBe(v1.tag);
		expect(v2.lastModified).toBe(at(61));
		await notesService.delete(id);
		const v3 = await publicFeed.version();
		expect(v3.tag).not.toBe(v2.tag);
		// Notes only: an article change does not touch it.
		const notesOnly = await publicFeed.version(["note"]);
		insert("articles", region.id, at(62));
		expect((await publicFeed.version(["note"])).tag).toBe(notesOnly.tag);
	});
});
