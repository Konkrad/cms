import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { getCurrentUserData } = vi.hoisted(() => ({
	getCurrentUserData: vi.fn(),
}));
vi.mock("~/core/auth/server-auth", () => ({ getCurrentUserData }));

import { CORE_ROUTE_SEGMENTS } from "~/core/router/reserved-slugs";
import {
	adminSegment,
	adminUrl,
	pathFromAdminSegment,
} from "~/core/router/scope-path";
import {
	canGrantRole,
	canManageScope,
	canViewScope,
	isMember,
	isPlatformAdmin,
	listManagedScopes,
	listMembers,
	type MinRole,
	requireAdmin,
	requireScopeRole,
	rolesSatisfying,
} from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const scopeIds: string[] = [];

let root: Scope;
let region: Scope;
let otherRegion: Scope;
let chapterA: Scope;
let chapterB: Scope;
let otherChapter: Scope;

const u = {} as Record<
	| "rootAdmin"
	| "rootModerator"
	| "regionAdmin"
	| "repA"
	| "coordinator"
	| "memberA"
	| "memberRegion"
	| "nobody",
	string
>;

function user() {
	const t = createTestUser();
	cleanups.push(() => {
		const db = openDb();
		db.prepare("DELETE FROM scope_roles WHERE user_id = ?").run(t.userId);
		db.prepare("DELETE FROM scope_memberships WHERE user_id = ?").run(t.userId);
		db.close();
		t.cleanup();
	});
	return t.userId;
}

async function mk(parent: Scope, slug: string, kind: string) {
	const s = await scopesService.create(
		{ parentId: parent.id, kind, slug, name: slug },
		new Set(),
	);
	scopeIds.push(s.id);
	return s;
}

beforeAll(async () => {
	root = await scopesService.ensureRoot();
	region = await mk(root, `reg-${tag}`, "region");
	otherRegion = await mk(root, `oreg-${tag}`, "region");
	chapterA = await mk(region, "a", "chapter");
	chapterB = await mk(region, "b", "chapter");
	otherChapter = await mk(otherRegion, "c", "chapter");

	for (const key of Object.keys({
		rootAdmin: 1,
		rootModerator: 1,
		regionAdmin: 1,
		repA: 1,
		coordinator: 1,
		memberA: 1,
		memberRegion: 1,
		nobody: 1,
	}) as Array<keyof typeof u>) {
		u[key] = user();
	}
	await scopesService.grantRole(u.rootAdmin, root.id, "admin");
	await scopesService.grantRole(u.rootModerator, root.id, "moderator");
	await scopesService.grantRole(u.regionAdmin, region.id, "admin");
	await scopesService.grantRole(u.repA, chapterA.id, "representative");
	await scopesService.grantRole(u.coordinator, region.id, "coordinator");
	await scopesService.join(u.memberA, chapterA.id);
	await scopesService.join(u.memberRegion, region.id);
});

