import { afterEach, describe, expect, it } from "vitest";
import { ScopeError, scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

const RESERVED = new Set(["events", "posts", "admin", "login", "jobs"]);
const createdIds: string[] = [];
const cleanups: Array<() => void> = [];

afterEach(() => {
	const db = openDb();
	// Deepest first so children go before parents.
	const rows = createdIds
		.splice(0)
		.map(
			(id) =>
				db.prepare("SELECT id, path FROM scopes WHERE id = ?").get(id) as
					| { id: string; path: string }
					| undefined,
		);
	rows
		.filter((r): r is { id: string; path: string } => !!r)
		.sort((a, b) => b.path.length - a.path.length)
		.forEach((r) => {
			db.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(r.id);
			db.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(r.id);
			db.prepare("DELETE FROM scopes WHERE id = ?").run(r.id);
		});
	db.close();
	for (const c of cleanups.splice(0)) c();
});

let counter = 0;
const uniq = (prefix: string) =>
	`${prefix}-${Date.now().toString(36)}${counter++}`;

async function mk(parentId: string, slug = uniq("s"), kind = "region") {
	const s = await scopesService.create(
		{ parentId, kind, slug, name: slug },
		RESERVED,
	);
	createdIds.push(s.id);
	return s;
}

function user() {
	const u = createTestUser();
	// helpers' cleanup does not know scope tables
	cleanups.push(() => {
		const db = openDb();
		db.prepare("DELETE FROM scope_roles WHERE user_id = ?").run(u.userId);
		db.prepare("DELETE FROM scope_memberships WHERE user_id = ?").run(u.userId);
		db.close();
		u.cleanup();
	});
	return u.userId;
}

describe("ensureRoot", () => {
	it("is idempotent and yields the single root", async () => {
		const a = await scopesService.ensureRoot();
		const b = await scopesService.ensureRoot("Other");
		expect(b.id).toBe(a.id);
		expect(a.path).toBe("/");
		expect(a.parentId).toBeNull();
		expect(a.slug).toBe("");
		expect(a.kind).toBe("root");
		expect((await scopesService.getRoot())?.id).toBe(a.id);
	});
});

describe("create", () => {
	it("computes nested paths", async () => {
		const root = await scopesService.ensureRoot();
		const de = await mk(root.id, uniq("de"));
		const be = await mk(de.id, "berlin", "chapter");
		expect(de.path).toBe(`/${de.slug}/`);
		expect(be.path).toBe(`${de.path}berlin/`);
		expect((await scopesService.getByPath(be.path))?.id).toBe(be.id);
		expect((await scopesService.listPaths()).has(be.path)).toBe(true);
	});

	it("rejects invalid slugs", async () => {
		const root = await scopesService.ensureRoot();
		await expect(mk(root.id, "Bad Slug")).rejects.toBeInstanceOf(ScopeError);
		await expect(mk(root.id, "-x")).rejects.toBeInstanceOf(ScopeError);
	});

	it("rejects reserved slugs at root and deep level", async () => {
		const root = await scopesService.ensureRoot();
		await expect(mk(root.id, "events")).rejects.toThrow(/reserved/);
		const de = await mk(root.id);
		const be = await mk(de.id);
		await expect(mk(de.id, "admin")).rejects.toThrow(/reserved/);
		await expect(mk(be.id, "jobs")).rejects.toThrow(/reserved/);
	});

	it("rejects duplicate sibling slugs but allows the same slug elsewhere", async () => {
		const root = await scopesService.ensureRoot();
		const a = await mk(root.id);
		const b = await mk(root.id);
		await mk(a.id, "dup");
		await expect(mk(a.id, "dup")).rejects.toThrow(/already exists/);
		await expect(mk(b.id, "dup")).resolves.toBeTruthy();
	});

	it("rejects an unknown parent", async () => {
		await expect(mk("nope")).rejects.toThrow(/Parent/);
	});
});

describe("tree queries", () => {
	it("returns ancestors, descendants and children", async () => {
		const root = await scopesService.ensureRoot();
		const a = await mk(root.id);
		const b = await mk(a.id);
		const c = await mk(b.id);
		const sibling = await mk(root.id, `${a.slug}x`);

		expect((await scopesService.getAncestors(c.id)).map((s) => s.id)).toEqual([
			root.id,
			a.id,
			b.id,
		]);
		expect(await scopesService.getAncestors(root.id)).toEqual([]);
		expect((await scopesService.getDescendants(a.id)).map((s) => s.id)).toEqual(
			[b.id, c.id],
		);
		expect(
			(await scopesService.getDescendants(a.id)).map((s) => s.id),
		).not.toContain(sibling.id);
		expect((await scopesService.getChildren(a.id)).map((s) => s.id)).toEqual([
			b.id,
		]);
	});
});

describe("move", () => {
	it("rewrites the subtree paths", async () => {
		const root = await scopesService.ensureRoot();
		const a = await mk(root.id);
		const b = await mk(root.id);
		const child = await mk(a.id, "child");
		const grand = await mk(child.id, "grand");

		const moved = await scopesService.move(child.id, b.id);
		expect(moved.parentId).toBe(b.id);
		expect(moved.path).toBe(`${b.path}child/`);
		expect((await scopesService.getById(grand.id))?.path).toBe(
			`${b.path}child/grand/`,
		);
		expect(await scopesService.getChildren(a.id)).toEqual([]);
	});

	it("refuses cycles, root and sibling clashes", async () => {
		const root = await scopesService.ensureRoot();
		const a = await mk(root.id);
		const b = await mk(a.id);
		await expect(scopesService.move(a.id, b.id)).rejects.toThrow(
			/under itself/,
		);
		await expect(scopesService.move(a.id, a.id)).rejects.toThrow(
			/under itself/,
		);
		await expect(scopesService.move(root.id, a.id)).rejects.toThrow(/root/);
		const other = await mk(root.id);
		await mk(other.id, b.slug);
		await expect(scopesService.move(b.id, other.id)).rejects.toThrow(
			/already exists/,
		);
	});

	it("does not touch siblings sharing a path prefix", async () => {
		const root = await scopesService.ensureRoot();
		const a = await mk(root.id, uniq("p"));
		const lookalike = await mk(root.id, `${a.slug}-2`);
		const target = await mk(root.id);
		await scopesService.move(a.id, target.id);
		expect((await scopesService.getById(lookalike.id))?.path).toBe(
			`/${a.slug}-2/`,
		);
	});
});

describe("delete", () => {
	it("refuses with children and for root, deletes leaves", async () => {
		const root = await scopesService.ensureRoot();
		const a = await mk(root.id);
		const b = await mk(a.id);
		await expect(scopesService.delete(a.id)).rejects.toThrow(/child/);
		await expect(scopesService.delete(root.id)).rejects.toThrow(/root/);
		await scopesService.delete(b.id);
		expect(await scopesService.getById(b.id)).toBeUndefined();
		await scopesService.delete(a.id);
		expect(await scopesService.getById(a.id)).toBeUndefined();
	});
});

describe("roles", () => {
	it("inherit downward, not sideways or upward", async () => {
		const root = await scopesService.ensureRoot();
		const de = await mk(root.id);
		const fr = await mk(root.id);
		const be = await mk(de.id);
		const u = user();

		await scopesService.grantRole(u, de.id, "admin");
		await scopesService.grantRole(u, de.id, "admin"); // idempotent

		expect(await scopesService.hasRole(u, de.id, ["admin"])).toBe(true);
		expect(await scopesService.hasRole(u, be.id, ["admin"])).toBe(true);
		expect(await scopesService.hasRole(u, fr.id, ["admin"])).toBe(false);
		expect(await scopesService.hasRole(u, root.id, ["admin"])).toBe(false);
		expect(await scopesService.hasRole(u, be.id, ["moderator"])).toBe(false);
		expect([...(await scopesService.getEffectiveRoles(u, be.id))]).toEqual([
			"admin",
		]);

		await scopesService.revokeRole(u, de.id, "admin");
		expect(await scopesService.hasRole(u, be.id, ["admin"])).toBe(false);
	});

	it("listScopesWithRole expands the held roles to the scopes below", async () => {
		const root = await scopesService.ensureRoot();
		const de = await mk(root.id);
		const be = await mk(de.id);
		const fr = await mk(root.id);
		const u = user();
		await scopesService.grantRole(u, de.id, "admin");
		await scopesService.grantRole(u, de.id, "moderator");
		await scopesService.grantRole(u, fr.id, "coordinator");
		await scopesService.grantRole(u, be.id, "representative");

		const managed = await scopesService.listScopesWithRole(u, [
			"admin",
			"moderator",
			"representative",
		]);
		expect(managed.map((s) => s.id)).toEqual([de.id, be.id]);
		const reviewed = await scopesService.listScopesWithRole(u, ["coordinator"]);
		expect(reviewed.map((s) => s.id)).toEqual([fr.id]);
	});
});

describe("membership", () => {
	it("counts upward only", async () => {
		const root = await scopesService.ensureRoot();
		const de = await mk(root.id);
		const fr = await mk(root.id);
		const be = await mk(de.id);
		const u = user();

		await scopesService.join(u, be.id);
		await scopesService.join(u, be.id); // idempotent
		expect(await scopesService.isMember(u, be.id)).toBe(true);
		expect(await scopesService.isMember(u, de.id)).toBe(true);
		expect(await scopesService.isMember(u, root.id)).toBe(true);
		expect(await scopesService.isMember(u, fr.id)).toBe(false);

		await scopesService.leave(u, be.id);
		expect(await scopesService.isMember(u, de.id)).toBe(false);
	});
});

describe("canView", () => {
	it("follows the visibility matrix", async () => {
		const root = await scopesService.ensureRoot();
		const de = await mk(root.id);
		const be = await mk(de.id);
		const fr = await mk(root.id);

		const member = user();
		const rep = user();
		const coord = user();
		const admin = user();
		const nobody = user();
		await scopesService.join(member, be.id);
		await scopesService.grantRole(rep, de.id, "representative");
		await scopesService.grantRole(coord, de.id, "coordinator");
		await scopesService.grantRole(admin, de.id, "admin");

		const cases: Array<[string | null, string, boolean, boolean, boolean]> = [
			// user, scope, public, members, representatives
			[null, be.id, true, false, false],
			[nobody, be.id, true, false, false],
			[member, be.id, true, true, false],
			[member, de.id, true, true, false],
			[member, fr.id, true, false, false],
			[rep, be.id, true, true, true],
			[rep, fr.id, true, false, false],
			[coord, be.id, true, true, true],
			[admin, be.id, true, true, true],
			[admin, fr.id, true, false, false],
		];
		for (const [u, scope, pub, mem, reps] of cases) {
			expect(await scopesService.canView(u, scope, "public")).toBe(pub);
			expect(await scopesService.canView(u, scope, "members")).toBe(mem);
			expect(await scopesService.canView(u, scope, "representatives")).toBe(
				reps,
			);
		}
	});
});

describe("contentFilter", () => {
	it("returns own+ancestor ids and descendant ids", async () => {
		const root = await scopesService.ensureRoot();
		const de = await mk(root.id);
		const be = await mk(de.id);
		const mitte = await mk(be.id);
		const fr = await mk(root.id);

		const f = await scopesService.contentFilter(de.id);
		expect(f.ownAndAncestorIds).toEqual([root.id, de.id]);
		expect(f.descendantIds.sort()).toEqual([be.id, mitte.id].sort());
		expect(f.descendantIds).not.toContain(fr.id);

		const leaf = await scopesService.contentFilter(mitte.id);
		expect(leaf.ownAndAncestorIds).toEqual([root.id, de.id, be.id, mitte.id]);
		expect(leaf.descendantIds).toEqual([]);
	});
});
