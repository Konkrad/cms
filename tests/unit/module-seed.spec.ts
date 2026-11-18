import { describe, expect, it, vi } from "vitest";
import { runModuleSeeds, type SeedContext } from "~/core/db/seed";
import { activeModules, allModules } from "~/core/registry/manifests";
import { selectActive } from "~/core/router/modules";

const ctx = (mode: SeedContext["mode"]) =>
	({ mode, log: () => {} }) as unknown as SeedContext;

describe("module seeds", () => {
	it("runs the seed of each given module in order, with the context", async () => {
		const calls: string[] = [];
		const seed = (id: string) =>
			vi.fn(async (c: SeedContext) => {
				calls.push(`${id}:${c.mode}`);
			});
		const modules = [
			{ id: "alpha", seed: seed("alpha") },
			{ id: "plain" },
			{ id: "beta", seed: seed("beta") },
		];
		expect(await runModuleSeeds(modules, ctx("test"))).toEqual([
			"alpha",
			"beta",
		]);
		expect(calls).toEqual(["alpha:test", "beta:test"]);
	});

	it("seeds only the active modules", async () => {
		const calls: string[] = [];
		const all = ["alpha", "beta"].map((id) => ({
			id,
			seed: async () => {
				calls.push(id);
			},
		}));
		await runModuleSeeds(selectActive(all, ["beta"]), ctx("demo"));
		expect(calls).toEqual(["beta"]);
		await runModuleSeeds(selectActive(all, []), ctx("demo"));
		expect(calls).toEqual(["beta"]);
	});

	it("the seed scripts' registry is the active manifests' seeds", () => {
		expect(allModules.filter((m) => m.seed).map((m) => m.id)).toEqual([
			"deals",
			"elections",
			"events",
			"jobs",
			"qualifications",
		]);
		// seedActiveModules passes `activeModules`, so an inactive module never seeds.
		expect(activeModules.every((m) => allModules.includes(m))).toBe(true);
	});
});