afterAll(() => {
	const db = openDb();
	for (const id of [...scopeIds].reverse()) {
		db.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
		db.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		db.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	db.close();
	for (const c of cleanups.splice(0)) c();
});

class Thrown {
	constructor(
		readonly kind: "redirect" | "error",
		readonly status: number,
		readonly to?: string,
	) {}
}

function eventFor(scope: Scope | string, userId: string | null) {
	getCurrentUserData.mockResolvedValue(userId ? { id: userId } : null);
	return {
		params: {
			scope: typeof scope === "string" ? scope : adminSegment(scope.path),
		},
		sharedMap: new Map(),
		redirect: (status: number, to: string) =>
			new Thrown("redirect", status, to),
		error: (status: number) => new Thrown("error", status),
	} as unknown as Parameters<typeof requireScopeRole>[0];
}

async function outcome(
	scope: Scope | string,
	userId: string | null,
	minRole: MinRole = "representative",
) {
	try {
		const access = await requireScopeRole(eventFor(scope, userId), minRole);
		return `ok:${access.scope.id === (scope as Scope).id}`;
	} catch (e) {
		if (e instanceof Thrown)
			return e.kind === "redirect" ? `redirect:${e.to}` : `${e.status}`;
		throw e;
	}
}

describe("rolesSatisfying", () => {
	it("treats admin and moderator as equal and keeps coordinators out of managing", () => {
		expect(rolesSatisfying("admin").sort()).toEqual(["admin", "moderator"]);
		expect(rolesSatisfying("moderator").sort()).toEqual(["admin", "moderator"]);
		expect(rolesSatisfying("representative").sort()).toEqual([
			"admin",
			"moderator",
			"representative",
		]);
		expect(rolesSatisfying("coordinator").sort()).toEqual([
			"admin",
			"coordinator",
			"moderator",
		]);
		expect(rolesSatisfying(["coordinator", "representative"]).sort()).toEqual([
			"admin",
			"coordinator",
			"moderator",
			"representative",
		]);
	});
});

describe("role inheritance", () => {
	it("inherits roles downward, never upward or sideways", async () => {
		const admin = { id: u.regionAdmin };
		expect(await canManageScope(admin, region.id, "admin")).toBe(true);
		expect(await canManageScope(admin, chapterA.id, "admin")).toBe(true);
		expect(await canManageScope(admin, root.id, "admin")).toBe(false);
		expect(await canManageScope(admin, otherChapter.id, "admin")).toBe(false);

		const rep = { id: u.repA };
		expect(await canManageScope(rep, chapterA.id, "representative")).toBe(true);
		expect(await canManageScope(rep, chapterA.id, "admin")).toBe(false);
		expect(await canManageScope(rep, region.id, "representative")).toBe(false);
		expect(await canManageScope(null, chapterA.id, "representative")).toBe(
			false,
		);
	});

	it("lists managed scopes including the scopes below", async () => {
		const ids = (s: Scope[]) => s.map((x) => x.id);
		expect(ids(await listManagedScopes({ id: u.regionAdmin }))).toEqual([
			region.id,
			chapterA.id,
			chapterB.id,
		]);
		expect(ids(await listManagedScopes({ id: u.repA }))).toEqual([chapterA.id]);
		expect(await listManagedScopes({ id: u.coordinator })).toEqual([]);
		expect(
			ids(await listManagedScopes({ id: u.coordinator }, "coordinator")),
		).toContain(chapterB.id);
		expect(await listManagedScopes(null)).toEqual([]);
	});
});

describe("requireScopeRole", () => {
	it.each([
		[
			"root admin on a chapter",
			"rootAdmin",
			"chapterA",
			"representative",
			"ok",
		],
		["root moderator on a chapter", "rootModerator", "chapterA", "admin", "ok"],
		["region admin on its chapter", "regionAdmin", "chapterA", "admin", "ok"],
		[
			"region admin on another region's chapter",
			"regionAdmin",
			"otherChapter",
			"representative",
			"403",
		],
		[
			"region admin on the root",
			"regionAdmin",
			"root",
			"representative",
			"403",
		],
		[
			"representative on own chapter",
			"repA",
			"chapterA",
			"representative",
			"ok",
		],
		[
			"representative on a sibling chapter",
			"repA",
			"chapterB",
			"representative",
			"403",
		],
		[
			"representative on the parent region",
			"repA",
			"region",
			"representative",
			"403",
		],
		["representative asking for admin", "repA", "chapterA", "admin", "403"],
		[
			"coordinator for admin access",
			"coordinator",
			"chapterA",
			"representative",
			"403",
		],
		["coordinator for review", "coordinator", "chapterA", "coordinator", "ok"],
		["member", "memberA", "chapterA", "representative", "403"],
	] as const)("%s", async (_label, who, where, minRole, expected) => {
		const scopes = { root, region, chapterA, chapterB, otherChapter };
		const result = await outcome(scopes[where], u[who], minRole);
		expect(result).toBe(expected === "ok" ? "ok:true" : expected);
	});

	it("redirects guests to the login", async () => {
		expect(await outcome(chapterA, null)).toBe("redirect:/login");
	});

	it("404s for an unknown or malformed scope segment", async () => {
		expect(await outcome(`nope-${tag}`, u.rootAdmin)).toBe("404");
		expect(await outcome("Bad..Segment", u.rootAdmin)).toBe("404");
	});

	it("returns the scope and its ancestors, root first", async () => {
		const access = await requireScopeRole(
			eventFor(chapterA, u.regionAdmin),
			"admin",
		);
		expect(access.user.id).toBe(u.regionAdmin);
		expect(access.ancestors.map((s) => s.id)).toEqual([root.id, region.id]);
	});
});

describe("granting roles", () => {
	it("lets admins grant every role and representatives only representative", async () => {
		const admin = { id: u.regionAdmin };
		for (const role of [
			"admin",
			"moderator",
			"coordinator",
			"representative",
		] as const) {
			expect(await canGrantRole(admin, chapterA.id, role)).toBe(true);
		}
		const rep = { id: u.repA };
		expect(await canGrantRole(rep, chapterA.id, "representative")).toBe(true);
		expect(await canGrantRole(rep, chapterA.id, "admin")).toBe(false);
		expect(await canGrantRole(rep, chapterA.id, "coordinator")).toBe(false);
		expect(await canGrantRole(rep, chapterB.id, "representative")).toBe(false);
		expect(
			await canGrantRole({ id: u.coordinator }, chapterA.id, "coordinator"),
		).toBe(false);
	});
});

describe("scope content and images", () => {
	it("reports content owned by a scope (core posts and module events)", async () => {
		const { scopeHasContent } = await import("~/core/registry/manifests");
		expect(await scopeHasContent(chapterB.id)).toBe(false);
		const db = openDb();
		const postId = crypto.randomUUID();
		db.prepare(
			"INSERT INTO posts (id, title, body, author_id, scope_id, updated_at) VALUES (?, 't', 'b', ?, ?, ?)",
		).run(postId, u.repA, chapterB.id, new Date().toISOString());
		db.close();
		try {
			expect(await scopeHasContent(chapterB.id)).toBe(true);
		} finally {
			const d = openDb();
			d.prepare("DELETE FROM posts WHERE id = ?").run(postId);
			d.close();
		}
	}, 30_000);

	it("accepts only public scope image keys", async () => {
		await expect(
			scopesService.setImage(chapterB.id, 1, "private/profile-pictures/x.webp"),
		).rejects.toThrow(/Invalid image key/);
		await expect(
			scopesService.setImage(chapterB.id, 1, "public/scopes/../x.webp"),
		).rejects.toThrow(/Invalid image key/);
		await scopesService.setImage(chapterB.id, 2, "public/scopes/ok.webp");
		expect((await scopesService.getById(chapterB.id))?.image2).toBe(
			"public/scopes/ok.webp",
		);
		await scopesService.setImage(chapterB.id, 2, null);
		expect((await scopesService.getById(chapterB.id))?.image2).toBeNull();
	});
});

describe("platform admin = admin of the root", () => {
	it("is true for root admins and moderators only", async () => {
		expect(await isPlatformAdmin({ id: u.rootAdmin })).toBe(true);
		expect(await isPlatformAdmin({ id: u.rootModerator })).toBe(true);
		expect(await isPlatformAdmin({ id: u.regionAdmin })).toBe(false);
		expect(await isPlatformAdmin({ id: u.repA })).toBe(false);
		expect(await isPlatformAdmin(null)).toBe(false);
	});

	it("requireAdmin passes root admins and refuses everyone else", async () => {
		await expect(
			requireAdmin(eventFor(chapterA, u.rootAdmin)),
		).resolves.toMatchObject({ id: u.rootAdmin });
		await expect(
			requireAdmin(eventFor(region, u.regionAdmin)),
		).rejects.toMatchObject({ kind: "error", status: 403 });
		await expect(requireAdmin(eventFor(root, null))).rejects.toMatchObject({
			kind: "redirect",
			to: "/login",
		});
	});
});

describe("membership and visibility", () => {
	it("counts membership upward", async () => {
		expect(await isMember({ id: u.memberA }, chapterA.id)).toBe(true);
		expect(await isMember({ id: u.memberA }, region.id)).toBe(true);
		expect(await isMember({ id: u.memberA }, chapterB.id)).toBe(false);
		expect(await isMember({ id: u.memberRegion }, chapterA.id)).toBe(false);
	});

	it("shows members-only items of a scope to members of the scopes below", async () => {
		expect(await canViewScope({ id: u.memberA }, region.id, "members")).toBe(
			true,
		);
		expect(
			await canViewScope({ id: u.memberRegion }, chapterA.id, "members"),
		).toBe(false);
		expect(await canViewScope(null, chapterA.id, "public")).toBe(true);
		expect(await canViewScope(null, chapterA.id, "members")).toBe(false);
		expect(
			await canViewScope({ id: u.memberA }, chapterA.id, "representatives"),
		).toBe(false);
		expect(
			await canViewScope({ id: u.repA }, chapterA.id, "representatives"),
		).toBe(true);
		expect(
			await canViewScope({ id: u.rootAdmin }, chapterB.id, "representatives"),
		).toBe(true);
	});

	it("lists members as public cards, optionally with the scopes below", async () => {
		const own = await listMembers(region.id);
		expect(own.map((m) => m.id)).toEqual([u.memberRegion]);
		const all = await listMembers(region.id, { includeDescendants: true });
		expect(all.map((m) => m.id).sort()).toEqual(
			[u.memberRegion, u.memberA].sort(),
		);
		expect(Object.keys(all[0]).sort()).toEqual([
			"familyName",
			"id",
			"joinedAt",
			"name",
			"profilePictureSmallUrl",
		]);
	});
});

describe("admin URL segment", () => {
	it("maps scope paths to one dotted segment and back", () => {
		expect(adminSegment("/")).toBe("root");
		expect(adminSegment("/germany/berlin/")).toBe("germany.berlin");
		expect(pathFromAdminSegment("root")).toBe("/");
		expect(pathFromAdminSegment("germany.berlin")).toBe("/germany/berlin/");
		expect(pathFromAdminSegment("Germany")).toBeNull();
		expect(pathFromAdminSegment("a..b")).toBeNull();
		expect(adminUrl("/germany/", "/events")).toBe("/admin/germany/events");
		expect(adminUrl("/")).toBe("/admin/root");
	});
});

describe("reserved scope slugs", () => {
	it("lists every static top-level route segment", () => {
		const routesDir = path.resolve(__dirname, "../../src/routes");
		const segments = fs
			.readdirSync(routesDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.filter((n) => !n.startsWith("[") && !n.startsWith("("));
		for (const segment of segments)
			expect(CORE_ROUTE_SEGMENTS).toContain(segment);
	});

	it("reserves core routes, every module route and the root admin segment", async () => {
		const { reservedSlugs } = await import("~/core/registry/manifests");
		for (const slug of [
			"admin",
			"api",
			"login",
			"posts",
			"groups",
			"root",
			"events",
			"jobs",
			"deals",
			"elections",
			"qualifications",
		]) {
			expect(reservedSlugs.has(slug)).toBe(true);
		}
		expect(reservedSlugs.has("berlin")).toBe(false);
		await expect(
			scopesService.create(
				{ parentId: chapterA.id, kind: "chapter", slug: "jobs", name: "Jobs" },
				reservedSlugs,
			),
		).rejects.toThrow(/reserved/);
	}, 30_000);
});
