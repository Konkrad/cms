import type { catalogSources } from "../registry/i18n";
import type { PLURAL_CATEGORIES } from "./translate";

type Sources = typeof catalogSources;
type ModuleKey = {
	[M in keyof Sources["modules"]]: keyof Sources["modules"][M]["en"];
}[keyof Sources["modules"]];

/** Every key of the English catalogs (core, theme, all modules). */
export type CatalogKey =
	| keyof Sources["core"]["en"]
	| keyof Sources["theme"]["en"]
	| ModuleKey;

type PluralBase<K> =
	K extends `${infer Base}_${(typeof PLURAL_CATEGORIES)[number]}`
		? Base
		: never;

/** What `t()` accepts: a catalog key, or the base of a plural pair (`x` for `x_one`/`x_other`). */
export type MessageKey = (CatalogKey | PluralBase<CatalogKey>) & string;
