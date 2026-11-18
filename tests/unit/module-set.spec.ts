import { describe, expect, it } from "vitest";
import { allModules } from "~/core/registry/manifests";
import { resolveActiveModuleIds } from "~/core/registry/module-set";
import { selectActive } from "~/core/router/modules";

const configured = ["deals", "events", "jobs"];

describe("resolveActiveModuleIds (CMS_MODULES over modules.config.ts)", () => {
	it("uses modules.config.ts when CMS_MODULES is unset", () => {
		expect(resolveActiveModuleIds(configured, undefined)).toEqual(configured);
	});

	it("an empty CMS_MODULES means no modules", () => {
		expect(resolveActiveModuleIds(configured, "")).toEqual([]);
		expect(resolveActiveModuleIds(configured, " , ")).toEqual([]);
	});

	it("a list replaces the config, trimmed, in the given order", () => {
		expect(resolveActiveModuleIds(configured, " jobs, social-web ")).toEqual([
			"jobs",
			"social-web",
		]);
	});

	it("unknown or duplicate ids are rejected by the registry", () => {
		expect(() =>
			selectActive(allModules, resolveActiveModuleIds([], "nope")),
		).toThrow(/Unknown module/);
		expect(() =>
			selectActive(allModules, resolveActiveModuleIds([], "jobs,jobs")),
		).toThrow(/Duplicate module/);
	});
});
