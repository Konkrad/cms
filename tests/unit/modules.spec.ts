import { describe, expect, it, vi } from "vitest";
import {
	adminSectionsOf,
	defineModule,
	menuLinksOf,
	pagesOf,
	selectActive,
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

describe("registry with the checked-in config", () => {
	it("includes jobs pages in modulePages", async () => {
		const { modulePages } = await import("~/modules");
		expect(modulePages.some((p) => p.id === "jobs.list")).toBe(true);
	});

	it("requireActiveModule passes for active and 404s for others", async () => {
		const { requireActiveModule } = await import("~/modules");
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
		const mod = await import("~/modules");
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
