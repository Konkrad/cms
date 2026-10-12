import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { handleFeedGet } from "~/modules/social-web/feed";
import { cdata, escapeXml } from "~/modules/social-web/rss";
import { createTestUser, openDb } from "./helpers";
import {
	assertWellFormedXml,
	FakeHttpError,
	fakeRequestEvent,
} from "./request-event";

// Social web module (spec 5.3). Items get far-future dates so they are the newest of the shared
// test DB; assertions look at this file's own items.

const tag = Date.now().toString(36);
const APP = "http://localhost:5173";
const cleanups: Array<() => void> = [];
const created: Array<{ table: "notes" | "articles"; id: string }> = [];
let region: Scope;
let author: string;

const at = (day: number, hour = 0) =>
	`2999-02-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

function insertNote(
	body: string,
	publishedAt: string | null,
	visibility = "public",
): string {
	const id = crypto.randomUUID();
	const db = openDb();
	db.prepare(
		"INSERT INTO notes (id, body, author_id, scope_id, visibility, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
	).run(
		id,
		body,
		author,
		region.id,
		visibility,
		publishedAt,
		publishedAt ?? at(1),
	);
	db.close();
	created.push({ table: "notes", id });
	return id;
}

function insertArticle(
	title: string,
	body: string,
	publishedAt: string | null,
	options: { visibility?: string; image?: string | null } = {},
): string {
	const id = crypto.randomUUID();
	const db = openDb();
	db.prepare(
		"INSERT INTO articles (id, title, body, featured_image, author_id, scope_id, visibility, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	).run(
		id,
		title,
		body,
		options.image ?? null,
		author,
		region.id,
		options.visibility ?? "public",
		publishedAt,
		publishedAt ?? at(1),
	);
	db.close();
	created.push({ table: "articles", id });
	return id;
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	region = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `sw-${tag}`, name: "SW" },
		new Set(),
	);
	const user = createTestUser({ name: "Ada", familyName: "Lovelace" });
	cleanups.push(user.cleanup);
	author = user.userId;
});

afterAll(() => {
	const db = openDb();
	for (const { table, id } of created)
		db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
	db.prepare("DELETE FROM content_tombstones WHERE scope_id = ?").run(
		region.id,
	);
	db.prepare("DELETE FROM scopes WHERE id = ?").run(region.id);
	db.close();
	for (const c of cleanups.splice(0).reverse()) c();
});

/** The feed for `query`, checked to be well-formed. */
async function feed(query = "", headers: Record<string, string> = {}) {
	const { event, sent } = fakeRequestEvent(`${APP}/feed.xml${query}`, {
		headers,
	});
	await handleFeedGet(event);
	const response = sent();
	if (!response) throw new Error("nothing sent");
	if (response.status === 200) assertWellFormedXml(response.body);
	return response;
}

/** The `<item>` of the item with this id (its guid ends with the id). */
function itemXml(xml: string, id: string): string | null {
	for (const m of xml.matchAll(/<item>[\s\S]*?<\/item>/g))
		if (m[0].includes(`/${id}</guid>`)) return m[0];
	return null;
}

describe("XML escaping", () => {
	it("escapes text and keeps CDATA intact around ]]>", () => {
		expect(escapeXml(`a < b & "c" > 'd'`)).toBe(
			"a &lt; b &amp; &quot;c&quot; &gt; &apos;d&apos;",
		);
		expect(escapeXml("bell\u0007")).toBe("bell");
		expect(cdata("x ]]> y")).toBe("<![CDATA[x ]]]]><![CDATA[> y]]>");
		assertWellFormedXml(`<a>${cdata("x ]]> y & <b>")}</a>`);
	});
});

describe("RSS feed", () => {
	let note: string;
	let article: string;
	let members: string;
	let unpublished: string;
	let membersArticle: string;

	beforeAll(() => {
		note = insertNote(
			`<p>Doors open at 18:00 &amp; bring a friend ]]> <a href="ref:scope:${"x"}">x</a></p>`,
			at(10),
		);
		article = insertArticle(
			`Summer <BBQ> & more ${tag}`,
			`<p>Long text ${tag}</p><p><a href="/about">About</a></p>`,
			at(9),
			{ image: "public/articles/bbq.webp" },
		);
		members = insertNote(`<p>members ${tag}</p>`, at(11), "members");
		unpublished = insertNote(`<p>in review ${tag}</p>`, null);
		membersArticle = insertArticle(`Members ${tag}`, "<p>m</p>", at(11), {
			visibility: "members",
		});
	});

	it("is RSS 2.0 with the channel's self link and caching headers", async () => {
		const response = await feed();
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"application/rss+xml; charset=utf-8",
		);
		expect(response.body).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
		expect(response.body).toContain('<rss version="2.0"');
		expect(response.body).toContain(
			`<atom:link href="${APP}/feed.xml" rel="self" type="application/rss+xml"/>`,
		);
		expect(response.headers.get("etag")).toMatch(/^"rss-all-.+"$/);
		// The newest public item (members-only ones do not count).
		expect(response.headers.get("last-modified")).toBe(
			new Date(at(10)).toUTCString(),
		);
		expect(response.headers.get("cache-control")).toContain("max-age=");
	});

	it("gives a note no <title> and its full text as <description>", async () => {
		const xml = itemXml((await feed()).body, note);
		expect(xml).not.toBeNull();
		expect(xml).not.toContain("<title>");
		expect(xml).toContain(
			"<description><![CDATA[<p>Doors open at 18:00 &amp; bring a friend ]]]]><![CDATA[> ",
		);
		expect(xml).toContain(
			`<guid isPermaLink="false">${APP}/social/objects/note/${note}</guid>`,
		);
		expect(xml).toContain(`<link>${APP}/sw-${tag}/notes/${note}</link>`);
		expect(xml).toContain(
			`<pubDate>${new Date(at(10)).toUTCString()}</pubDate>`,
		);
	});

	it("gives an article its title, excerpt, full content and image", async () => {
		const xml = itemXml((await feed()).body, article) ?? "";
		expect(xml).toContain(
			`<title>Summer &lt;BBQ&gt; &amp; more ${tag}</title>`,
		);
		expect(xml).toContain(`<description>Long text ${tag} About</description>`);
		// Site-relative links become absolute: the feed is read elsewhere.
		expect(xml).toContain(
			`<content:encoded><![CDATA[<p>Long text ${tag}</p><p><a href="${APP}/about">About</a></p>]]></content:encoded>`,
		);
		expect(xml).toMatch(
			/<media:content url="[^"]*public\/articles\/bbq\.webp" medium="image" type="image\/webp"\/>/,
		);
		expect(xml).toContain(`<link>${APP}/sw-${tag}/articles/${article}</link>`);
	});

	it("names the author by public first name only, never an email", async () => {
		const body = (await feed()).body;
		expect(itemXml(body, note)).toContain("<dc:creator>Ada</dc:creator>");
		expect(body).not.toContain("Lovelace");
		expect(body).not.toMatch(/@example\.com/);
	});

	it("leaves out members-only and unpublished (in review) items", async () => {
		const body = (await feed()).body;
		for (const id of [members, unpublished, membersArticle])
			expect(body).not.toContain(id);
	});

	it("lists notes only for ?kind=short and articles only for ?kind=long", async () => {
		const short = (await feed("?kind=short")).body;
		expect(itemXml(short, note)).not.toBeNull();
		expect(itemXml(short, article)).toBeNull();
		expect(short).not.toContain("<content:encoded>");
		expect(short).toContain(`href="${APP}/feed.xml?kind=short"`);
		const long = (await feed("?kind=long")).body;
		expect(itemXml(long, article)).not.toBeNull();
		expect(itemXml(long, note)).toBeNull();
		await expect(feed("?kind=medium")).rejects.toMatchObject({ status: 400 });
	});

	it("answers 304 to a matching If-None-Match or If-Modified-Since", async () => {
		const first = await feed();
		const etag = first.headers.get("etag") ?? "";
		const again = await feed("", { "if-none-match": etag });
		expect(again.status).toBe(304);
		expect(again.body).toBe("");
		expect((await feed("", { "if-none-match": '"other"' })).status).toBe(200);
		const lastModified = first.headers.get("last-modified") ?? "";
		expect((await feed("", { "if-modified-since": lastModified })).status).toBe(
			304,
		);
		// Another kind is another representation.
		expect((await feed("?kind=short", { "if-none-match": etag })).status).toBe(
			200,
		);
	});

	it("changes its ETag when an item changes", async () => {
		const before = (await feed()).headers.get("etag");
		const db = openDb();
		db.prepare("UPDATE notes SET updated_at = ? WHERE id = ?").run(
			at(12),
			note,
		);
		db.close();
		const after = await feed("", { "if-none-match": before ?? "" });
		expect(after.status).toBe(200);
		expect(after.headers.get("etag")).not.toBe(before);
	});
});

describe("fake request helpers", () => {
	it("surface event.error as a status", () => {
		expect(new FakeHttpError(404, "x").status).toBe(404);
	});
});
