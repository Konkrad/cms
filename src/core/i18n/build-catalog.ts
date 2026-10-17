import { FALLBACK_LOCALE, type Locale } from "./locales";
import type { Messages } from "./translate";

/** One catalog per locale of a source (core, theme or a module); `en` is required. */
export type CatalogSet = { en: Messages } & Partial<Record<Locale, Messages>>;

export type CatalogSources = {
	core: CatalogSet;
	theme: CatalogSet;
	modules: Readonly<Record<string, CatalogSet>>;
};

export type BuiltCatalog = {
	locale: Locale;
	/** Every key of core, the theme and the active modules: the locale's text, else English. */
	messages: Record<string, string>;
	/** Keys the locale lacks (served in English); the build warns about them. */
	fallbackKeys: string[];
};

/**
 * Merges the catalogs a site serves: core, the theme and the ACTIVE modules only, English
 * underneath the site locale. Run at build time (Vite plugin) so the browser gets one locale.
 */
export function buildCatalog(
	locale: Locale,
	activeModules: readonly string[],
	sources: CatalogSources,
): BuiltCatalog {
	const sets = [
		sources.core,
		sources.theme,
		...activeModules.flatMap((id) => {
			const set = sources.modules[id];
			return set ? [set] : [];
		}),
	];
	const messages: Record<string, string> = {};
	const fallbackKeys: string[] = [];
	for (const set of sets) {
		const localized = locale === FALLBACK_LOCALE ? set.en : set[locale];
		for (const [key, english] of Object.entries(set.en)) {
			const text = localized?.[key];
			if (text === undefined) fallbackKeys.push(key);
			messages[key] = text ?? english;
		}
	}
	return { locale, messages, fallbackKeys };
}
