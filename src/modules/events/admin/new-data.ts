import type { RequestEventLoader } from "@qwik.dev/router";
import { allowedVisibilities, requireModuleAdmin } from "~/core";

/** Server-only: import from route loaders only, never from components. */
export async function loadNewEventContext(event: RequestEventLoader) {
	const ctx = await requireModuleAdmin(event, { module: "events" });
	return {
		isRoot: ctx.isRoot,
		adminBase: ctx.adminBase,
		// Visibilities the user may pick in this scope (public needs coordinator or above).
		visibilities: await allowedVisibilities(ctx.user, ctx.scope.id),
	};
}

export type NewEventContext = Awaited<ReturnType<typeof loadNewEventContext>>;
