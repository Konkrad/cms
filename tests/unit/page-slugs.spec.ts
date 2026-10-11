import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCmsPage } from "~/core/content/cms-page";
import {
	PageError,
	pagesService,
	sanitizeBlocks,
	slugFromPath,
} from "~/core/content/pages.service";
import { defineModule } from "~/core/router/modules";
import { definePage } from "~/core/router/pages";
import { pageSlugProblem } from "~/core/router/reserved-slugs";
import type { Scope } from "~/core/scopes/schema/scopes";
import { ScopeError, scopesService } from "~/core/scopes/scopes.service";
import { openDb } from "./helpers";

const jobs = defineModule({
	id: "jobs",
	pages: [
		definePage({ id: "jobs.list", path: "/jobs", load: async () => null }),
		definePage({ id: "ev", path: "/events/:id", load: async () => null }),
	],
});

describe("pageSlugProblem", () => {
	const ctx = (isRoot: boolean, children: string[] = []) => ({
		isRoot,
		modules: [jobs],
		childScopeSlugs: new Set(children),
	});

	it("allows the empty slug (home page) on the root only", () => {
		expect(pageSlugProblem("", ctx(true))).toBeNull();
		expect(pageSlugProblem("", ctx(false))).toMatch(/Only the root/);
	});

	it("accepts one lowercase segment", () => {
		expect(pageSlugProblem("about-us", ctx(false))).toBeNull();
		for (const bad of ["About", "a/b", "-x", "x-", "a b", "ä"]) {
			expect(pageSlugProblem(bad, ctx(false))).not.toBeNull();
		}
	});

	it("rejects a child scope's slug at the same level", () => {
		expect(pageSlugProblem("berlin", ctx(false, ["berlin"]))).toMatch(
			/group called "berlin"/,
		);
		expect(pageSlugProblem("berlin", ctx(false, ["munich"]))).toBeNull();
	});

	it("rejects static core routes at the root only", () => {
		expect(pageSlugProblem("login", ctx(true))).toMatch(/reserved/);
		expect(pageSlugProblem("login", ctx(false))).toBeNull();
	});

	it("rejects a slug a module page would shadow, at every level", () => {
		expect(pageSlugProblem("jobs", ctx(true))).toMatch(/module page/);
		expect(pageSlugProblem("jobs", ctx(false))).toMatch(/module page/);
		// "/events/:id" does not match "/events": a listing page may live there.
		expect(pageSlugProblem("events", ctx(true))).toBeNull();
	});

	it("slugFromPath strips slashes", () => {
		expect(slugFromPath("/about/")).toBe("about");
		expect(slugFromPath("/")).toBe("");
	});
});

describe("pages and scopes never collide", () => {
	const tag = Date.now().toString(36);
	let region: Scope;
	const pageIds: string[] = [];
	const scopeIds: string[] = [];

	beforeAll(async () => {
		const root = await scopesService.ensureRoot();
		region = await scopesService.create(
			{ parentId: root.id, kind: "region", slug: `pg-${tag}`, name: "R" },
			new Set(),
		);
		scopeIds.push(region.id);
	});

	afterAll(() => {
		const db = openDb();
		for (const id of pageIds)
			db.prepare("DELETE FROM pages WHERE id = ?").run(id);
		for (const id of [...scopeIds].reverse()) {
			db.prepare("DELETE FROM scopes WHERE id = ?").run(id);
		}
		db.close();
	});

	it("rejects a page whose slug is a child scope", async () => {
		const child = await scopesService.create(
			{ parentId: region.id, kind: "chapter", slug: "berlin", name: "B" },
			new Set(),
		);
		scopeIds.push(child.id);
		await expect(
			pagesService.create(
				{ scopeId: region.id, slug: "berlin", title: "Berlin page" },
				[],
			),
		).rejects.toBeInstanceOf(PageError);
	});

	it("rejects a scope whose slug is a page of the parent (create and move)", async () => {
		const page = await pagesService.create(
			{ scopeId: region.id, slug: "about", title: "About" },
			[],
		);
		pageIds.push(page.id);
		await expect(
			scopesService.create(
				{ parentId: region.id, kind: "chapter", slug: "about", name: "A" },
				new Set(),
			),
		).rejects.toBeInstanceOf(ScopeError);

		const root = await scopesService.getRoot();
		const elsewhere = await scopesService.create(
			{ parentId: root!.id, kind: "region", slug: `about-${tag}`, name: "E" },
			new Set(),
		);
		scopeIds.push(elsewhere.id);
		const mover = await scopesService.create(
			{ parentId: elsewhere.id, kind: "chapter", slug: "about", name: "M" },
			new Set(),
		);
		scopeIds.push(mover.id);
		await expect(scopesService.move(mover.id, region.id)).rejects.toThrow(
			/already exists/,
		);
	});

	it("rejects a duplicate slug in one scope, allows it in another", async () => {
		await expect(
			pagesService.create(
				{ scopeId: region.id, slug: "about", title: "Again" },
				[],
			),
		).rejects.toBeInstanceOf(PageError);
		const root = await scopesService.getRoot();
		const other = await scopesService.create(
			{ parentId: root!.id, kind: "region", slug: `o-${tag}`, name: "O" },
			new Set(),
		);
		scopeIds.push(other.id);
		const page = await pagesService.create(
			{ scopeId: other.id, slug: "about", title: "About O" },
			[],
		);
		pageIds.push(page.id);
		expect(page.slug).toBe("about");
	});

	it("checks a changed slug like a new one", async () => {
		const page = await pagesService.create(
			{ scopeId: region.id, slug: "team", title: "Team" },
			[],
		);
		pageIds.push(page.id);
		await expect(
			pagesService.update(page.id, { slug: "berlin" }, []),
		).rejects.toBeInstanceOf(PageError);
		const { before, after } = await pagesService.update(
			page.id,
			{ slug: "people" },
			[],
		);
		expect([before.slug, after.slug]).toEqual(["team", "people"]);
	});

	it("serves a published page at its scope's path only", async () => {
		const page = await pagesService.create(
			{
				scopeId: region.id,
				slug: "visit",
				title: "Visit",
				status: "published",
			},
			[],
		);
		pageIds.push(page.id);
		let status = 200;
		const event = {
			status: (s: number) => {
				status = s;
				return s;
			},
		} as unknown as Parameters<typeof loadCmsPage>[0];
		expect((await loadCmsPage(event, region, "/visit"))?.title).toBe("Visit");
		const root = await scopesService.getRoot();
		expect(await loadCmsPage(event, root, "/visit")).toBeNull();
		expect(status).toBe(404);
		expect(await loadCmsPage(event, region, "/visit/more")).toBeNull();
		await pagesService.update(page.id, { status: "draft" }, []);
		expect(await loadCmsPage(event, region, "/visit")).toBeNull();
	});
});

describe("sanitizeBlocks", () => {
	it("sanitizes HTML blocks and drops script URLs anywhere", () => {
		const [text, button] = sanitizeBlocks([
			{
				id: "1",
				componentType: "TextBlock",
				order: 0,
				data: { content: '<p onclick="x()">hi</p><script>alert(1)</script>' },
			},
			{
				id: "2",
				componentType: "ActionButtonBlock",
				order: 1,
				data: {
					url: "javascript:alert(1)",
					text: "JavaScript meetup",
					items: [{ href: " JAVASCRIPT:alert(2)" }],
				},
			},
		]);
		expect(text.data.content).toBe("<p>hi</p>");
		expect(button.data.url).toBe("");
		expect(button.data.text).toBe("JavaScript meetup");
		expect(button.data.items[0].href).toBe("");
	});
});
