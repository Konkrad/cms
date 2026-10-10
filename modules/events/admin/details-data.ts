import type { RequestEventLoader } from "@qwik.dev/router";
import { requireAdminEvent } from "./auth";

/**
 * Server-only: import from route loaders only, never from components.
 * The event in the admin's scope (a missing one redirects to the list), without its organizer's
 * user row and email.
 */
export async function loadAdminEventDetails(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event, {
		onMissing: "redirect",
	});
	const { user: _organizer, ...eventData } = target;
	return eventData;
}

export type AdminEventDetailsData = Awaited<
	ReturnType<typeof loadAdminEventDetails>
>;
