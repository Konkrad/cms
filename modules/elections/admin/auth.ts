import type { RequestEventCommon } from "@qwik.dev/router";
import { requireActiveModule, requireGroupAdmin } from "~/core-api";

/**
 * Elections admin is global-only. Call as the first statement of every admin loader/action
 * (before any try block): resolves the `[group_slug]` scope, rejects non-global scopes,
 * then 404s when the module is inactive.
 */
export async function requireElectionsAdmin(event: RequestEventCommon) {
	const ctx = await requireGroupAdmin(
		event as Parameters<typeof requireGroupAdmin>[0],
	);
	if (!ctx.isGlobal) throw event.redirect(302, "/admin/global/elections");
	requireActiveModule(event, "elections");
	return ctx;
}
