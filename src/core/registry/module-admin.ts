import type { RequestEventCommon } from "@qwik.dev/router";
import { requireGroupAdmin } from "~/core/scopes/access-control";
import { requireActiveModule } from "./manifests";

export interface ModuleAdminOptions {
	/** Module id; also the admin section path (`/admin/global/<module>`). */
	module: string;
	/**
	 * `global`: only the global admin scope; any other `[group_slug]` is redirected to the
	 * module's global admin section. `any`: every scope the caller may manage.
	 */
	scope: "global" | "any";
}

/**
 * Admin guard for module admin loaders/actions. Call as the first statement (before any try
 * block): resolves the `[group_slug]` scope via `requireGroupAdmin`, applies the scope rule,
 * then 404s when the module is inactive.
 */
export async function requireModuleAdmin(
	event: RequestEventCommon,
	{ module, scope }: ModuleAdminOptions,
) {
	const ctx = await requireGroupAdmin(
		event as Parameters<typeof requireGroupAdmin>[0],
	);
	if (scope === "global" && !ctx.isGlobal) {
		throw event.redirect(302, `/admin/global/${module}`);
	}
	requireActiveModule(event, module);
	return ctx;
}
