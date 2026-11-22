import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveMenuUrls } from "~/core/content/menu-links";
import { pagesService } from "~/core/content/pages.service";
import type { MenuItem } from "~/core/content/schema/menu-items";
import { allModules } from "~/core/registry/manifests";
import { scopeContentFilter } from "~/core/scopes/content-filter";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { dealsService } from "~/modules/deals/service";
import { createTestUser, openDb } from "./helpers";

// Members-only pages and deals (spec 4.2): hidden from the sitemap, from menus and from
// listings for everyone who may not open them.

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
let root: Scope;
let chapter: Scope;
let member: string;
let outsider: string;

beforeAll(async () => {
	root = await scopesService.ensureRoot();
	chapter = await scopesService.create(
		{ parentId: root.id, kind: "region", slug: `mo-${tag}`, name: "Members" },
		new Set(),
	);
	for (const name of ["member", "outsider"]) {
		const u = createTestUser({ name });
		cleanups.push(u.cleanup);
		if (name === "member") member = u.userId;
		else outsider = u.userId;
	}
	await scopesService.join(member, chapter.id);
});

afterAll(() => {
	for (const c of cleanups.reverse()) c();
	const db = openDb();
	db.prepare("DELETE FROM deals WHERE scope_id = ?").run(chapter.id);
	db.prepare("DELETE FROM pages WHERE scope_id = ?").run(chapter.id);
	db.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(
		chapter.id,
	);
	db.prepare("DELETE FROM scopes WHERE id = ?").run(chapter.id);
	db.close();
});

const menuItem = (url: string): MenuItem =>
	({
		id: crypto.randomUUID(),
		menuName: "main",
		title: "Link",
		url,
		pageId: null,
		parentId: null,
		position: 0,
		status: "visible",
		icon: null,
		target: "_self",
		createdAt: "",
		updatedAt: "",
	}) as MenuItem;

describe("members-only pages", () => {
	it("are left out of the sitemap and of menus for people who may not open them", async () => {
		const open = await pagesService.create(
			{
				scopeId: chapter.id,
				slug: "open",
				title: "Open",
				status: "published",
			},
			allModules,
		);
		const inner = await pagesService.create(
			{
				scopeId: chapter.id,
				slug: "inner",
				title: "Inner",
				status: "published",
				visibility: "members",
			},
			allModules,
		);
		expect(inner.visibility).toBe("members");

		const sitemap = (await pagesService.getPublishedUrls()).map((p) => p.url);
		expect(sitemap).toContain(`/mo-${tag}/open`);
		expect(sitemap).not.toContain(`/mo-${tag}/inner`);

		const items = [
			menuItem(`ref:core:page:${open.id}`),
			menuItem(`ref:core:page:${inner.id}`),
		];
		const urls = async (viewer: { id: string } | null) =>
			(await resolveMenuUrls(items, viewer)).map((i) => i.url);
		expect(await urls(null)).toEqual([`/mo-${tag}/open`]);
		expect(await urls({ id: outsider })).toEqual([`/mo-${tag}/open`]);
		expect(await urls({ id: member })).toEqual([
			`/mo-${tag}/open`,
			`/mo-${tag}/inner`,
		]);
	});
});

describe("members-only deals", () => {
	it("are listed only for members of the scope", async () => {
		const common = {
			description: null,
			logo: null,
			validUntil: null,
			steps: [],
			scopeId: chapter.id,
		};
		await dealsService.create({ ...common, name: `Open ${tag}` } as never);
		await dealsService.create({
			...common,
			name: `Inner ${tag}`,
			visibility: "members",
			requiredMembershipTier: "full",
		} as never);
		const names = async (viewer: { id: string } | null) =>
			(await dealsService.getActive(await scopeContentFilter(viewer, chapter)))
				.map((d) => d.name)
				.filter((n) => n.endsWith(tag))
				.sort();
		expect(await names(null)).toEqual([`Open ${tag}`]);
		expect(await names({ id: outsider })).toEqual([`Open ${tag}`]);
		expect(await names({ id: member })).toEqual([
			`Inner ${tag}`,
			`Open ${tag}`,
		]);
	});
});
