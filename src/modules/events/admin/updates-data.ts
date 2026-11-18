import type { RequestEventLoader } from "@qwik.dev/router";
import { adminUpdatesFor, allowedVisibilities, itemUrl } from "~/core";
import { requireAdminEvent } from "./event-guards";

/**
 * Server-only: import from route loaders only, never from components.
 * The notes and articles about an event (any visibility: the viewer manages the event's scope)
 * and the visibilities the organiser may publish with, the event's own first.
 */
export async function loadAdminEventUpdates(event: RequestEventLoader) {
	const { user, event: target } = await requireAdminEvent(event, {
		onMissing: "redirect",
	});
	const allowed = await allowedVisibilities(user, target.scopeId);
	return {
		event: {
			id: target.id,
			title: target.title,
			url: await itemUrl("events:event", target),
		},
		visibilities: allowed.includes(target.visibility)
			? [target.visibility, ...allowed.filter((v) => v !== target.visibility)]
			: allowed,
		updates: await adminUpdatesFor("events:event", target.id),
	};
}

export type AdminEventUpdatesData = Awaited<
	ReturnType<typeof loadAdminEventUpdates>
>;
