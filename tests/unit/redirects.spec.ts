import { afterAll, describe, expect, it } from "vitest";
import { pagesService } from "~/core/content/pages.service";
import {
	normalizeRedirectPath,
	redirectsService,
	resolveRedirect,
} from "~/core/router/redirects.service";
import { scopesService } from "~/core/scopes/scopes.service";
import { openDb } from "./helpers";

const tag = Date.now().toString(36);
const scopeIds: string[] = [];
const pageIds: string[] = [];

afterAll(() => {
	const db = openDb();
	for (const id of pageIds)
		db.prepare("DELETE FROM pages WHERE id = ?").run(id);
	for (const id of [...scopeIds].reverse()) {
		db.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	db.prepare("DELETE FROM redirects WHERE from_path LIKE ?").run(`%${tag}%`);
	db.close();
});

describe("resolveRedirect", () => {
	const rows = new Map([
		["/germany/berlin", "/france/berlin"],
		["/old-page", "/new-page"],
	]);

	it("matches exact paths and whole-segment prefixes", () => {
		expect(resolveRedirect(rows, "/old-page")).toBe("/new-page");
		expect(resolveRedirect(rows, "/germany/berlin/")).toBe("/france/berlin");
		expect(resolveRedirect(rows, "/germany/berlin/jobs/42")).toBe(
			"/france/berlin/jobs/42",
		);
	});

	it("ignores partial segments and unknown paths", () => {
		expect(resolveRedirect(rows, "/germany/berlin-mitte")).toBeNull();
		expect(resolveRedirect(rows, "/germany")).toBeNull();
		expect(resolveRedirect(rows, "/")).toBeNull();
	});

	it("normalizes paths", () => {
		expect(normalizeRedirectPath("/a/b/")).toBe("/a/b");
		expect(normalizeRedirectPath("a")).toBe("/a");
		expect(normalizeRedirectPath("/")).toBe("/");
	});
});

describe("redirectsService", () => {
	it("collapses chains and drops redirects away from live paths", async () => {
		const a = `/a-${tag}`;
		const b = `/b-${tag}`;
		const c = `/c-${tag}`;
		await redirectsService.add(a, b);
		await redirectsService.add(b, c);
		expect(await redirectsService.resolve(a)).toBe(c);
		expect(await redirectsService.resolve(b)).toBe(c);
		// Moving back to a: a is live again, and nothing loops.
		await redirectsService.add(c, a);
		expect(await redirectsService.resolve(a)).toBeNull();
		expect(await redirectsService.resolve(b)).toBe(a);
		expect(await redirectsService.resolve(c)).toBe(a);
		await redirectsService.release(b);
		expect(await redirectsService.resolve(b)).toBeNull();
	});
});

describe("moving and renaming scopes, renaming pages", () => {
	it("redirects every old path of a moved subtree", async () => {
		const root = await scopesService.ensureRoot();
		const from = await scopesService.create(
			{ parentId: root.id, kind: "region", slug: `from-${tag}`, name: "F" },
			new Set(),
		);
		const to = await scopesService.create(
			{ parentId: root.id, kind: "region", slug: `to-${tag}`, name: "T" },
			new Set(),
		);
		const chapter = await scopesService.create(
			{ parentId: from.id, kind: "chapter", slug: "x", name: "X" },
			new Set(),
		);
		const leaf = await scopesService.create(
			{ parentId: chapter.id, kind: "chapter", slug: "y", name: "Y" },
			new Set(),
		);
		scopeIds.push(from.id, to.id, chapter.id, leaf.id);

		await scopesService.move(chapter.id, to.id);
		expect(await redirectsService.resolve(`/from-${tag}/x`)).toBe(
			`/to-${tag}/x`,
		);
		expect(await redirectsService.resolve(`/from-${tag}/x/y/events/1`)).toBe(
			`/to-${tag}/x/y/events/1`,
		);

		await scopesService.changeSlug(chapter.id, "z", new Set());
		expect((await scopesService.getById(leaf.id))?.path).toBe(
			`/to-${tag}/z/y/`,
		);
		// Both generations of old URLs point at the current one.
		expect(await redirectsService.resolve(`/from-${tag}/x`)).toBe(
			`/to-${tag}/z`,
		);
		// The admin URLs of the subtree move along.
		expect(
			await redirectsService.resolve(`/admin/from-${tag}.x.y/events/1/edit`),
		).toBe(`/admin/to-${tag}.z.y/events/1/edit`);
		expect(await redirectsService.resolve(`/admin/to-${tag}.x`)).toBe(
			`/admin/to-${tag}.z`,
		);
		expect(await redirectsService.resolve(`/to-${tag}/x/y`)).toBe(
			`/to-${tag}/z/y`,
		);

		// A new scope at an old path takes it back.
		const again = await scopesService.create(
			{ parentId: to.id, kind: "chapter", slug: "x", name: "X again" },
			new Set(),
		);
		scopeIds.push(again.id);
		expect(await redirectsService.resolve(`/to-${tag}/x`)).toBeNull();
		expect(await redirectsService.resolve(`/admin/to-${tag}.x`)).toBeNull();
	});

	it("rejects a slug change that collides like a new scope would", async () => {
		const root = await scopesService.ensureRoot();
		const p = await scopesService.create(
			{ parentId: root.id, kind: "region", slug: `p-${tag}`, name: "P" },
			new Set(),
		);
		const one = await scopesService.create(
			{ parentId: p.id, kind: "chapter", slug: "one", name: "1" },
			new Set(),
		);
		const two = await scopesService.create(
			{ parentId: p.id, kind: "chapter", slug: "two", name: "2" },
			new Set(),
		);
		scopeIds.push(p.id, one.id, two.id);
		await expect(
			scopesService.changeSlug(two.id, "one", new Set()),
		).rejects.toThrow(/already exists/);
		await expect(
			scopesService.changeSlug(two.id, "events", new Set(["events"])),
		).rejects.toThrow(/reserved/);
		const page = await pagesService.create(
			{ scopeId: p.id, slug: "about", title: "About" },
			[],
		);
		pageIds.push(page.id);
		await expect(
			scopesService.changeSlug(two.id, "about", new Set()),
		).rejects.toThrow(/page/);
	});

	it("redirects a page's old URL after a slug change", async () => {
		const root = await scopesService.ensureRoot();
		const page = await pagesService.create(
			{ scopeId: root.id, slug: `team-${tag}`, title: "Team" },
			[],
		);
		pageIds.push(page.id);
		await pagesService.update(page.id, { slug: `people-${tag}` }, []);
		expect(await redirectsService.resolve(`/team-${tag}`)).toBe(
			`/people-${tag}`,
		);
		// A new page at the old URL takes it back.
		const again = await pagesService.create(
			{ scopeId: root.id, slug: `team-${tag}`, title: "Team again" },
			[],
		);
		pageIds.push(again.id);
		expect(await redirectsService.resolve(`/team-${tag}`)).toBeNull();
	});
});
