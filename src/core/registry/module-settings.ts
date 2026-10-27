import type { z } from "zod";
import { env } from "~/env";
import type { ModuleSettingsSchemas } from "./settings";

/**
 * The validated deployment settings of a module (manifest `settings`), typed from its schema:
 * `moduleSettings("social-web").account`. Server-only. Throws for a module that is not active
 * (its settings are not validated then).
 */
export function moduleSettings<Id extends keyof ModuleSettingsSchemas>(
	id: Id,
): z.output<ModuleSettingsSchemas[Id]> {
	const values = env.MODULE_SETTINGS[id];
	if (!values)
		throw new Error(
			`Settings of module "${id}" requested while it is inactive`,
		);
	return values as z.output<ModuleSettingsSchemas[Id]>;
}
