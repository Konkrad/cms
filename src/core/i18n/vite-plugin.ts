/**
 * `cms:i18n` Vite plugin: replaces `src/core/i18n/catalog.ts` with the catalog of the site
 * locale, merged at build time (core, theme and the ACTIVE modules over English), so the
 * client bundle carries one locale and the strings `t()` reads are a plain object.
 * `SITE_LOCALE` is read with Vite's `loadEnv` (same `.env` as src/env.ts) and validated with
 * the schema env.ts uses; the production server refuses to start when its `SITE_LOCALE`
 * differs from the build's (`assertBuiltSiteLocale`). Catalog edits reload the dev server.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import config from "../../../modules.config";
import {
	buildCatalog,
	type CatalogSet,
	type CatalogSources,
} from "./build-catalog";
import { LOCALES, type Locale, siteLocaleSchema } from "./locales";

const CATALOG_MODULE = "src/core/i18n/catalog.ts";

function readCatalogSet(dir: string): CatalogSet | undefined {
	const read = (locale: Locale) => {
		const file = path.join(dir, `${locale}.json`);
		return fs.existsSync(file)
			? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>)
			: undefined;
	};
	const en = read("en");
	if (!en) return undefined;
	return Object.fromEntries(
		LOCALES.map((locale) => [locale, read(locale)]).filter(([, m]) => m),
	) as CatalogSet;
}

/** Reads every catalog from disk (fresh on each load, so edits apply without a restart). */
export function readCatalogSources(root: string): CatalogSources {
	const required = (dir: string) => {
		const set = readCatalogSet(path.join(root, dir));
		if (!set) throw new Error(`i18n: missing ${dir}/en.json`);
		return set;
	};
	const modules: Record<string, CatalogSet> = {};
	for (const id of config.active) {
		const set = readCatalogSet(path.join(root, "src/modules", id, "i18n"));
		if (set) modules[id] = set;
	}
	return {
		core: required("src/core/i18n"),
		theme: required("theme/i18n"),
		modules,
	};
}

export function i18nCatalog(): Plugin {
	let root = process.cwd();
	let locale: Locale = "en";
	let catalogFile = "";
	const isCatalogJson = (file: string) =>
		/[\\/]i18n[\\/][a-z]{2}\.json$/.test(file) && file.startsWith(root);

	return {
		name: "cms:i18n",
		enforce: "pre",
		configResolved(resolved) {
			root = resolved.root;
			catalogFile = path.join(root, CATALOG_MODULE);
			const value = loadEnv(
				resolved.mode,
				resolved.envDir || root,
				"",
			).SITE_LOCALE;
			locale = siteLocaleSchema.parse(value || undefined);
		},
		load(id) {
			if (path.normalize(id.split("?")[0]) !== catalogFile) return;
			const built = buildCatalog(
				locale,
				config.active,
				readCatalogSources(root),
			);
			if (built.fallbackKeys.length > 0) {
				this.warn(
					`${built.fallbackKeys.length} message key(s) missing in the "${locale}" catalogs, served in English: ${built.fallbackKeys.slice(0, 20).join(", ")}${built.fallbackKeys.length > 20 ? ", …" : ""}`,
				);
			}
			return `export const catalog = ${JSON.stringify({
				locale,
				messages: built.messages,
				fallbackKeys: [],
			})};\n`;
		},
		configureServer(server: ViteDevServer) {
			server.watcher.on("change", (file) => {
				if (!isCatalogJson(file)) return;
				for (const environment of Object.values(server.environments)) {
					const mod = environment.moduleGraph.getModuleById(catalogFile);
					if (mod) environment.moduleGraph.invalidateModule(mod);
				}
				server.ws.send({ type: "full-reload" });
			});
		},
	};
}
