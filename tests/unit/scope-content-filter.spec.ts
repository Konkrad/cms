import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stream } from "~/core/content/stream.service";
import {
	listsItem,
	localFirst,
	scopeContentFilter,
} from "~/core/scopes/content-filter";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import type { Visibility } from "~/core/scopes/visibility";
import { createTestUser, openDb } from "./helpers";

// The listing rule of spec 4.3, checked against an independent statement of it for every
// viewer × listing scope × owning scope × visibility.
//
//   root ─┬─ region ─┬─ chapter
//         │          └─ sibling
//         └─ other
const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const scopeIds: string[] = [];
const S: Record<string, Scope> = {};
const items: Array<{
	id: string;
	table: "notes" | "articles";
	scope: string;
	visibility: Visibility;
}> = [];

type Viewer = {
	name: string;
	id: string | null;
	joined: string[];
	roles: Array<[string, "admin" | "coordinator" | "representative"]>;
};
const viewers: Viewer[] = [];

const VIS: Visibility[] = ["public", "members", "representatives"];
const SCOPES = ["root", "region", "chapter", "sibling", "other"];

const isAtOrBelow = (scope: string, ancestor: string) =>
	S[scope].path.startsWith(S[ancestor].path);

/** The spec, stated directly. */
function expected(
	viewer: Viewer,
	listing: string,
	owner: string,
	visibility: Visibility,
): boolean {
	const roleOnOrAbove = viewer.roles.some(([s]) => isAtOrBelow(owner, s));
	// Membership counts upward: a member of a scope below the owner is a member of the owner.
	const member = viewer.joined.some((s) => isAtOrBelow(s, owner));
	if (isAtOrBelow(listing, owner)) {
		// The listing scope itself or an ancestor: by visibility.
		if (visibility === "public") return true;
		if (visibility === "members") return member || roleOnOrAbove;
		return roleOnOrAbove;
	}
	// Below the listing scope: public only. Elsewhere (siblings, other branches): never.
	return isAtOrBelow(owner, listing) && visibility === "public";
}

beforeAll(async () => {
	const root = await scopesService.ensureRoot();
	S.root = root;
	const mk = async (key: string, parent: Scope, kind: string) => {
		S[key] = await scopesService.create(
			{ parentId: parent.id, kind, slug: `${key}-${tag}`, name: key },
			new Set(),
		);
		scopeIds.push(S[key].id);
	};
	await mk("region", root, "region");
	await mk("chapter", S.region, "chapter");
	await mk("sibling", S.region, "chapter");
	await mk("other", root, "region");

	const author = createTestUser();
	cleanups.push(author.cleanup);
	const db = openDb();
	for (const scope of SCOPES) {
		for (const visibility of VIS) {
			// One note and one article per scope and visibility: the stream lists both.
			const noteId = crypto.randomUUID();
			db.prepare(
				"INSERT INTO notes (id, body, author_id, scope_id, visibility, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			).run(
				noteId,
				`<p>filter ${tag} ${scope} ${visibility}</p>`,
				author.userId,
				S[scope].id,
				visibility,
				new Date().toISOString(),
				new Date().toISOString(),
			);
			items.push({ id: noteId, table: "notes", scope, visibility });
			const articleId = crypto.randomUUID();
			db.prepare(
				"INSERT INTO articles (id, title, body, author_id, scope_id, visibility, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			).run(
				articleId,
				`filter ${tag} ${scope} ${visibility}`,
				"<p>x</p>",
				author.userId,
				S[scope].id,
				visibility,
				new Date().toISOString(),
				new Date().toISOString(),
			);
			items.push({ id: articleId, table: "articles", scope, visibility });
		}
	}
	db.close();

	const defs: Array<Omit<Viewer, "id">> = [
		{ name: "guest", joined: [], roles: [] },
		{ name: "user without membership", joined: [], roles: [] },
		{ name: "chapter member", joined: ["chapter"], roles: [] },
		{ name: "region member", joined: ["region"], roles: [] },
		{ name: "sibling member", joined: ["sibling"], roles: [] },
		{
			name: "chapter representative",
			joined: [],
			roles: [["chapter", "representative"]],
		},
		{
			name: "region coordinator",
			joined: [],
			roles: [["region", "coordinator"]],
		},
		{ name: "root admin", joined: [], roles: [["root", "admin"]] },
	];
	for (const def of defs) {
		if (def.name === "guest") {
			viewers.push({ ...def, id: null });
			continue;
		}
		const u = createTestUser();
		cleanups.push(u.cleanup);
		for (const s of def.joined) await scopesService.join(u.userId, S[s].id);
		for (const [s, role] of def.roles) {
			await scopesService.grantRole(u.userId, S[s].id, role);
		}
		viewers.push({ ...def, id: u.userId });
	}
});

