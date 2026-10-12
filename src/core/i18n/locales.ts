import { z } from "zod";

/**
 * Locales the catalogs ship (spec 4.8). Each has `src/core/i18n/<locale>.json`,
 * `theme/i18n/<locale>.json` and `src/modules/<id>/i18n/<locale>.json`; English is the
 * fallback for keys a locale lacks.
 */
export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const FALLBACK_LOCALE: Locale = "en";

/** `SITE_LOCALE` (src/env.ts and the build's catalog plugin): one UI language per site. */
export const siteLocaleSchema = z.enum(LOCALES).default(FALLBACK_LOCALE);

/** The `Intl` locale a catalog locale formats dates, numbers and money with. */
export const INTL_LOCALES: Record<Locale, string> = {
	en: "en-GB",
	de: "de-DE",
};
