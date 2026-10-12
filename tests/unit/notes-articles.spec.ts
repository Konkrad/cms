import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { articlesService } from "~/core/content/articles.service";
import { articles, notes, updatesFor } from "~/core/content/content-api";
import {
	ContentInputError,
	isArticleImageKey,
	NOTE_MAX_LENGTH,
	streamFilterTypes,
} from "~/core/content/content-items";
import { notesService } from "~/core/content/notes.service";
import { stream } from "~/core/content/stream.service";
import { activeModules } from "~/core/registry/manifests";
import { searchLinkTargets } from "~/core/registry/refs";
import { scopeContentFilter } from "~/core/scopes/content-filter";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const created: Array<{ table: "notes" | "articles"; id: string }> = [];
let region: Scope;
let chapter: Scope;
let coordinator: string;
let representative: string;
let member: string;
let outsider: string;
let eventId: string;

function user() {
	const t = createTestUser();
	cleanups.push(t.cleanup);
	return t.userId;
}

async function note(input: Parameters<typeof notesService.create>[0]) {
	const row = await notesService.create(input);
	created.push({ table: "notes", id: row.id });
	return row;
}

async function article(input: Parameters<typeof articlesService.create>[0]) {
	const row = await articlesService.create(input);
	created.push({ table: "articles", id: row.id });
	return row;
}

/** Insert a published item directly, with a chosen `publishedAt` (stream order tests). */
function insert(
	table: "notes" | "articles",
	scopeId: string,
	publishedAt: string,
	visibility = "public",
): string {
	const id = crypto.randomUUID();
	const db = openDb();
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
			publishedAt,
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
			publishedAt,
		);
	db.close();
	created.push({ table, id });
	return id;
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `na-${tag}`, name: "NA" },
		new Set(),
	);
	chapter = await scopesService.create(
		{ parentId: region.id, kind: "chapter", slug: "city", name: "City" },
		new Set(),
	);
	coordinator = user();
	representative = user();
	member = user();
	outsider = user();
	await scopesService.grantRole(coordinator, region.id, "coordinator");
	await scopesService.grantRole(representative, region.id, "representative");
	await scopesService.join(member, region.id);
	const event = createTestEvent(coordinator, { scopeId: region.id });
	eventId = event.eventId;
	cleanups.push(event.cleanup);
});

