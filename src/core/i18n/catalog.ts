/**
 * The site's merged message catalog. In every Vite build and the dev server the `cms:i18n`
 * plugin (`./vite-plugin.ts`) REPLACES this module with the catalog of `SITE_LOCALE`, merged
 * at build time, so the browser bundle carries one locale only. This default (English, the
 * active modules) serves tools that run without Vite: tsx scripts and the unit tests.
 */
import config from "../../../modules.config";
import { catalogSources } from "../registry/i18n";
import { type BuiltCatalog, buildCatalog } from "./build-catalog";

export const catalog: BuiltCatalog = buildCatalog(
	"en",
	config.active,
	catalogSources,
);
