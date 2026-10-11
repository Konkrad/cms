import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePostTitle, postKind } from "~/core/content/posts";
import { PostInputError, postsService } from "~/core/content/posts.service";
import { posts } from "~/core/content/posts-api";
import { activeModules } from "~/core/registry/manifests";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const postIds: string[] = [];
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

async function create(input: Parameters<typeof postsService.create>[0]) {
	const post = await postsService.create(input);
	postIds.push(post.id);
	return post;
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	chapter = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `posts-${tag}`, name: "Posts" },
		new Set(),
	);
	coordinator = user();
	representative = user();
	member = user();
	outsider = user();
	await scopesService.grantRole(coordinator, chapter.id, "coordinator");
	await scopesService.grantRole(representative, chapter.id, "representative");
	await scopesService.join(member, chapter.id);
	const event = createTestEvent(coordinator, { scopeId: chapter.id });
	eventId = event.eventId;
	cleanups.push(event.cleanup);
});

afterAll(() => {
	const db = openDb();
	for (const id of postIds)
		db.prepare("DELETE FROM posts WHERE id = ?").run(id);
	db.close();
	for (const c of cleanups.splice(0).reverse()) c();
	const d = openDb();
	d.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(chapter.id);
	d.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(chapter.id);
	d.prepare("DELETE FROM scopes WHERE id = ?").run(chapter.id);
	d.close();
});

describe("note or article", () => {
	it("an untitled post is a note, a titled one an article", () => {
		expect(postKind({ title: null })).toBe("note");
		expect(postKind({ title: "   " })).toBe("note");
		expect(postKind({ title: "Recap" })).toBe("article");
		expect(normalizePostTitle("  Recap ")).toBe("Recap");
		expect(normalizePostTitle("")).toBeNull();
	});
});

describe("postsService.create", () => {
	it("sanitizes the body on write and publishes", async () => {
		const post = await create({
			scopeId: chapter.id,
			title: "",
			body: '<p onclick="x()">Doors open at 18:00<script>alert(1)</script><img src=x onerror="alert(1)"></p>',
			visibility: "public",
			authorId: coordinator,
		});
		expect(post.body).toBe("<p>Doors open at 18:00</p>");
		expect(post.title).toBeNull();
		expect(post.authorId).toBe(coordinator);
		expect(post.publishedAt).toBeTruthy();
	});

	it("rejects an empty body", async () => {
		await expect(
			create({
				scopeId: chapter.id,
				body: "<p><script>x</script></p>",
				visibility: "members",
				authorId: member,
			}),
		).rejects.toBeInstanceOf(PostInputError);
	});

	it("rejects a visibility the author may not use on the scope", async () => {
		// Public chapter content from a representative needs review (spec 4.9): not allowed yet.
		await expect(
			create({
				scopeId: chapter.id,
				body: "<p>x</p>",
				visibility: "public",
				authorId: representative,
			}),
		).rejects.toThrow("visibility");
		const ok = await create({
			scopeId: chapter.id,
			body: "<p>x</p>",
			visibility: "members",
			authorId: representative,
		});
		expect(ok.visibility).toBe("members");
	});

	it("rejects an unknown scope", async () => {
		await expect(
			create({
				scopeId: "nope",
				body: "<p>x</p>",
				visibility: "members",
				authorId: member,
			}),
		).rejects.toThrow("Unknown scope");
	});
});

describe("subjects", () => {
	const base = () => ({
		scopeId: chapter.id,
		body: "<p>About the event</p>",
		visibility: "public" as const,
		authorId: coordinator,
	});

	it("accepts an existing item of an active module", async () => {
		const post = await create({
			...base(),
			subjectType: "events:event",
			subjectId: eventId,
		});
		expect(post.subjectType).toBe("events:event");
		expect(post.subjectId).toBe(eventId);
	});

	it.each([
		["an unknown module", "nomodule:event", "x1"],
		["an unknown type", "events:nothing", "x1"],
		["a missing item", "events:event", "missing-id"],
		["a malformed type", "Events", "x1"],
	])("rejects %s", async (_label, subjectType, subjectId) => {
		await expect(
			create({ ...base(), subjectType, subjectId }),
		).rejects.toBeInstanceOf(PostInputError);
	});

	it("rejects a type without an id", async () => {
		await expect(
			create({ ...base(), subjectType: "events:event", subjectId: null }),
		).rejects.toBeInstanceOf(PostInputError);
	});

	it("rejects an item of an inactive module", async () => {
		const index = activeModules.findIndex((m) => m.id === "events");
		const [events] = activeModules.splice(index, 1);
		try {
			await expect(
				create({ ...base(), subjectType: "events:event", subjectId: eventId }),
			).rejects.toThrow("not active");
		} finally {
			activeModules.splice(index, 0, events);
		}
	});
});

