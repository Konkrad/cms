import type { RequestEventCommon } from "@qwik.dev/router";
import { sectionAllowedOn } from "~/core/router/modules";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	requireScopeRole,
	type ScopeAccess,
} from "~/core/scopes/access";
import { allModules, requireActiveModule } from "./manifests";

export interface ModuleAdminOptions {
	/** Module id. */
	module: string;
	/**
	 * The admin section (its `path` in the manifest); default: the module id. The section's
	 * `scopes` rule decides on which scopes it exists (404 elsewhere).
	 */
	section?: string;
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
 * representative, inherited downward), then 404 when the module is inactive or its section does
 * not exist on this scope (the manifest's `scopes`: root, all, or a list of kinds).
 */
export async function requireModuleAdmin(
	event: RequestEventCommon,
	{ module, section = module }: ModuleAdminOptions,
): Promise<ModuleAdminAccess> {
	const access = await requireScopeRole(
		event as Parameters<typeof requireScopeRole>[0],
		ADMIN_ACCESS,
	);
	requireActiveModule(event, module);
	const definition = allModules
		.find((m) => m.id === module)
		?.admin?.sections.find((s) => s.path === section);
	if (!definition || !sectionAllowedOn(definition, access.scope)) {
		throw event.error(404, "Not found");
	}
	return {
		...access,
		isRoot: access.scope.parentId === null,
		adminBase: adminUrl(access.scope.path),
	};
}
