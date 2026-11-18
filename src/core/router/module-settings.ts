/**
 * Module deployment settings (manifest `settings`, spec 4.1): each module declares a zod object
 * whose keys map to environment variables `<MODULE_ID>_<KEY>` (`social-web` + `updateInterval` =
 * `SOCIAL_WEB_UPDATE_INTERVAL`). src/env.ts validates the settings of the ACTIVE modules at
 * startup (an inactive module's settings are neither required nor checked); modules read them
 * with `moduleSettings("<id>")` from `~/core`. Pure: no env or app imports.
 */
import type { ZodObject } from "zod";

/** The environment variable of one setting: `SOCIAL_WEB_UPDATE_INTERVAL`. */
export function settingsEnvKey(moduleId: string, key: string): string {
	const snake = (value: string) =>
		value
			.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
			.replace(/[^A-Za-z0-9]+/g, "_")
			.toUpperCase();
	return `${snake(moduleId)}_${snake(key)}`;
}

export interface ParsedModuleSettings {
	/** Validated settings per active module that declares any. */
	values: Record<string, Record<string, unknown>>;
	/** One line per invalid setting: `SOCIAL_WEB_ACCOUNT: Invalid string`. */
	issues: string[];
}

/** Validates the settings of the active modules against `source` (the environment). */
export function parseModuleSettings(
	schemas: Readonly<Record<string, ZodObject>>,
	activeIds: readonly string[],
	source: Readonly<Record<string, string | undefined>>,
): ParsedModuleSettings {
	const values: Record<string, Record<string, unknown>> = {};
	const issues: string[] = [];
	for (const id of activeIds) {
		const schema = schemas[id];
		if (!schema) continue;
		const input = Object.fromEntries(
			Object.keys(schema.shape).map((key) => [
				key,
				source[settingsEnvKey(id, key)],
			]),
		);
		const result = schema.safeParse(input);
		if (result.success) {
			values[id] = result.data as Record<string, unknown>;
			continue;
		}
		for (const issue of result.error.issues) {
			const key = String(issue.path[0] ?? "");
			issues.push(`${key ? settingsEnvKey(id, key) : id}: ${issue.message}`);
		}
	}
	return { values, issues };
}
