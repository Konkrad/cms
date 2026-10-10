import { describe, expect, it, vi } from "vitest";
import {
	adminSectionsOf,
	defineModule,
	disabledBlockTypes,
	menuLinksOf,
	pagesOf,
	profileExtrasOf,
	selectActive,
	sitemapEntriesOf,
	withoutDisabledBlocks,
} from "~/core/modules";
import { definePage } from "~/core/pages";

const page = (id: string, path: string) =>
	definePage({ id, path, load: async () => null });

const alpha = defineModule({
	id: "alpha",
	pages: [page("alpha.list", "/alpha")],
	admin: { sections: [{ path: "alpha", label: "Alpha", order: 2 }] },
	menuLinks: [{ key: "alpha", label: "Alpha", url: "/alpha" }],
});
const beta = defineModule({
	id: "beta",
	pages: [page("beta.list", "/beta")],
	admin: { sections: [{ path: "beta", label: "Beta", order: 1 }] },
	menuLinks: [{ key: "beta", label: "Beta", url: "/beta" }],
});

describe("selectActive", () => {
	it("returns the configured modules in config order", () => {
		expect(selectActive([alpha, beta], ["beta", "alpha"])).toEqual([
			beta,
			alpha,
		]);
		expect(selectActive([alpha, beta], [])).toEqual([]);
	});

	it("throws on an unknown id in the config", () => {
		expect(() => selectActive([alpha], ["nope"])).toThrow(/Unknown module/);
	});

	it("throws on duplicate ids", () => {
		expect(() => selectActive([alpha, alpha], ["alpha"])).toThrow(/Duplicate/);
		expect(() => selectActive([alpha], ["alpha", "alpha"])).toThrow(
			/Duplicate/,
		);
	});
});

describe("contributions come only from active modules", () => {
	const active = selectActive([alpha, beta], ["alpha"]);

	it("pages", () => {
		expect(pagesOf(active).map((p) => p.id)).toEqual(["alpha.list"]);
	});

	it("menu links", () => {
		expect(menuLinksOf(active).map((l) => l.key)).toEqual(["alpha"]);
	});

	it("admin sections, sorted by order", () => {
		expect(adminSectionsOf(active).map((s) => s.path)).toEqual(["alpha"]);
		expect(adminSectionsOf([alpha, beta]).map((s) => s.path)).toEqual([
			"beta",
			"alpha",
		]);
	});
});

describe("sitemapEntriesOf", () => {
	const withSitemap = defineModule({
		id: "gamma",
		sitemap: async () => [
			{ path: "/gamma/1", lastmod: "2026-01-01" },
			{ path: "/gamma/2" },
		],
	});

	it("concatenates the entries of the given modules, skipping modules without a sitemap", async () => {
		expect(await sitemapEntriesOf([alpha, withSitemap, beta])).toEqual([
			{ path: "/gamma/1", lastmod: "2026-01-01" },
			{ path: "/gamma/2" },
		]);
	});

	it("is empty for no modules", async () => {
		expect(await sitemapEntriesOf([])).toEqual([]);
	});

	it("leaves out modules that are not active", async () => {
		const active = selectActive([alpha, withSitemap], ["alpha"]);
		expect(await sitemapEntriesOf(active)).toEqual([]);
	});
});

describe("profileExtrasOf", () => {
	const ctx = { userId: "u1", viewerId: "u2", isOwnProfile: false };
	const withHistory = defineModule({
		id: "history",
		profile: async ({ userId, isOwnProfile }) =>
			isOwnProfile
				? { electionGroups: [{ title: `for ${userId}`, year: 2026, apps: [] }] }
				: {},
	});

	it("merges the sections of the given modules and passes the context through", async () => {
		const own = { userId: "u1", viewerId: "u1", isOwnProfile: true };
		expect(await profileExtrasOf([alpha, withHistory], own)).toEqual({
			electionGroups: [{ title: "for u1", year: 2026, apps: [] }],
		});
	});

	it("lets a module withhold a section from other viewers", async () => {
		expect(await profileExtrasOf([withHistory], ctx)).toEqual({});
	});

	it("is empty without modules or hooks", async () => {
		expect(await profileExtrasOf([], ctx)).toEqual({});
		expect(await profileExtrasOf([alpha, beta], ctx)).toEqual({});
	});

	it("contributes nothing from an inactive module", async () => {
		const own = { userId: "u1", viewerId: "u1", isOwnProfile: true };
		const active = selectActive([alpha, withHistory], ["alpha"]);
		expect(await profileExtrasOf(active, own)).toEqual({});
	});
});

