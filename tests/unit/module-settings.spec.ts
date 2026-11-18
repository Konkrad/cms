import { describe, expect, it } from "vitest";
import { z } from "zod";
import { allModules } from "~/core/registry/manifests";
import { moduleSettings } from "~/core/registry/module-settings";
import { moduleSettingsSchemas } from "~/core/registry/settings";
import {
	parseModuleSettings,
	settingsEnvKey,
} from "~/core/router/module-settings";

const schemas = {
	alpha: z.object({
		account: z.string().regex(/^[a-z]+$/),
		updateInterval: z.string().default("P1D"),
	}),
	beta: z.object({ limit: z.coerce.number().int().positive().default(3) }),
};

describe("settingsEnvKey", () => {
	it("maps module id and key to an upper snake env var", () => {
		expect(settingsEnvKey("social-web", "updateInterval")).toBe(
			"SOCIAL_WEB_UPDATE_INTERVAL",
		);
		expect(settingsEnvKey("jobs", "account")).toBe("JOBS_ACCOUNT");
	});
});

describe("parseModuleSettings", () => {
	it("validates the active modules' settings from the environment, with defaults", () => {
		const parsed = parseModuleSettings(schemas, ["alpha", "beta"], {
			ALPHA_ACCOUNT: "news",
			BETA_LIMIT: "5",
		});
		expect(parsed.issues).toEqual([]);
		expect(parsed.values).toEqual({
			alpha: { account: "news", updateInterval: "P1D" },
			beta: { limit: 5 },
		});
	});

	it("reports an invalid value by its environment variable", () => {
		const parsed = parseModuleSettings(schemas, ["alpha"], {
			ALPHA_ACCOUNT: "Not valid!",
		});
		expect(parsed.issues).toHaveLength(1);
		expect(parsed.issues[0]).toMatch(/^ALPHA_ACCOUNT: /);
		expect(parsed.values.alpha).toBeUndefined();
	});

	it("reports a missing required setting", () => {
		const parsed = parseModuleSettings(schemas, ["alpha"], {});
		expect(parsed.issues[0]).toMatch(/^ALPHA_ACCOUNT: /);
	});

	it("neither requires nor validates the settings of an inactive module", () => {
		const parsed = parseModuleSettings(schemas, ["beta"], {
			ALPHA_ACCOUNT: "Not valid!",
		});
		expect(parsed.issues).toEqual([]);
		expect(Object.keys(parsed.values)).toEqual(["beta"]);
	});
});

describe("moduleSettings", () => {
	it("returns the validated, typed settings of an active module", () => {
		const settings = moduleSettings("social-web");
		const account: string = settings.account;
		expect(account).toBe(process.env.SOCIAL_WEB_ACCOUNT ?? "news");
		expect(settings.updateInterval).toMatch(/^P/);
		expect(settings.icon).toBeTruthy();
	});

	it("the registry lists exactly the manifests' settings schemas", () => {
		const fromManifests = Object.fromEntries(
			allModules.flatMap((m) => (m.settings ? [[m.id, m.settings]] : [])),
		);
		expect(fromManifests).toEqual(moduleSettingsSchemas);
		for (const [id, schema] of Object.entries(moduleSettingsSchemas))
			expect(fromManifests[id]).toBe(schema);
	});
});
