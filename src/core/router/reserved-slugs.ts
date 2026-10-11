import type { ModuleDefinition } from "~/core/router/modules";
import { ROOT_ADMIN_SEGMENT } from "~/core/router/scope-path";

/**
 * First segments of the static routes in `src/routes` (a unit test keeps this list in sync
 * with the folder), plus paths the server answers outside the routes (build output, assets).
 */
export const CORE_ROUTE_SEGMENTS: readonly string[] = [
	"admin",
	"api",
	"archive",
	"auth",
	"forms",
	"groups",
	"login",
	"onboarding",
	"posts",
	"profile",
	"sitemap.xml",
	"up",
	"users",
	// served outside src/routes
	"build",
	"assets",
];

/**
 * Slugs a scope may not take at any level, so `/germany/events` is always Germany's event
 * listing and never a chapter called "events": every core route segment, the first segment
 * of every module page (all registered modules, active or not, so activating a module never
 * makes an existing scope unreachable) and the root's admin segment (`/admin/root`).
 */
export function reservedScopeSlugs(
	modules: readonly ModuleDefinition[],
): Set<string> {
	const reserved = new Set([...CORE_ROUTE_SEGMENTS, ROOT_ADMIN_SEGMENT]);
	for (const module of modules) {
		for (const page of module.pages ?? []) {
			const first = page.path.split("/").filter(Boolean)[0];
			if (first && !first.startsWith(":")) reserved.add(first);
		}
	}
	return reserved;
}
