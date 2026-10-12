import { t } from "~/core/i18n";
import type { ModuleDefinition } from "~/core/router/modules";
import { ROOT_ADMIN_SEGMENT, SCOPE_SLUG_RE } from "~/core/router/scope-path";

/**
 * First segments of core's static routes in `src/routes` (a unit test keeps this list plus the
 * modules' `routes` in sync with the folder), plus paths the server answers outside the routes
 * (build output, assets).
 */
export const CORE_ROUTE_SEGMENTS: readonly string[] = [
	"admin",
	"api",
	"archive",
	"auth",
	"forms",
	"login",
	"onboarding",
	// Core pages served by the catch-all at every level (`/<scope>/notes/<id>`, `/<scope>/articles/<id>`).
	"notes",
	"articles",
	"profile",
	"sitemap.xml",
	"up",
	"users",
	// served outside src/routes
	"build",
	"assets",
];

/** First segments of old URLs still answered by redirect rows (`/groups/<slug>`). */
export const LEGACY_SEGMENTS: readonly string[] = ["groups"];

/**
 * Slugs a scope may not take at any level, so `/germany/events` is always Germany's event
 * listing and never a chapter called "events": every core route segment, the first segment
 * of every module page, every module route (`routes`; all registered modules, active or not,
 * so activating a module never makes an existing scope unreachable) and the root's admin
 * segment (`/admin/root`).
 */
export function reservedScopeSlugs(
	modules: readonly ModuleDefinition[],
): Set<string> {
	const reserved = new Set([
		...CORE_ROUTE_SEGMENTS,
		...LEGACY_SEGMENTS,
		ROOT_ADMIN_SEGMENT,
	]);
	for (const module of modules) {
		for (const route of module.routes ?? []) reserved.add(route);
		for (const page of module.pages ?? []) {
			const first = page.path.split("/").filter(Boolean)[0];
			if (first && !first.startsWith(":")) reserved.add(first);
		}
	}
	return reserved;
}

/**
 * Why `slug` cannot be a CMS page slug in a scope (null when it can). A page is served at
 * `<scope path>/<slug>` by the catch-all, so its slug must not be shadowed by anything matched
 * first at that level: a child scope with the same slug (the scope prefix wins), a module page
 * at exactly `/<slug>` (module pages win) or, at the root, a static core route. The empty slug
 * is the root's home page; other scopes have their scope home there.
 */
export function pageSlugProblem(
	slug: string,
	ctx: {
		isRoot: boolean;
		modules: readonly ModuleDefinition[];
		childScopeSlugs: ReadonlySet<string>;
	},
): string | null {
	if (slug === "") {
		return ctx.isRoot ? null : t("core.pages.onlyRootOwnPath");
	}
	if (!SCOPE_SLUG_RE.test(slug)) {
		return t("core.pages.slugFormat");
	}
	if (ctx.childScopeSlugs.has(slug)) {
		return t("core.pages.groupExists", { slug });
	}
	if (
		ctx.isRoot &&
		(CORE_ROUTE_SEGMENTS.includes(slug) || LEGACY_SEGMENTS.includes(slug))
	) {
		return t("core.pages.reservedPath", { slug });
	}
	const modulePaths = new Set(
		ctx.modules.flatMap((m) => (m.pages ?? []).map((p) => p.path)),
	);
	if (modulePaths.has(`/${slug}`)) return t("core.pages.modulePage", { slug });
	return null;
}