afterAll(() => {
	const db = openDb();
	for (const i of items)
		db.prepare(`DELETE FROM ${i.table} WHERE id = ?`).run(i.id);
	for (const id of scopeIds) {
		db.prepare("DELETE FROM scope_memberships WHERE scope_id = ?").run(id);
		db.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
	}
	db.close();
	for (const c of cleanups.splice(0)) c();
	const db2 = openDb();
	for (const id of [...scopeIds].reverse()) {
		db2.prepare("DELETE FROM scopes WHERE id = ?").run(id);
	}
	db2.close();
});

describe("scopeContentFilter", () => {
	for (const listing of ["root", "region", "chapter"]) {
		it(`lists exactly what the spec says on the ${listing} listing`, async () => {
			const mismatches: string[] = [];
			for (const viewer of viewers) {
				const filter = await scopeContentFilter(
					viewer.id ? { id: viewer.id } : null,
					S[listing].id,
				);
				const listed = new Set(
					(await stream.list(filter, { limit: 1000 })).items.map((i) => i.id),
				);
				for (const item of items) {
					const want = expected(viewer, listing, item.scope, item.visibility);
					const inMemory = filter.matches({
						scopeId: S[item.scope].id,
						visibility: item.visibility,
					});
					if (inMemory !== want || listed.has(item.id) !== want) {
						mismatches.push(
							`${viewer.name} @${listing}: ${item.table} ${item.scope}/${item.visibility} want ${want}, matches ${inMemory}, sql ${listed.has(item.id)}`,
						);
					}
				}
			}
			expect(mismatches).toEqual([]);
		});
	}

	it("defaults to the root listing", async () => {
		const filter = await scopeContentFilter(null);
		expect(filter.scope.parentId).toBeNull();
	});

	it("treats rows without a visibility column as public", () => {
		const scopes = {
			ownAndAncestorIds: ["r", "a"],
			descendantIds: ["d"],
			memberIds: [],
			roleIds: [],
		};
		expect(listsItem(scopes, { scopeId: "a" })).toBe(true);
		expect(listsItem(scopes, { scopeId: "d" })).toBe(true);
		expect(listsItem(scopes, { scopeId: "x" })).toBe(false);
		expect(listsItem(scopes, { scopeId: "d", visibility: "members" })).toBe(
			false,
		);
	});

	it("localFirst puts the listing scope's own and lower items before inherited ones", async () => {
		const filter = await scopeContentFilter(null, S.chapter.id);
		expect(filter.isInherited(S.region.id)).toBe(true);
		expect(filter.isInherited(S.root.id)).toBe(true);
		expect(filter.isInherited(S.chapter.id)).toBe(false);
		const items = [
			{ id: 1, scopeId: S.root.id },
			{ id: 2, scopeId: S.region.id },
			{ id: 3, scopeId: S.chapter.id },
			{ id: 4, scopeId: S.root.id },
		];
		expect(localFirst(items, filter, 2).map((i) => i.id)).toEqual([3, 1]);
	});
});
