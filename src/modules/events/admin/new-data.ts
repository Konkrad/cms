import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAdmin } from "~/core";

/** Server-only: import from route loaders only, never from components. */
export async function loadNewEventContext(event: RequestEventLoader) {
	const ctx = await requireModuleAdmin(event, {
		module: "events",
		scope: "any",
	});
	return { isRoot: ctx.isRoot, adminBase: ctx.adminBase };
}

export type NewEventContext = Awaited<ReturnType<typeof loadNewEventContext>>;
