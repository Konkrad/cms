/**
 * Settings schemas of every module (manifest `settings`), by module id. Pure (zod only):
 * src/env.ts imports it to validate the active modules' settings at startup, before any app code
 * loads. Add a line per module with settings; `tests/unit/module-settings.spec.ts` checks it
 * against the manifests.
 */
import { eventsSettings } from "../../modules/events/settings";
import { socialWebSettings } from "../../modules/social-web/settings";

export const moduleSettingsSchemas = {
	events: eventsSettings,
	"social-web": socialWebSettings,
} as const;

export type ModuleSettingsSchemas = typeof moduleSettingsSchemas;