afterAll(() => {
	const db = openDb();
	for (const { table, id } of created)
		db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
	db.close();
	for (const c of cleanups.splice(0).reverse()) c();
	const d = openDb();
	for (const id of [chapter.id, region.id]) {
		d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		d.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	d.close();
});

const base = () => ({
	scopeId: region.id,
	visibility: "public" as const,
	authorId: coordinator,
});

describe("notes", () => {
	it("sanitizes on write to text with links: no headings, lists or scripts", async () => {
		const row = await note({
			...base(),
			body: '<h2>Doors</h2><ul><li>open at <a href="https://example.com">18:00</a></li></ul><p onclick="x()">Bring<script>alert(1)</script> a friend<img src=x onerror="alert(1)"></p>',
		});
		expect(row.body).toBe(
			'<p>Doors</p><p>open at <a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">18:00</a></p><p>Bring a friend</p>',
		);
		expect(row.authorId).toBe(coordinator);
		expect(row.publishedAt).toBeTruthy();
		// A note has no title or image column at all.
		expect(row).not.toHaveProperty("title");
		expect(row).not.toHaveProperty("featuredImage");
	});

	it(`accepts ${NOTE_MAX_LENGTH} characters of text and rejects more`, async () => {
		const ok = await note({
			...base(),
			body: `<p>${"a".repeat(NOTE_MAX_LENGTH)}</p>`,
		});
		expect(ok.body).toHaveLength(NOTE_MAX_LENGTH + 7);
		await expect(
			note({ ...base(), body: `<p>${"a".repeat(NOTE_MAX_LENGTH + 1)}</p>` }),
		).rejects.toThrow(`at most ${NOTE_MAX_LENGTH} characters`);
		// Markup and link targets do not count.
		await note({
			...base(),
			body: `<p><a href="https://example.com/${"x".repeat(500)}">${"a".repeat(NOTE_MAX_LENGTH - 10)}</a></p>`,
		});
	});

	it("ignores a title and an image passed by a careless caller", async () => {
		const careless = {
			...base(),
			body: "<p>Just text</p>",
			title: "Sneaky",
			featuredImage: "public/articles/x.webp",
		};
		const row = await note(careless);
		const stored = await notesService.getById(row.id);
		expect(stored).not.toHaveProperty("title");
		expect(stored?.body).toBe("<p>Just text</p>");
	});

	it("rejects an empty body, an unknown scope and a visibility the author may not use", async () => {
		await expect(
			note({ ...base(), body: "<p><script>x</script></p>" }),
		).rejects.toBeInstanceOf(ContentInputError);
		await expect(
			note({ ...base(), scopeId: "nope", body: "<p>x</p>" }),
		).rejects.toThrow("Unknown scope");
		// Without a role in the scope, only members-only content (never public).
		await expect(
			note({ ...base(), authorId: outsider, body: "<p>x</p>" }),
		).rejects.toThrow("visibility");
		// A representative's public note is created but waits for review (spec 4.9).
		const inReview = await note({
			...base(),
			authorId: representative,
			body: "<p>x</p>",
		});
		expect(inReview.publishedAt).toBeNull();
		const ok = await note({
			...base(),
			authorId: representative,
			visibility: "members",
			body: "<p>x</p>",
		});
		expect(ok.visibility).toBe("members");
	});

	it("re-checks length, visibility and subject on update", async () => {
		const row = await note({
			...base(),
			authorId: representative,
			visibility: "members",
			body: "<p>x</p>",
		});
		await expect(
			notesService.update(
				row.id,
				{ body: `<p>${"a".repeat(NOTE_MAX_LENGTH + 1)}</p>` },
				representative,
			),
		).rejects.toBeInstanceOf(ContentInputError);
		await expect(
			notesService.update(row.id, { visibility: "public" }, outsider),
		).rejects.toBeInstanceOf(ContentInputError);
		await expect(
			notesService.update(
				row.id,
				{ subjectType: "events:event", subjectId: "missing" },
				representative,
			),
		).rejects.toBeInstanceOf(ContentInputError);
		const updated = await notesService.update(
			row.id,
			{ body: "<p>y<script>z</script></p>" },
			representative,
		);
		expect(updated?.body).toBe("<p>y</p>");
	});
});

describe("articles", () => {
	it("requires a title", async () => {
		for (const title of ["", "   "])
			await expect(
				article({ ...base(), title, body: "<p>x</p>" }),
			).rejects.toThrow("needs a title");
		await expect(
			article({ ...base(), title: "x".repeat(201), body: "<p>x</p>" }),
		).rejects.toThrow("longer than");
		await expect(
			articlesService.update(
				(await article({ ...base(), title: "Keep", body: "<p>x</p>" })).id,
				{ title: "" },
				coordinator,
			),
		).rejects.toThrow("needs a title");
	});

	it("keeps full rich text and strips scripts", async () => {
		const row = await article({
			...base(),
			title: "  Recap  ",
			body: "<h2>Day one</h2><ul><li>Talks</li></ul><p>x<script>y</script></p>",
		});
		expect(row.title).toBe("Recap");
		expect(row.body).toBe("<h2>Day one</h2><ul><li>Talks</li></ul><p>x</p>");
	});

	it.each([
		"public/articles/a.webp",
		// Images of posts from before notes and articles keep working.
		"public/posts/b.webp",
	])("accepts the image key %s", async (key) => {
		expect(isArticleImageKey(key)).toBe(true);
		const row = await article({
			...base(),
			title: "With image",
			featuredImage: key,
			body: "<p>x</p>",
		});
		expect(row.featuredImage).toBe(key);
	});

	it.each([
		"private/profile-pictures/x.webp",
		"public/events/x.webp",
		"public/articles/../../private/x.webp",
		"/public/articles/x.webp",
		"https://evil.example/public/articles/x.webp",
		"public/articles/x.webp?x=<script>",
	])("rejects the image key %s", async (key) => {
		expect(isArticleImageKey(key)).toBe(false);
		await expect(
			article({
				...base(),
				title: "Bad image",
				featuredImage: key,
				body: "<p>x</p>",
			}),
		).rejects.toThrow("Invalid image");
	});

	it("validates a changed image on update and keeps an unchanged one", async () => {
		const row = await article({
			...base(),
			title: "Image",
			featuredImage: "public/articles/c.webp",
			body: "<p>x</p>",
		});
		await expect(
			articlesService.update(
				row.id,
				{ featuredImage: "private/events/x.webp" },
				coordinator,
			),
		).rejects.toThrow("Invalid image");
		const kept = await articlesService.update(
			row.id,
			{ featuredImage: "public/articles/c.webp", title: "Image 2" },
			coordinator,
		);
		expect(kept?.featuredImage).toBe("public/articles/c.webp");
		const cleared = await articlesService.update(
			row.id,
			{ featuredImage: null },
			coordinator,
		);
		expect(cleared?.featuredImage).toBeNull();
	});
});

describe.each([
	["note", note],
	["article", article],
] as const)("subjects of a %s", (_type, create) => {
	const input = (subject: {
		subjectType?: string;
		subjectId?: string | null;
	}) => ({
		...base(),
		title: "About the event",
		body: "<p>About the event</p>",
		...subject,
	});

	it("accepts an existing item of an active module", async () => {
		const row = await create(
			input({ subjectType: "events:event", subjectId: eventId }),
		);
		expect(row.subjectType).toBe("events:event");
		expect(row.subjectId).toBe(eventId);
	});

	it.each([
		["an unknown module", "nomodule:event", "x1"],
		["an unknown type", "events:nothing", "x1"],
		["a missing item", "events:event", "missing-id"],
		["a malformed type", "Events", "x1"],
		["a type without an id", "events:event", null],
	])("rejects %s", async (_label, subjectType, subjectId) => {
		await expect(
			create(input({ subjectType, subjectId })),
		).rejects.toBeInstanceOf(ContentInputError);
	});

	it("rejects an item of an inactive module", async () => {
		const index = activeModules.findIndex((m) => m.id === "events");
		const [events] = activeModules.splice(index, 1);
		try {
			await expect(
				create(input({ subjectType: "events:event", subjectId: eventId })),
			).rejects.toThrow("not active");
		} finally {
			activeModules.splice(index, 0, events);
		}
	});
});

describe("updatesFor (notes and articles about an item)", () => {
	const ids: Record<string, string> = {};

	beforeAll(async () => {
		const subject = { subjectType: "events:event", subjectId: eventId };
		ids.publicArticle = (
			await article({
				...base(),
				...subject,
				title: "Announcement",
				featuredImage: "public/articles/ann.webp",
				body: `<p>public ${tag}</p>`,
			})
		).id;
		ids.membersNote = (
			await note({
				...base(),
				...subject,
				visibility: "members",
				body: `<p>members ${tag}</p>`,
			})
		).id;
		ids.repsNote = (
			await note({
				...base(),
				...subject,
				visibility: "representatives",
				body: `<p>reps ${tag}</p>`,
			})
		).id;
		ids.publicNote = (
			await note({ ...base(), ...subject, body: `<p>doors ${tag}</p>` })
		).id;
		// Unpublished (in review, spec 4.9): never listed.
		ids.unpublished = (
			await note({ ...base(), ...subject, body: `<p>draft ${tag}</p>` })
		).id;
		const db = openDb();
		db.prepare("UPDATE notes SET published_at = NULL WHERE id = ?").run(
			ids.unpublished,
		);
		db.close();
	});

	const seen = async (viewer: string | null) =>
		(
			await updatesFor("events:event", eventId, viewer ? { id: viewer } : null)
		).map((c) => c.id);

	it("shows guests only public items, never unpublished ones", async () => {
		const guest = await seen(null);
		expect(guest).toEqual(
			expect.arrayContaining([ids.publicArticle, ids.publicNote]),
		);
		expect(guest).not.toContain(ids.membersNote);
		expect(guest).not.toContain(ids.repsNote);
		expect(guest).not.toContain(ids.unpublished);
	});

	it("shows members-only items to members, representatives-only to role holders", async () => {
		expect(await seen(member)).toContain(ids.membersNote);
		expect(await seen(member)).not.toContain(ids.repsNote);
		expect(await seen(outsider)).not.toContain(ids.membersNote);
		expect(await seen(representative)).toEqual(
			expect.arrayContaining([ids.membersNote, ids.repsNote]),
		);
	});

	it("mixes both types newest first, as cards with public authors", async () => {
		const cards = await updatesFor("events:event", eventId, null);
		expect(() => assertNoPrivateFields(cards)).not.toThrow();
		const dates = cards.map((c) => c.publishedAt);
		expect([...dates].sort().reverse()).toEqual(dates);
		const card = cards.find((c) => c.id === ids.publicArticle);
		expect(card?.type).toBe("article");
		expect(card?.type === "article" && card.title).toBe("Announcement");
		expect(card?.type === "article" && card.imageUrl).toMatch(
			/public\/articles\/ann\.webp$/,
		);
		expect(card?.url).toBe(`/na-${tag}/articles/${ids.publicArticle}`);
		expect(Object.keys(card?.author ?? {}).sort()).toEqual([
			"displayName",
			"id",
			"profileUrl",
		]);
		const doors = cards.find((c) => c.id === ids.publicNote);
		expect(doors?.type).toBe("note");
		expect(doors?.url).toBe(`/na-${tag}/notes/${ids.publicNote}`);
		expect(doors?.type === "note" && doors.body).toContain(`doors ${tag}`);
	});

	it("per type: notes.forSubject and articles.forSubject", async () => {
		const n = await notes.forSubject("events:event", eventId, null);
		const a = await articles.forSubject("events:event", eventId, null);
		expect(n.every((c) => c.type === "note")).toBe(true);
		expect(n.map((c) => c.id)).toContain(ids.publicNote);
		expect(a.every((c) => c.type === "article")).toBe(true);
		expect(a.map((c) => c.id)).toContain(ids.publicArticle);
	});

	it("deletes only items about the given subject", async () => {
		const other = await note({ ...base(), body: "<p>unrelated</p>" });
		expect(
			await notes.delete(other.id, {
				subjectType: "events:event",
				subjectId: eventId,
			}),
		).toBe(false);
		// The id of a note is not an article.
		expect(await articles.delete(other.id)).toBe(false);
		expect(await notes.delete(other.id)).toBe(true);
		expect(await notesService.getById(other.id)).toBeUndefined();
	});
});

describe("stream", () => {
	// Far in the future, so these items come first in the region's listing.
	const at = (minute: number) =>
		new Date(Date.UTC(2100, 0, 1, 0, minute)).toISOString();
	const order: string[] = [];
	let membersOfChapter: string;

	beforeAll(() => {
		// Newest first: a1, n1, n2, a2, n3, a3 (one minute apart).
		const plan: Array<["notes" | "articles", number]> = [
			["articles", 60],
			["notes", 59],
			["notes", 58],
			["articles", 57],
			["notes", 56],
			["articles", 55],
		];
		for (const [table, minute] of plan)
			order.push(insert(table, region.id, at(minute)));
		// Members-only in the chapter below: never flows up into the region's listing.
		membersOfChapter = insert("notes", chapter.id, at(61), "members");
	});

	const mine = (ids: string[]) => ids.filter((id) => order.includes(id));

	it("merges notes and articles newest first, across cursor pages", async () => {
		const filter = await scopeContentFilter(null, region.id);
		const first = await stream.list(filter, { limit: 4 });
		expect(first.items.map((i) => i.id)).toEqual(order.slice(0, 4));
		expect(first.items.map((i) => i.type)).toEqual([
			"article",
			"note",
			"note",
			"article",
		]);
		const second = await stream.list(filter, {
			limit: 4,
			cursor: first.nextCursor,
		});
		expect(mine(second.items.map((i) => i.id))).toEqual(order.slice(4));
		// Back from the second page: the first page again.
		const back = await stream.list(filter, {
			limit: 4,
			cursor: second.prevCursor,
			direction: "backward",
		});
		expect(back.items.map((i) => i.id)).toEqual(order.slice(0, 4));
	});

	it("filters by type", async () => {
		const filter = await scopeContentFilter(null, region.id);
		const onlyNotes = await stream.list(filter, {
			limit: 3,
			types: streamFilterTypes("notes"),
		});
		expect(onlyNotes.items.map((i) => i.id)).toEqual([
			order[1],
			order[2],
			order[4],
		]);
		const onlyArticles = await stream.list(filter, {
			limit: 3,
			types: streamFilterTypes("articles"),
		});
		expect(onlyArticles.items.map((i) => i.id)).toEqual([
			order[0],
			order[3],
			order[5],
		]);
	});

	it("numbers archive pages over both tables", async () => {
		const filter = await scopeContentFilter(null, region.id);
		const page0 = await stream.page(filter, 0, 4);
		const page1 = await stream.page(filter, 1, 4);
		expect(page0.items.map((i) => i.id)).toEqual(order.slice(0, 4));
		expect(mine(page1.items.map((i) => i.id))).toEqual(order.slice(4));
		expect(page0.totalPages).toBeGreaterThanOrEqual(2);
		const articlesOnly = await stream.page(filter, 0, 2, {
			types: ["article"],
		});
		expect(articlesOnly.items.map((i) => i.id)).toEqual([order[0], order[3]]);
	});

	it("never lists members-only items of a scope below, even to its members", async () => {
		const chapterMember = user();
		await scopesService.join(chapterMember, chapter.id);
		const up = await stream.list(
			await scopeContentFilter({ id: chapterMember }, region.id),
			{ limit: 20 },
		);
		expect(up.items.map((i) => i.id)).not.toContain(membersOfChapter);
		const own = await stream.list(
			await scopeContentFilter({ id: chapterMember }, chapter.id),
			{ limit: 20 },
		);
		expect(own.items.map((i) => i.id)).toContain(membersOfChapter);
	});
});

describe("link picker", () => {
	it("finds public articles by title and public notes by text", async () => {
		await article({ ...base(), title: `Pickme ${tag}`, body: "<p>x</p>" });
		await note({ ...base(), body: `<p>Pickme note ${tag}</p>` });
		const targets = await searchLinkTargets(`Pickme`, 50);
		const labels = targets.map((t) => t.label);
		expect(labels).toContain(`Article: Pickme ${tag}`);
		expect(labels).toContain(`Note: Pickme note ${tag}`);
		expect(
			targets.find((t) => t.label === `Article: Pickme ${tag}`)?.href,
		).toMatch(/^ref:core:article:/);
	});
});
