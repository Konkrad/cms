/**
 * `cms:modules` Vite plugin: replaces `src/core/registry/active-modules.ts` with the active
 * module ids resolved at build time (`modules.config.ts`, overridden by `CMS_MODULES` read with
 * Vite's `loadEnv`, the same `.env` src/env.ts reads), so the client bundle carries the list and
 * the build fails on an unknown module id. The i18n catalog (`cms:i18n`) uses the same set.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";
import config from "../../../modules.config";
import { resolveActiveModuleIds } from "./module-set";

const ACTIVE_MODULES_FILE = "src/core/registry/active-modules.ts";

/** The active module ids for a Vite mode (CMS_MODULES from the environment or `.env`). */
export function buildActiveModuleIds(
	mode: string,
	envDir: string,
	root: string,
): string[] {
	const override = loadEnv(mode, envDir, "").CMS_MODULES;
	const ids = resolveActiveModuleIds(config.active, override);
	for (const id of ids) {
		if (!fs.existsSync(path.join(root, "src/modules", id, "module.ts")))
			throw new Error(
				`Unknown module "${id}" in ${override === undefined ? "modules.config.ts" : "CMS_MODULES"}`,
			);
	}
	return ids;
}

export function moduleSet(): Plugin {
	let file = "";
	let ids: string[] = [];
	return {
		name: "cms:modules",
		enforce: "pre",
		configResolved(resolved) {
			file = path.join(resolved.root, ACTIVE_MODULES_FILE);
			ids = buildActiveModuleIds(
				resolved.mode,
				resolved.envDir || resolved.root,
				resolved.root,
			);
		},
		load(id) {
			if (path.normalize(id.split("?")[0]) !== file) return;
			return `export const activeModuleIds = ${JSON.stringify(ids)};\n`;
		},
	};
}