describe("disabledBlockTypes", () => {
	const moduleBlocks = {
		alpha: ["AlphaBlock"],
		beta: ["BetaBlock", "BetaTwo"],
	};

	it("excludes the block types of inactive modules only", () => {
		expect(disabledBlockTypes(moduleBlocks, ["alpha"])).toEqual(
			new Set(["BetaBlock", "BetaTwo"]),
		);
		expect(disabledBlockTypes(moduleBlocks, ["alpha", "beta"]).size).toBe(0);
		expect(disabledBlockTypes(moduleBlocks, [])).toEqual(
			new Set(["AlphaBlock", "BetaBlock", "BetaTwo"]),
		);
	});

	it("keeps a type that an active module also owns", () => {
		expect(
			disabledBlockTypes({ a: ["Shared"], b: ["Shared"] }, ["a"]).size,
		).toBe(0);
	});
});

describe("block gating with the checked-in config", () => {
	it("client-safe block list matches the manifests", async () => {
		const { allModules } = await import("~/core/registry/manifests");
		const { moduleBlocks } = await import("~/core/registry/blocks");
		for (const m of allModules) {
			expect(moduleBlocks[m.id] ?? []).toEqual(m.blocks ?? []);
		}
	});

	it("DealsListBlock is enabled while deals is active", async () => {
		const { disabledBlocks } = await import("~/core/registry/blocks");
		expect(disabledBlocks.has("DealsListBlock")).toBe(false);
	});
});

describe("with deals inactive", () => {
	it("its block is disabled and filtered from the picker definitions", async () => {
		vi.resetModules();
		vi.doMock("../../modules.config", () => ({
			default: { active: ["jobs"] },
		}));
		const { disabledBlocks } = await import("~/core/registry/blocks");
		expect(disabledBlocks.has("DealsListBlock")).toBe(true);
		const defs = [
			{ componentType: "TextBlock" },
			{ componentType: "DealsListBlock" },
		];
		expect(
			withoutDisabledBlocks(defs, disabledBlocks).map((d) => d.componentType),
		).toEqual(["TextBlock"]);
		vi.doUnmock("../../modules.config");
		vi.resetModules();
	});

	it("and the deals page and sitemap are inactive too", async () => {
		vi.resetModules();
		vi.doMock("../../modules.config", () => ({
			default: { active: ["jobs"] },
		}));
		const mod = await import("~/core/registry/manifests");
		expect(mod.modulePages.some((p) => p.id === "deals.detail")).toBe(false);
		expect(await sitemapEntriesOf(mod.activeModules)).toEqual([]);
		vi.doUnmock("../../modules.config");
		vi.resetModules();
	});
});

describe("registry with the checked-in config", () => {
	it("includes jobs pages in modulePages", async () => {
		const { modulePages } = await import("~/core/registry/manifests");
		expect(modulePages.some((p) => p.id === "jobs.list")).toBe(true);
	});

	it("includes deals pages and admin sections ordered by nav position", async () => {
		const { modulePages, activeAdminSections } = await import(
			"~/core/registry/manifests"
		);
		expect(modulePages.some((p) => p.id === "deals.detail")).toBe(true);
		expect(activeAdminSections.map((s) => s.path)).toEqual([
			"events",
			"deals",
			"jobs",
			"elections",
			"qualifications",
		]);
	});

	it("requireActiveModule passes for active and 404s for others", async () => {
		const { requireActiveModule } = await import("~/core/registry/manifests");
		const event = {
			error: (status: number) => ({ status }),
		} as unknown as Parameters<typeof requireActiveModule>[0];
		expect(() => requireActiveModule(event, "jobs")).not.toThrow();
		expect(() => requireActiveModule(event, "nope")).toThrow();
	});
});

describe("with jobs inactive", () => {
	it("modulePages is empty and requireActiveModule 404s", async () => {
		vi.resetModules();
		vi.doMock("../../modules.config", () => ({ default: { active: [] } }));
		const mod = await import("~/core/registry/manifests");
		expect(mod.modulePages).toEqual([]);
		expect(mod.activeAdminSections).toEqual([]);
		expect(mod.activeMenuLinks).toEqual([]);
		const event = {
			error: (status: number) => ({ status }),
		} as unknown as Parameters<typeof mod.requireActiveModule>[0];
		expect(() => mod.requireActiveModule(event, "jobs")).toThrow();
		vi.doUnmock("../../modules.config");
		vi.resetModules();
	});
});