describe("posts.forSubject", () => {
	let publicId: string;
	let membersId: string;
	let repsId: string;

	beforeAll(async () => {
		const subject = { subjectType: "events:event", subjectId: eventId };
		const mk = async (
			visibility: "public" | "members" | "representatives",
			title: string | null,
		) =>
			(
				await create({
					scopeId: chapter.id,
					title,
					body: `<p>${visibility} ${tag}</p>`,
					visibility,
					authorId: coordinator,
					...subject,
				})
			).id;
		publicId = await mk("public", "Announcement");
		membersId = await mk("members", null);
		repsId = await mk("representatives", null);
	});

	const ids = async (viewer: string | null) =>
		(
			await posts.forSubject(
				"events:event",
				eventId,
				viewer ? { id: viewer } : null,
			)
		).map((p) => p.id);

	it("shows guests only public posts", async () => {
		const seen = await ids(null);
		expect(seen).toContain(publicId);
		expect(seen).not.toContain(membersId);
		expect(seen).not.toContain(repsId);
	});

	it("shows members-only posts to members, representatives-only to role holders", async () => {
		expect(await ids(member)).toEqual(
			expect.arrayContaining([publicId, membersId]),
		);
		expect(await ids(member)).not.toContain(repsId);
		expect(await ids(outsider)).not.toContain(membersId);
		expect(await ids(representative)).toEqual(
			expect.arrayContaining([publicId, membersId, repsId]),
		);
	});

	it("returns theme payloads with public authors and the right kind", async () => {
		const cards = await posts.forSubject("events:event", eventId, null);
		expect(() => assertNoPrivateFields(cards)).not.toThrow();
		const card = cards.find((c) => c.id === publicId);
		expect(card?.kind).toBe("article");
		expect(card?.title).toBe("Announcement");
		expect(card?.url).toBe(`/posts-${tag}/posts/${publicId}`);
		expect(Object.keys(card?.author ?? {}).sort()).toEqual([
			"displayName",
			"id",
			"profileUrl",
		]);
		const note = (
			await posts.forSubject("events:event", eventId, {
				id: member,
			})
		).find((c) => c.id === membersId);
		expect(note?.kind).toBe("note");
		expect(note?.title).toBeNull();
		expect(note?.body).toContain(`members ${tag}`);
	});

	it("only lists posts about that item", async () => {
		const other = await create({
			scopeId: chapter.id,
			body: "<p>unrelated</p>",
			visibility: "public",
			authorId: coordinator,
		});
		expect(await ids(null)).not.toContain(other.id);
	});
});

describe("update and delete", () => {
	it("sanitizes on update and turns an article into a note", async () => {
		const post = await create({
			scopeId: chapter.id,
			title: "Recap",
			body: "<p>Long text</p>",
			visibility: "public",
			authorId: coordinator,
		});
		const updated = await postsService.update(
			post.id,
			{ title: "", body: "<p>Short<script>x</script></p>" },
			coordinator,
		);
		expect(updated?.title).toBeNull();
		expect(updated?.body).toBe("<p>Short</p>");
		expect(postKind(updated ?? { title: null })).toBe("note");
	});

	it("checks a changed visibility against the editor", async () => {
		const post = await create({
			scopeId: chapter.id,
			body: "<p>x</p>",
			visibility: "members",
			authorId: representative,
		});
		await expect(
			postsService.update(post.id, { visibility: "public" }, representative),
		).rejects.toBeInstanceOf(PostInputError);
	});

	it("deletes only a post about the given subject", async () => {
		const post = await create({
			scopeId: chapter.id,
			body: "<p>x</p>",
			visibility: "public",
			authorId: coordinator,
		});
		expect(
			await posts.delete(post.id, {
				subjectType: "events:event",
				subjectId: eventId,
			}),
		).toBe(false);
		expect(await posts.delete(post.id)).toBe(true);
		expect(await postsService.getById(post.id)).toBeUndefined();
	});
});
