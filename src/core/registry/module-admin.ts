import type { RequestEventCommon } from "@qwik.dev/router";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	requireScopeRole,
	type ScopeAccess,
} from "~/core/scopes/access";
import { requireActiveModule } from "./manifests";

export interface ModuleAdminOptions {
	/** Module id; also the admin section path (`/admin/<scope>/<module>`). */
	module: string;
	/**
	 * `global`: only the root scope's admin; any other scope answers 404. `any`: the admin of
	 * every scope the caller manages (the section's data must then be limited to that scope).
	 */
	scope: "global" | "any";
}

export interface ModuleAdminAccess extends ScopeAccess {
	/** The URL's scope is the root. */
	isRoot: boolean;
	/** Admin base URL of the URL's scope, e.g. "/admin/germany.berlin". */
	adminBase: string;
}

/**
 * Admin guard for module admin loaders/actions. Call as the first statement (before any try
 * block): `requireScopeRole` with a managing role on the URL's `[scope]` (admin, moderator or
 * representative, inherited downward), then the scope rule, then 404 when the module is inactive.
 */
export async function requireModuleAdmin(
	event: RequestEventCommon,
	{ module, scope }: ModuleAdminOptions,
): Promise<ModuleAdminAccess> {
	const access = await requireScopeRole(
		event as Parameters<typeof requireScopeRole>[0],
		ADMIN_ACCESS,
	);
	const isRoot = access.scope.parentId === null;
	if (scope === "global" && !isRoot) throw event.error(404, "Not found");
	requireActiveModule(event, module);
	return { ...access, isRoot, adminBase: adminUrl(access.scope.path) };
}
