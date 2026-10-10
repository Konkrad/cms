import type { RequestEventLoader } from "@qwik.dev/router";
import { requireEventsAdmin } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadNewEventContext(event: RequestEventLoader) {
	const ctx = await requireEventsAdmin(event);
	return ctx.isGlobal
		? ({ isGlobal: true, group: undefined } as const)
		: ({ isGlobal: false, group: { slug: ctx.group.slug } } as const);
}

export type NewEventContext = Awaited<ReturnType<typeof loadNewEventContext>>;
