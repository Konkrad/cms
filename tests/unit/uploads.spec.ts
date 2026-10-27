import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorizeUpload } from "~/core/media/upload-access";
import { activeUploadRules } from "~/core/registry/uploads";
import { adminSegment } from "~/core/router/scope-path";
import {
	findUploadRule,
	type ModuleUploadRule,
	moduleUploadRulesOf,
} from "~/core/router/uploads";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { createTestUser, openDb } from "./helpers";

const tag = Date.now().toString(36);
const cleanups: Array<() => void> = [];
const scopeIds: string[] = [];

describe("moduleUploadRulesOf", () => {
	it("accepts the module's own public/private prefixes", () => {
		expect(
			moduleUploadRulesOf([
				{
					id: "events",
					uploads: [
						{ prefix: "public/events/", minRole: "representative" },
						{ prefix: "private/events/photos/", minRole: "admin" },
					],
				},
			]).map((r) => [r.module, r.prefix]),
		).toEqual([
			["events", "public/events/"],
			["events", "private/events/photos/"],
		]);
	});

	it("rejects core prefixes, another module's and prefixes without a trailing slash", () => {
		for (const prefix of [
			"public/scopes/",
			"public/profile-pictures/",
			"public/jobs/",
			"public/events",
			"public/",
			"events/",
			"public/events/../x/",
		])
			expect(() =>
				moduleUploadRulesOf([
					{ id: "events", uploads: [{ prefix, minRole: "admin" }] },
				]),
			).toThrow(/must be public\/events/);
	});

	it("findUploadRule picks the most specific covering prefix", () => {
		const rules: ModuleUploadRule[] = [
			{ module: "a", prefix: "public/a/", minRole: "representative" },
			{ module: "a", prefix: "public/a/secret/", minRole: "admin" },
		];
		expect(findUploadRule("public/a", rules)?.minRole).toBe("representative");
		expect(findUploadRule("public/a/logos", rules)?.minRole).toBe(
			"representative",
		);
		expect(findUploadRule("public/a/secret/x", rules)?.minRole).toBe("admin");
		expect(findUploadRule("public/ab", rules)).toBeUndefined();
	});

	it("the active modules declare their upload prefixes", () => {
		expect(
			activeUploadRules.map((r) => `${r.module} ${r.prefix} ${r.minRole}`),
		).toEqual([
			"deals public/deals/ representative",
			"events public/events/ representative",
			"events private/events/ admin",
		]);
	});
});

describe("authorizeUpload", () => {
	let root: Scope;
	let region: Scope;
	let chapter: Scope;
	let sibling: Scope;
	const u = {} as Record<
		"rootAdmin" | "regionAdmin" | "rep" | "coordinator" | "member",
		{ id: string }
	>;
	const rules = moduleUploadRulesOf([
		{
			id: "events",
			uploads: [
				{ prefix: "public/events/", minRole: "representative" },
				{ prefix: "private/events/", minRole: "admin" },
			],
		},
	]);

	beforeAll(async () => {
		root = await scopesService.ensureRoot();
		const mk = async (parent: Scope, slug: string, kind: string) => {
			const s = await scopesService.create(
				{ parentId: parent.id, kind, slug, name: slug },
				new Set(),
			);
			scopeIds.push(s.id);
			return s;
		};
		region = await mk(root, `up-${tag}`, "region");
		chapter = await mk(region, "a", "chapter");
		sibling = await mk(region, "b", "chapter");
		for (const key of [
			"rootAdmin",
			"regionAdmin",
			"rep",
			"coordinator",
			"member",
		] as const) {
			const t = createTestUser();
			cleanups.push(t.cleanup);
			u[key] = { id: t.userId };
		}
		await scopesService.grantRole(u.rootAdmin.id, root.id, "admin");
		await scopesService.grantRole(u.regionAdmin.id, region.id, "admin");
		await scopesService.grantRole(u.rep.id, chapter.id, "representative");
		await scopesService.grantRole(u.coordinator.id, region.id, "coordinator");
	});

	afterAll(() => {
		const db = openDb();
		for (const id of [...scopeIds].reverse()) {
			db.prepare("DELETE FROM scope_roles WHERE scope_id = ?").run(id);
			db.prepare("DELETE FROM scopes WHERE id = ?").run(id);
		}
		for (const user of Object.values(u))
			db.prepare("DELETE FROM scope_roles WHERE user_id = ?").run(user.id);
		db.close();
		for (const c of cleanups.splice(0)) c();
	});

	const seg = (s: Scope) => adminSegment(s.path);

	it("profile pictures: any logged-in user", async () => {
		for (const prefix of [
			"private/profile-pictures",
			"public/profile-pictures",
		])
			expect(await authorizeUpload(u.member, prefix, null, rules)).toBe(
				"allowed",
			);
	});

	it("core content prefixes: a managing role on some scope, never a coordinator or member", async () => {
		for (const prefix of [
			"public/scopes",
			"public/articles",
			"public/page-blocks/images",
		]) {
			expect(await authorizeUpload(u.rootAdmin, prefix, null, rules)).toBe(
				"allowed",
			);
			expect(await authorizeUpload(u.rep, prefix, null, rules)).toBe("allowed");
			expect(await authorizeUpload(u.coordinator, prefix, null, rules)).toBe(
				"forbidden",
			);
			expect(await authorizeUpload(u.member, prefix, null, rules)).toBe(
				"forbidden",
			);
		}
	});

	it("module prefix x role on the upload's scope", async () => {
		const pub = "public/events";
		const priv = "private/events/e1/photos";
		const cases: Array<[keyof typeof u, string, Scope, string]> = [
			["rep", pub, chapter, "allowed"],
			["rep", pub, sibling, "forbidden"],
			["rep", pub, region, "forbidden"],
			["rep", priv, chapter, "forbidden"],
			["regionAdmin", pub, chapter, "allowed"],
			["regionAdmin", priv, chapter, "allowed"],
			["regionAdmin", priv, root, "forbidden"],
			["rootAdmin", priv, chapter, "allowed"],
			["rootAdmin", priv, root, "allowed"],
			["coordinator", pub, chapter, "forbidden"],
			["member", pub, chapter, "forbidden"],
		];
		for (const [who, prefix, scope, expected] of cases)
			expect(
				await authorizeUpload(u[who], prefix, seg(scope), rules),
				`${who} ${prefix} on ${scope.path}`,
			).toBe(expected);
	});

	it("module prefix without or with an unknown upload scope: forbidden", async () => {
		expect(
			await authorizeUpload(u.rootAdmin, "public/events", null, rules),
		).toBe("forbidden");
		expect(
			await authorizeUpload(u.rootAdmin, "public/events", "nope.none", rules),
		).toBe("forbidden");
	});

	it("an inactive module's prefixes and unknown paths are refused", async () => {
		// No rules: the events module is inactive.
		expect(
			await authorizeUpload(u.rootAdmin, "public/events", seg(root), []),
		).toBe("unknown-prefix");
		expect(
			await authorizeUpload(u.rootAdmin, "private/events/x", seg(root), []),
		).toBe("unknown-prefix");
		for (const prefix of ["public", "public/whatever", "private/other"])
			expect(await authorizeUpload(u.rootAdmin, prefix, seg(root), rules)).toBe(
				"unknown-prefix",
			);
	});
});
