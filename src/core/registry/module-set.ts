/**
 * The site's set of active modules (spec 4.1): `modules.config.ts` (checked in) lists them; the
 * `CMS_MODULES` environment variable, when set, replaces that list for one deployment, build or
 * test run without editing the file: comma-separated ids, the empty string for none
 * (`CMS_MODULES= npm run build`, CI's "no modules" leg). Pure: no imports, so src/env.ts, the
 * Vite plugins and the Playwright fixtures can all use it.
 */
export function resolveActiveModuleIds(
	configured: readonly string[],
	override: string | undefined,
): string[] {
	if (override === undefined) return [...configured];
	return override
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}
